"use server";

import { revalidatePath } from "next/cache";

import { runWeatherMonitor } from "@/lib/conflicts";

type TriggerOptions = {
  limit?: number;
};

export async function triggerWeatherCheck(options: TriggerOptions = {}) {
  const result = await runWeatherMonitor({ limit: options.limit });

  revalidatePath("/");
  revalidatePath("/bookings");
  revalidatePath("/proposals");
  revalidatePath("/notifications/outbox");

  return result.stats;
}
