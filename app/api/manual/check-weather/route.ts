import { NextRequest, NextResponse } from "next/server";

import { runWeatherMonitor } from "@/lib/conflicts";

export const dynamic = "force-dynamic";

function unauthorized(message: string) {
  return NextResponse.json({ ok: false, error: message }, { status: 401 });
}

export async function POST(request: NextRequest) {
  const providedSecret = request.headers.get("x-cron-secret");
  const expectedSecret = process.env.CRON_SECRET;

  const inDev = process.env.NODE_ENV !== "production";

  if (!inDev && (!expectedSecret || providedSecret !== expectedSecret)) {
    return unauthorized("Manual endpoint is protected in production");
  }

  const result = await runWeatherMonitor();
  return NextResponse.json({ ok: true, stats: result.stats, processed: result.processed.length });
}
