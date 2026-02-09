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
    allowedDevOrigins: [
      "https://*.cloudworkstations.dev",
      "http://localhost:9002",
      "http://localhost:9200",
    ],
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
