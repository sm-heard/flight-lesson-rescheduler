import { createHash } from "crypto";

import { and, eq, gte } from "drizzle-orm";
import { DateTime } from "luxon";

import { db } from "@/lib/db/client";
import {
  notifications,
  type NotificationKind,
  type NewNotification,
} from "@/drizzle/schema";
import { renderNotificationTemplate, type TemplateParams } from "@/lib/notifications/templates";
import { getResendClient } from "@/lib/notifications/resend";

const THROTTLE_HOURS = 3;

type NotificationMode = "preview" | "send";

export type NotificationRequest = {
  bookingId: string;
  toEmail: string;
  kind: NotificationKind;
  template: TemplateParams;
};

type DispatchResult = {
  status: NewNotification["status"];
  notificationId: string;
  reason?: string;
};

function resolveMode(): NotificationMode {
  const mode = process.env.EMAIL_MODE?.toLowerCase();
  if (
    mode === "send" &&
    process.env.RESEND_API_KEY &&
    process.env.DEMO_EMAIL
  ) {
    return "send";
  }
  return "preview";
}

function getDemoRecipient(): string | null {
  return process.env.DEMO_EMAIL || null;
}

function buildManageUrl(path: string) {
  const base = process.env.APP_BASE_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}${path}`;
}

function computeHash(subject: string, html: string) {
  return createHash("sha1").update(subject).update(html).digest("hex");
}

async function shouldThrottle(
  bookingId: string,
  kind: NotificationKind,
  contentHash: string,
) {
  const since = DateTime.utc().minus({ hours: THROTTLE_HOURS }).toJSDate();

  const recent = await db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.bookingId, bookingId),
        eq(notifications.kind, kind),
        gte(notifications.createdAt, since),
      ),
    );

  return recent.some((item) => {
    const meta = (item.meta ?? {}) as Record<string, unknown>;
    return meta.contentHash === contentHash;
  });
}

async function recordNotification(
  payload: NewNotification,
) {
  const [inserted] = await db.insert(notifications).values(payload).returning({ id: notifications.id });
  return inserted.id;
}

export async function dispatchNotification(request: NotificationRequest): Promise<DispatchResult> {
  if (request.kind !== request.template.kind) {
    throw new Error(`Template kind ${request.template.kind} does not match notification kind ${request.kind}`);
  }

  const rendered = await renderNotificationTemplate(request.template);
  const contentHash = computeHash(rendered.subject, rendered.html);

  const throttled = await shouldThrottle(request.bookingId, request.kind, contentHash);
  if (throttled) {
    const id = await recordNotification({
      bookingId: request.bookingId,
      toEmail: request.toEmail,
      channel: "email",
      kind: request.kind,
      sentAt: null,
      providerId: null,
      payload: {
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      },
      status: "suppressed",
      meta: { contentHash, reason: "throttled" },
    });
    return { status: "suppressed", notificationId: id, reason: "throttled" };
  }

  const mode = resolveMode();
  const demoEmail = getDemoRecipient();
  const resend = mode === "send" ? getResendClient() : null;

  let status: NewNotification["status"] = "queued";
  let providerId: string | null = null;
  let sentAt: Date | null = null;
  let reason: string | undefined;

  if (mode === "send" && resend && demoEmail) {
    try {
      const fromAddress =
        process.env.RESEND_FROM_EMAIL || "Flight Schedule Pro <demo@flight-schedule-pro.test>";
      const sendResult = await resend.emails.send({
        to: demoEmail,
        from: fromAddress,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
      });
      providerId = sendResult.id ?? null;
      sentAt = new Date();
      status = "sent";
    } catch (error) {
      status = "failed";
      reason = error instanceof Error ? error.message : "Email send failed";
    }
  }

  if (mode === "send" && (!resend || !demoEmail)) {
    reason = !demoEmail ? "DEMO_EMAIL not set" : "Resend disabled";
  }

  const id = await recordNotification({
    bookingId: request.bookingId,
    toEmail: mode === "send" && demoEmail ? demoEmail : request.toEmail,
    channel: "email",
    kind: request.kind,
    sentAt,
    providerId,
    payload: {
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
    },
    status,
    meta: {
      contentHash,
      mode,
      reason,
      originalRecipient: request.toEmail,
    },
  });

  return { status, notificationId: id, reason };
}

export function buildBookingManageUrl(bookingId: string) {
  return buildManageUrl(`/bookings/${bookingId}`);
}
