function getFirebaseWebConfig() {
  // 1) Preferência: NEXT_PUBLIC_* (dev/local)
  const hasNextPublic = Boolean(
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  );

  if (hasNextPublic) {
    return {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    };
  }

  // 2) Fallback do App Hosting (BUILD): FIREBASE_WEBAPP_CONFIG vem como JSON
  const raw = process.env.FIREBASE_WEBAPP_CONFIG;
  if (raw) {
    try {
      const cfg = JSON.parse(raw);
      return {
        apiKey: cfg.apiKey,
        authDomain: cfg.authDomain,
        projectId: cfg.projectId,
        storageBucket: cfg.storageBucket,
        messagingSenderId: cfg.messagingSenderId,
        appId: cfg.appId,
      };
    } catch {
      // se o JSON vier zoado, cai no null
    }
  }

  return null;
}
