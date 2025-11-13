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
  summary: string;
  badgeClass: string;
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

  return rows.map((row) => {
    const start = DateTime.fromJSDate(row.booking.startTime).setZone(row.booking.tz);
    const end = DateTime.fromJSDate(row.booking.endTime).setZone(row.booking.tz);

    let badgeClass = "bg-slate-100 text-slate-600";
    switch (row.booking.status) {
      case "scheduled":
        badgeClass = "bg-emerald-100 text-emerald-700";
        break;
      case "conflict":
        badgeClass = "bg-amber-100 text-amber-700";
        break;
      case "cancelled":
        badgeClass = "bg-red-100 text-red-700";
        break;
      case "rescheduled":
        badgeClass = "bg-blue-100 text-blue-700";
        break;
      case "completed":
        badgeClass = "bg-slate-200 text-slate-700";
        break;
      default:
        badgeClass = "bg-slate-100 text-slate-600";
    }

    return {
      id: row.booking.id,
      status: row.booking.status,
      studentName: row.student.name,
      trainingLevel: row.student.trainingLevel,
      startTime: row.booking.startTime,
      endTime: row.booking.endTime,
      tz: row.booking.tz,
      summary: `${start.toFormat("EEE, MMM d h:mma")} – ${end.toFormat("h:mma z")}`,
      badgeClass,
    } satisfies UpcomingBooking;
  });
}
