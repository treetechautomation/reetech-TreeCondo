/** @type {import('next').NextConfig} */
const nextConfig = {
  // A diretiva `allowedDevOrigins` deve estar no nível superior, não dentro de `experimental`.
  allowedDevOrigins: [
    'http://localhost:9000',
    'http://localhost:9002',
    'https://*.cloudworkstations.dev',
  ],
  experimental: {
    // O objeto experimental permanece, caso seja necessário para outras flags no futuro.
  },
};

export default nextConfig;
