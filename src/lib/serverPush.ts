import { adminMessaging } from "@/lib/firebaseAdmin";

export async function sendPushToUids(params: {
  db: any;
  uids: string[];
  title: string;
  body: string;
  link?: string;
  data?: Record<string, string>;
  icon?: string;
}) {
  const { db, uids, title, body, link = "/", data = {}, icon = "/icon-192.png" } = params;

  if (!uids?.length) {
    return {
      totalTokens: 0,
      successCount: 0,
      failureCount: 0,
      invalidRemoved: 0,
      erros: [] as Array<{ token: string; code: string; message: string }>,
      semToken: [] as string[],
    };
  }

  const tokenDocs: Array<{ uid: string; tokenId: string; token?: string | null }> = [];
  const semToken: string[] = [];

  for (const uid of Array.from(new Set(uids.map((x) => String(x || "").trim()).filter(Boolean)))) {
    try {
      const snap = await db.collection("users").doc(uid).collection("fcmTokens").get();
      if (snap.empty) semToken.push(uid);
      snap.forEach((d: any) => tokenDocs.push({ uid, tokenId: d.id, ...(d.data() || {}) }));
    } catch (e: any) {
      console.warn("[serverPush] falha lendo tokens do uid", uid, e?.message || String(e));
      semToken.push(uid);
    }
  }

  const tokens = tokenDocs
    .map((t: any) => String(t.token || t.tokenId || "").trim())
    .filter(Boolean);

  if (!tokens.length) {
    return {
      totalTokens: 0,
      successCount: 0,
      failureCount: 0,
      invalidRemoved: 0,
      erros: [] as Array<{ token: string; code: string; message: string }>,
      semToken,
    };
  }

  const msg = adminMessaging();

  const resp = await msg.sendEachForMulticast({
    tokens,
    webpush: {
      notification: {
        title,
        body,
        icon,
      },
      fcmOptions: {
        link,
      },
    },
    data: {
      title,
      body,
      click_action: link,
      ...data,
    },
  });

  const invalid: string[] = [];
  const erros: Array<{ token: string; code: string; message: string }> = [];

  resp.responses.forEach((r: any, i: number) => {
    if (r.success) return;
    const code = String(r.error?.code || "");
    const message = String(r.error?.message || "");
    erros.push({ token: tokens[i], code, message });

    if (
      code === "messaging/registration-token-not-registered" ||
      code === "messaging/invalid-registration-token"
    ) {
      invalid.push(tokens[i]);
    }
  });

  if (invalid.length) {
    await Promise.all(
      invalid.map(async (tok) => {
        const td = tokenDocs.find((x: any) => (x.token || x.tokenId) === tok);
        if (!td?.uid) return;
        try {
          await db.collection("users").doc(td.uid).collection("fcmTokens").doc(tok).delete();
        } catch (e: any) {
          console.warn("[serverPush] falha ao deletar token inválido", tok, e?.message || String(e));
        }
      })
    );
  }

  return {
    totalTokens: tokens.length,
    successCount: resp.successCount,
    failureCount: resp.failureCount,
    invalidRemoved: invalid.length,
    erros,
    semToken,
  };
}
