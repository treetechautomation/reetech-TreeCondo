/** @type {import('next').NextConfig} */

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
});

const nextConfig = withPWA({
  experimental: {
    // This is the correct placement for allowedDevOrigins in recent Next.js versions.
    // It enables secure communication with the development server from external tools like Firebase Studio.
    allowedDevOrigins: [
        "https://*.cloudworkstations.dev",
        "http://localhost:9000",
    ],
  },
});

module.exports = nextConfig;
