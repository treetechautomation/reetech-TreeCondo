"use client";

import type { FirebaseApp } from "firebase/app";
import type { Firestore } from "firebase/firestore";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

function isBrowser() {
  return typeof window !== "undefined" && typeof document !== "undefined";
}

/**
 * Registra token FCM (Web Push) - opcional (não quebra o app).
 * Salva diagnóstico em users/{uid}.fcmDiag e tokens em users/{uid}/fcmTokens/{token}
 */
export async function registerFcmToken(params: {
  app: FirebaseApp;
  firestore: Firestore;
  uid: string;
}) {
  const { app, firestore, uid } = params;

  const diag: Record<string, any> = {
    at: new Date().toISOString(),
    uid,
    step: "start",
    supported: null,
    hasNotification: null,
    hasServiceWorker: null,
    permissionBefore: null,
    permissionAfter: null,
    hasVapidKey: null,
    swRegistered: null,
    tokenOk: null,
    error: null,
  };

  async function saveDiag(patch: Record<string, any>) {
    try {
      Object.assign(diag, patch);
      await setDoc(
        doc(firestore, "users", uid),
        { fcmDiag: diag, fcmDiagUpdatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch (e) {
      console.warn("[FCM] saveDiag failed", e);
    }
  }

  try {
    if (!isBrowser()) return;

    diag.hasNotification = "Notification" in window;
    diag.hasServiceWorker = "serviceWorker" in navigator;

    if (!diag.hasNotification) {
      await saveDiag({ step: "no_notification_api" });
      return;
    }
    if (!diag.hasServiceWorker) {
      await saveDiag({ step: "no_service_worker" });
      return;
    }

    const supported = await isSupported().catch(() => false);
    diag.supported = supported;
    if (!supported) {
      await saveDiag({ step: "not_supported" });
      return;
    }

    if (Notification.permission === "denied") {
      await saveDiag({ step: "permission_denied", permissionBefore: "denied" });
      return;
    }

    let permission: NotificationPermission = Notification.permission;
    diag.permissionBefore = permission;

    if (permission !== "granted") {
      try {
        permission = await Notification.requestPermission();
      } catch (e: any) {
        await saveDiag({
          step: "permission_request_failed",
          error: String(e?.message || e || "permission_request_failed"),
        });
        return;
      }
    }

    diag.permissionAfter = permission;
    if (permission !== "granted") {
      await saveDiag({ step: "permission_not_granted" });
      return;
    }

    const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || "";
    diag.hasVapidKey = vapidKey.length > 0;
    if (!diag.hasVapidKey) {
      await saveDiag({ step: "no_vapid" });
      return;
    }

    const messaging = getMessaging(app);

    const swReg = await navigator.serviceWorker
      .register("/firebase-messaging-sw.js", { scope: "/firebase-messaging/" })
      .catch((e) => {
        console.warn("[FCM] sw register failed", e);
        return null;
      });

    diag.swRegistered = !!swReg;
    await saveDiag({ step: "sw_registered", swRegistered: !!swReg });
    if (!swReg) return;

    
      // espera o SW ficar ativo/controlando
      try {
        await navigator.serviceWorker.ready;
      } catch (e: any) {
        await saveDiag({ step: "sw_ready_failed", error: String(e?.message || e || "sw_ready_failed") });
      }

      await saveDiag({
          step: "sw_ready",
          swScope: swReg.scope,
          swActiveState: swReg.active?.state || null,
          swScriptURL: swReg.active?.scriptURL || null,
          controllerURL: navigator.serviceWorker.controller?.scriptURL || null,
        });

        // tentativa 1
        const token = await getToken(messaging, {
          vapidKey,
          serviceWorkerRegistration: swReg,
        }).catch(async (e: unknown) => {
        const msg =
          e instanceof Error ? e.message : typeof e === "string" ? e : JSON.stringify(e);
        console.warn("[FCM] getToken failed", e);
        await saveDiag({ step: "gettoken_failed", error: msg });

          // Se existir subscription antiga (gerada com outra VAPID), tenta limpar e registrar de novo 1x
          const m = String(msg || "").toLowerCase();
          const shouldRetry =
            m.includes("applicationserverkey") ||
            m.includes("pushmanager") ||
            m.includes("invalidaccesserror") ||
            m.includes("not valid");

          if (shouldRetry) {
            try {
              const sub = await swReg.pushManager.getSubscription();
              if (sub) {
                await sub.unsubscribe();
                await saveDiag({ step: "unsubscribed_old_push" });
              } else {
                await saveDiag({ step: "no_existing_subscription" });
              }

              const token2 = await getToken(messaging, {
                vapidKey,
                serviceWorkerRegistration: swReg,
              }).catch(async (e2: unknown) => {
                const msg2 =
                  e2 instanceof Error ? e2.message : typeof e2 === "string" ? e2 : JSON.stringify(e2);
                await saveDiag({ step: "gettoken_retry_failed", error: msg2 });
                return null;
              });

              if (token2) {
                await saveDiag({ step: "gettoken_retry_ok", tokenOk: true });
                return token2;
              }
            } catch (e3: any) {
              await saveDiag({ step: "retry_exception", error: String(e3?.message || e3) });
            }
          }

          return null;
        });

    diag.tokenOk = !!token;
    await saveDiag({ step: "token_result", tokenOk: !!token });
    if (!token) return;

    await setDoc(
      doc(firestore, "users", uid, "fcmTokens", token),
      { token, platform: "web", updatedAt: serverTimestamp(), createdAt: serverTimestamp() },
      { merge: true }
    );

    await saveDiag({ step: "token_saved" });
  } catch (e: any) {
    await saveDiag({ step: "fatal", error: String(e?.message || e || "fatal") });
  }
}
