import { and, desc, eq, gte, lte } from "drizzle-orm";
import { DateTime } from "luxon";

import { db } from "@/lib/db/client";
import { bookings, students } from "@/drizzle/schema";

export type UpcomingBooking = {
  id: string;
  status: typeof bookings.$inferSelect.status;
  studentName: string;
  trainingLevel: typeof students.$inferSelect.trainingLevel;
  startTime: Date;
  endTime: Date;
  tz: string;
};

export async function getUpcomingBookings(limit = 10): Promise<UpcomingBooking[]> {
  const now = DateTime.now();
  const windowStart = now.minus({ hours: 12 }).toJSDate();
  const windowEnd = now.plus({ hours: 48 }).toJSDate();

  const rows = await db
    .select({
      booking: bookings,
      student: students,
    })
    .from(bookings)
    .innerJoin(students, eq(bookings.studentId, students.id))
    .where(
      and(
        gte(bookings.startTime, windowStart),
        lte(bookings.startTime, windowEnd),
      ),
    )
    .orderBy(desc(bookings.startTime))
    .limit(limit);

  return rows.map((row) => ({
    id: row.booking.id,
    status: row.booking.status,
    studentName: row.student.name,
    trainingLevel: row.student.trainingLevel,
    startTime: row.booking.startTime,
    endTime: row.booking.endTime,
    tz: row.booking.tz,
  }));
}
