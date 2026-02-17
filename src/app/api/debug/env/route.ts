import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    nodeEnv: process.env.NODE_ENV,
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    resendFrom:
      process.env.RESEND_FROM ||
      process.env.RESEND_FROM_EMAIL ||
      process.env.RESEND_EMAIL_FROM ||
      null,
  });
}
