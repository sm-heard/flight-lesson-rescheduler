import { NextRequest, NextResponse } from "next/server";

import { runWeatherMonitor } from "@/lib/conflicts";

function unauthorized(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const providedSecret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  if (!expectedSecret || providedSecret !== expectedSecret) {
    return unauthorized("Missing or invalid cron secret");
  }

  const result = await runWeatherMonitor();

  return NextResponse.json({ ok: true, stats: result.stats, processed: result.processed.length });
}
