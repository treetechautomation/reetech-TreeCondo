import { NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req) {
  try {
    const debugToken = req.headers.get("x-debug-token");

    if (!debugToken || debugToken !== process.env.DEBUG_TOKEN) {
      return NextResponse.json(
        { ok: false, error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await req.json();
    const to = body?.to;

    if (!to) {
      return NextResponse.json(
        { ok: false, error: "Missing 'to'" },
        { status: 400 }
      );
    }

    const result = await resend.emails.send({
      from:
        process.env.RESEND_FROM ||
        "TreeCondo <suportetreecondo@treetechautomation.com>",
      to,
      subject: "TreeCondo Email Test",
      html: "<h2>TreeCondo</h2><p>Email funcionando corretamente.</p>",
    });

    return NextResponse.json({ ok: true, result });

  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e.message },
      { status: 500 }
    );
  }
}
