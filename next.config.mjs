/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Isso previne erros de CORS no ambiente de desenvolvimento do Firebase Studio.
    allowedDevOrigins: [
      "http://localhost:9002",
      "https://*.cluster-zhw3w37rxzgkutusbbhib6qhra.cloudworkstations.dev",
    ],
  },
};

export default nextConfig;
