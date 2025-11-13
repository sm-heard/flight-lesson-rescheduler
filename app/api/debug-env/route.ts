import { NextResponse } from "next/server";
import "@/lib/env";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({
    mode: process.env.EMAIL_MODE ?? null,
    demoEmail: process.env.DEMO_EMAIL ?? null,
    resendKeySet: Boolean(process.env.RESEND_API_KEY),
    fromEmail: process.env.RESEND_FROM_EMAIL ?? null,
  });
}
