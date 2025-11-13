import { DateTime } from "luxon";

import { db } from "@/lib/db/client";
import { events } from "@/drizzle/schema";
import { and, gte, inArray } from "drizzle-orm";

export type TrendPoint = {
  date: string; // ISO date (yyyy-MM-dd)
  conflicts: number;
  reschedules: number;
};

const CONFLICT_TYPE = "weather_conflict_detected";
const RESCHEDULE_TYPE = "proposal_accepted";

export async function getTrendData(days = 7): Promise<TrendPoint[]> {
  const now = DateTime.now();
  const start = now.minus({ days: days - 1 }).startOf("day");

  const rows = await db
    .select({
      type: events.type,
      createdAt: events.createdAt,
    })
    .from(events)
    .where(
      and(
        gte(events.createdAt, start.toJSDate()),
        inArray(events.type, [CONFLICT_TYPE, RESCHEDULE_TYPE]),
      ),
    );

  const map = new Map<string, { conflicts: number; reschedules: number }>();

  for (let i = 0; i < days; i += 1) {
    const day = start.plus({ days: i });
    map.set(day.toISODate()!, { conflicts: 0, reschedules: 0 });
  }

  rows.forEach((row) => {
    const date = DateTime.fromJSDate(row.createdAt).toISODate();
    if (!date) return;
    const bucket = map.get(date);
    if (!bucket) return;
    if (row.type === CONFLICT_TYPE) {
      bucket.conflicts += 1;
    } else if (row.type === RESCHEDULE_TYPE) {
      bucket.reschedules += 1;
    }
  });

  return Array.from(map.entries()).map(([date, value]) => ({
    date,
    conflicts: value.conflicts,
    reschedules: value.reschedules,
  }));
}
