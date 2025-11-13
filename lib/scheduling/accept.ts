import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { DateTime } from "luxon";

import { db } from "@/lib/db/client";
import {
  bookings,
  events,
  rescheduleProposals,
  students,
} from "@/drizzle/schema";
import { dispatchNotification, buildBookingManageUrl } from "@/lib/notifications/service";

function formatWindow(start: Date, end: Date, tz: string) {
  const startDt = DateTime.fromJSDate(start).setZone(tz);
  const endDt = DateTime.fromJSDate(end).setZone(tz);
  return `${startDt.toFormat("EEE, MMM d h:mma")} – ${endDt.toFormat("h:mma z")}`;
}

export async function acceptProposal(proposalId: string) {
  const [row] = await db
    .select({
      proposal: rescheduleProposals,
      booking: bookings,
      student: students,
    })
    .from(rescheduleProposals)
    .innerJoin(bookings, eq(rescheduleProposals.bookingId, bookings.id))
    .innerJoin(students, eq(bookings.studentId, students.id))
    .where(eq(rescheduleProposals.id, proposalId))
    .limit(1);

  if (!row) {
    throw new Error("Proposal not found");
  }

  const { proposal, booking, student } = row;

  if (proposal.status !== "proposed") {
    throw new Error("Proposal already processed");
  }

  const now = new Date();

  await db
    .update(bookings)
    .set({
      startTime: proposal.startTime,
      endTime: proposal.endTime,
      status: "rescheduled",
      updatedAt: now,
    })
    .where(eq(bookings.id, booking.id));

  await db
    .update(rescheduleProposals)
    .set({ status: "accepted" })
    .where(eq(rescheduleProposals.id, proposalId));

  await db
    .update(rescheduleProposals)
    .set({ status: "expired" })
    .where(
      and(
        eq(rescheduleProposals.bookingId, booking.id),
        ne(rescheduleProposals.id, proposalId),
        inArray(rescheduleProposals.status, ["proposed", "rejected"]),
      ),
    );

  const [cancelEvent] = await db
    .select({ createdAt: events.createdAt })
    .from(events)
    .where(
      and(
        eq(events.bookingId, booking.id),
        eq(events.type, "auto_cancelled"),
      ),
    )
    .orderBy(desc(events.createdAt))
    .limit(1);

  const responseMinutes = cancelEvent?.createdAt
    ? Math.max(
        0,
        Math.round(
          (now.getTime() - new Date(cancelEvent.createdAt).getTime()) / (1000 * 60),
        ),
      )
    : null;

  await db.insert(events).values({
    type: "proposal_accepted",
    bookingId: booking.id,
    details: {
      proposalId,
      newStart: proposal.startTime.toISOString(),
      newEnd: proposal.endTime.toISOString(),
      responseMinutes,
    },
  });

  const manageUrl = buildBookingManageUrl(booking.id);
  const lessonWindow = formatWindow(proposal.startTime, proposal.endTime, booking.tz);

  await dispatchNotification({
    bookingId: booking.id,
    toEmail: student.email,
    kind: "proposal_confirmed",
    template: {
      kind: "proposal_confirmed",
      studentName: student.name,
      newWindow: lessonWindow,
    },
  });

  return {
    bookingId: booking.id,
    startTime: proposal.startTime,
    endTime: proposal.endTime,
    manageUrl,
  };
}
