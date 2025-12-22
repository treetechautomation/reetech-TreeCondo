import {
  onDocumentCreated,
} from "firebase-functions/v2/firestore";
import * as logger from "firebase-functions/logger";
import {initializeApp} from "firebase-admin/app";
import {getAuth} from "firebase-admin/auth";

initializeApp();

type VinculoData = {
  email?: string;
  nome?: string;
};

export const createAuthUserOnVinculoCreated = onDocumentCreated(
  "userCondominios/{uid}/vinculos/{condominioId}",
  async (event) => {
    const snap = event.data;

    if (!snap) {
      logger.warn("Vínculo criado sem snapshot. Nada a fazer.");
      return;
    }

    const data = snap.data() as VinculoData;
    const email = data.email;
    const nome = data.nome;

    if (!email) {
      logger.info("Vínculo criado sem e-mail. Ignorando.");
      return;
    }

    const auth = getAuth();

    // Verifica se o usuário já existe
    try {
      await auth.getUserByEmail(email);
      logger.info(
        "Usuário já existe para " +
          email +
          ". Nenhuma ação executada.",
      );
      return;
    } catch (error: unknown) {
      const err = error as {code?: string};
      if (err.code !== "auth/user-not-found") {
        logger.error("Erro ao consultar usuário:", err);
        throw err;
      }
    }

    // Cria o usuário no Auth
    const user = await auth.createUser({
      email,
      displayName: nome,
      emailVerified: false,
      disabled: false,
    });

    // Gera link de primeiro acesso (definir senha)
    const resetLink = await auth.generatePasswordResetLink(
      email,
      {
        url: "https://treecondo.app/login/primeiro-acesso",
      },
    );

    // Salva dados no vínculo
    await snap.ref.update({
      authUid: user.uid,
      firstAccessLink: resetLink,
      firstAccessAt: null,
    });

    logger.info(
      "Usuário criado e link de acesso gerado para " + email + ".",
    );
  },
);
