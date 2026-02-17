import { NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const to = body?.to || process.env.TEST_EMAIL_TO || null;

    if (!process.env.RESEND_API_KEY) {
      return NextResponse.json(
        { ok: false, error: "Missing RESEND_API_KEY" },
        { status: 500 },
      );
    }

    if (!to) {
      return NextResponse.json(
        { ok: false, error: 'Missing \'to\' (send JSON: {"to":"email"})' },
        { status: 400 },
      );
    }

    const from =
      process.env.RESEND_FROM ||
      process.env.RESEND_FROM_EMAIL ||
      process.env.RESEND_EMAIL_FROM ||
      "TreeCondo <onboarding@resend.dev>";

    const replyTo =
      process.env.RESEND_REPLY_TO ||
      process.env.RESEND_REPLY_TO_EMAIL ||
      process.env.RESEND_EMAIL_REPLY_TO ||
      undefined;

    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from,
      to,
      subject: "✅ TreeCondo / Resend test",
      html: `
        <div style="font-family: Inter, Arial, sans-serif">
          <h2>TreeCondo - Teste de Email</h2>
          <p>Se você recebeu isso, o Resend está OK no App Hosting.</p>
          <p><b>from:</b> ${from}</p>
          <p><b>replyTo:</b> ${replyTo ?? "(não setado)"}</p>
          <p><b>timestamp:</b> ${new Date().toISOString()}</p>
        </div>
      `,
      ...(replyTo ? { replyTo } : {}),
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || String(e) },
      { status: 500 },
    );
  }
}
