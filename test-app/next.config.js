/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // This is the correct placement for allowedDevOrigins in recent Next.js versions.
    // It enables secure communication with the development server from external tools like Firebase Studio.
    allowedDevOrigins: [
        'https://*.cloudworkstations.dev',
        'http://localhost:9002',
    ],
  },
};

module.exports = nextConfig;
