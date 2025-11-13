import { NextResponse } from "next/server";

import "@/lib/env";
import { getRecentNotifications } from "@/lib/notifications/query";

export const dynamic = "force-dynamic";

const MAX_ITEMS = 50;

export async function GET() {
  const notifications = await getRecentNotifications(MAX_ITEMS);

  return NextResponse.json({
    ok: true,
    items: notifications.map((notification) => ({
      id: notification.id,
      bookingId: notification.bookingId,
      toEmail: notification.toEmail,
      kind: notification.kind,
      status: notification.status,
      sentAt: notification.sentAt,
      createdAt: notification.createdAt,
      providerId: notification.providerId,
      meta: notification.meta,
    })),
  });
}
