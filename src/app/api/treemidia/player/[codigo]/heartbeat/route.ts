import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebaseAdmin";
import { FieldValue } from "firebase-admin/firestore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ codigo: string }> }
) {
  try {
    const { codigo } = await params;
    
    if (!codigo) {
      return NextResponse.json({ ok: false, error: "Código inválido" }, { status: 400 });
    }

    const db = adminDb();

    // Query for the screen by scanning active condominium collections sequentially to avoid Collection Group index requirement
    const condominiosSnap = await db.collection("condominios").get();
    let screenDocRef = null;

    for (const condoDoc of condominiosSnap.docs) {
      const telasSnap = await db.collection("condominios")
        .doc(condoDoc.id)
        .collection("treemidia_telas")
        .where("codigo", "==", codigo)
        .limit(1)
        .get();

      if (!telasSnap.empty) {
        screenDocRef = telasSnap.docs[0].ref;
        break;
      }
    }

    if (!screenDocRef) {
      return NextResponse.json({ ok: false, error: "Tela não encontrada" }, { status: 404 });
    }

    // Update screen status and last communication timestamp
    await screenDocRef.update({
      status: "online",
      ultimaComunicacao: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true, msg: "Heartbeat registrado com sucesso" });
  } catch (e: any) {
    console.error("[api/treemidia/player/heartbeat] Erro:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? "Erro interno" }, { status: 500 });
  }
}
