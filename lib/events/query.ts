import { desc } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { events } from "@/drizzle/schema";

export type TimelineEvent = {
  id: string;
  type: string;
  details: Record<string, unknown>;
  createdAt: Date;
};

export async function getRecentEvents(limit = 10): Promise<TimelineEvent[]> {
  const rows = await db
    .select({
      id: events.id,
      type: events.type,
      details: events.details,
      createdAt: events.createdAt,
    })
    .from(events)
    .orderBy(desc(events.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    id: row.id,
    type: row.type,
    details: row.details as Record<string, unknown>,
    createdAt: row.createdAt,
  }));
}
