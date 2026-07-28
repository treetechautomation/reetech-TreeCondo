/** @type {import('next').NextConfig} */

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.DISABLE_PWA === "1" || !!process.env.GCLOUD_PROJECT || !!process.env.FIREBASE_CONFIG,
  register: true,
  skipWaiting: true,
  importScripts: ["/firebase-messaging-sw.js"],
  buildExcludes: [/app-build-manifest\.json$/],
});

const nextConfig = {
  // ✅ Corrige warning de múltiplos lockfiles — aponta a raiz correta do workspace
  outputFileTracingRoot: "/var/www/treecondo",

  experimental: {
    // Next 15: serverExternalPackages para libs Node-only (Genkit, firebase-admin)
    serverExternalPackages: ["genkit", "@genkit-ai/google-genai", "firebase-admin"],
  },

  // ✅ App Hosting: injeta a config no bundle do client em build-time
  env: {
    NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG:
      process.env.FIREBASE_WEBAPP_CONFIG ||
      process.env.NEXT_PUBLIC_FIREBASE_WEBAPP_CONFIG ||
      "",
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "firebasestorage.googleapis.com" },
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
  },
};

module.exports = withPWA(nextConfig);
