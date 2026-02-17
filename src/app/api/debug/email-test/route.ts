import { NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

function unauthorized() {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}

export async function POST(req: Request) {
  // 🔒 Segurança: desativa em produção (reabilitamos depois quando rollout estabilizar)
  // Em produção, permite SOMENTE com DEBUG_TOKEN válido (não remove o endpoint)


  try {
    const token = req.headers.get("x-debug-token");
    const expected = process.env.DEBUG_TOKEN;

    if (!expected || !token || token !== expected) return unauthorized();

    const body = await req.json().catch(() => ({}));
    const to = body?.to;

    if (!to || typeof to !== "string") {
      return NextResponse.json({ ok: false, error: "Missing 'to' (string)" }, { status: 400 });
    }

    const from =
      process.env.RESEND_FROM ||
      "TreeCondo <suportetreecondo@treetechautomation.com>";

    const result = await resend.emails.send({
      from,
      to,
      subject: "TreeCondo Email Test",
      html: "<h2>TreeCondo</h2><p>Email funcionando corretamente ✅</p>",
    });

    return NextResponse.json({ ok: true, result });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "Unknown error" }, { status: 500 });
  }
}
