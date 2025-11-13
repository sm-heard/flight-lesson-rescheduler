import { desc } from "drizzle-orm";

import { db } from "@/lib/db/client";
import { notifications } from "@/drizzle/schema";

export async function getRecentNotifications(limit = 50) {
  return db
    .select()
    .from(notifications)
    .orderBy(desc(notifications.createdAt))
    .limit(limit);
}
