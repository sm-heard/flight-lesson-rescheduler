import { and, asc, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import {
  bookings,
  rescheduleProposals,
  students,
  type Booking,
  type RescheduleProposal,
  type Student,
} from "@/drizzle/schema";

export type ProposalWithContext = {
  proposal: RescheduleProposal;
  booking: Booking;
  student: Student;
};

export async function getOpenProposals(): Promise<ProposalWithContext[]> {
  const rows = await db
    .select({
      proposal: rescheduleProposals,
      booking: bookings,
      student: students,
    })
    .from(rescheduleProposals)
    .innerJoin(bookings, eq(rescheduleProposals.bookingId, bookings.id))
    .innerJoin(students, eq(bookings.studentId, students.id))
    .where(eq(rescheduleProposals.status, "proposed"))
    .orderBy(asc(bookings.startTime), asc(rescheduleProposals.rank));

  return rows;
}

export async function getProposalsByBooking(bookingId: string) {
  const rows = await db
    .select({ proposal: rescheduleProposals })
    .from(rescheduleProposals)
    .where(
      and(
        eq(rescheduleProposals.bookingId, bookingId),
        eq(rescheduleProposals.status, "proposed"),
      ),
    )
    .orderBy(asc(rescheduleProposals.rank));

  return rows.map((row) => row.proposal);
}
