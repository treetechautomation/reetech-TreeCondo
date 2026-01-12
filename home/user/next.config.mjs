/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    allowedDevOrigins: [
      "http://localhost:9000",
      "https://9000-firebase-studio-1765514223122.cluster-zhw3w37rxzgkutusbbhib6qhra.cloudworkstations.dev",
    ],
  },
};

export default nextConfig;
