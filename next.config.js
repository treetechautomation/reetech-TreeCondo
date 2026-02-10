/** @type {import('next').NextConfig} */

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig = {
  experimental: {
    // Next 15 mostra warning, mas ele entende e habilita o experimento.
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
