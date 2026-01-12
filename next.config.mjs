/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // This is required for Next.js to work with Firebase Studio.
    allowedDevOrigins: [
      'http://localhost:9000',
      `https://9000-${process.env.GITPOD_WORKSPACE_ID}.${process.env.GITPOD_WORKSPACE_CLUSTER_HOST}`
    ],
  },
};

export default nextConfig;
