/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // Permite que o servidor de desenvolvimento do Next.js aceite requisições
    // do proxy do Firebase Studio, resolvendo erros de CORS e problemas com HMR/WebSocket.
    allowedDevOrigins: [
      "http://localhost:9002",
      "https://*.cloudworkstations.dev",
    ],
  },
};

export default nextConfig;
