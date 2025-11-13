import { count, eq } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { bookings, events } from "@/drizzle/schema";

export type DashboardMetrics = {
  totalBookings: number;
  conflictsDetected: number;
  reschedulesConfirmed: number;
  averageRescheduleMinutes: number | null;
};

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  const [[bookingsRow], [conflictsRow], [reschedulesRow]] = await Promise.all([
    db.select({ value: count() }).from(bookings),
    db.select({ value: count() }).from(events).where(eq(events.type, "weather_conflict_detected")),
    db.select({ value: count() }).from(events).where(eq(events.type, "proposal_accepted")),
  ]);

  const proposalEvents = await db
    .select({ details: events.details })
    .from(events)
    .where(eq(events.type, "proposal_accepted"));

  const durations: number[] = proposalEvents
    .map((event) => {
      const details = event.details as Record<string, unknown>;
      const value = details?.responseMinutes;
      if (typeof value === "number") {
        return value;
      }
      if (typeof value === "string") {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : null;
      }
      return null;
    })
    .filter((value): value is number => value !== null);

  const averageRescheduleMinutes = durations.length
    ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length)
    : null;

  return {
    totalBookings: bookingsRow?.value ?? 0,
    conflictsDetected: conflictsRow?.value ?? 0,
    reschedulesConfirmed: reschedulesRow?.value ?? 0,
    averageRescheduleMinutes,
  };
}
