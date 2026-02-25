import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function safeLen(v: unknown) {
  return typeof v === "string" ? v.length : 0;
}

function asBool(v: unknown) {
  return Boolean(v && String(v).trim().length > 0);
}

export async function GET() {
  const firebaseWebappConfig =
    process.env.FIREBASE_WEBAPP_CONFIG ||
    process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG ||
    "";

  const nextPublicFromNextConfig =
    process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG || "";

  return NextResponse.json({
    ok: true,
    nodeEnv: process.env.NODE_ENV,

    // Resend
    hasResendKey: Boolean(process.env.RESEND_API_KEY),
    resendFrom:
      process.env.RESEND_FROM ||
      process.env.RESEND_FROM_EMAIL ||
      process.env.RESEND_EMAIL_FROM ||
      null,

    // Firebase diagnostics
    hasFirebaseWebappConfig: asBool(firebaseWebappConfig),
    firebaseWebappConfigLength: safeLen(firebaseWebappConfig),
    hasNextPublicFirebaseWebappConfig: asBool(nextPublicFromNextConfig),
    nextPublicFirebaseWebappConfigLength: safeLen(nextPublicFromNextConfig),
  });
}
