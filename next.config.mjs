/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // This is required for Next.js to not throw errors when running on Fleek.
    // TODO: Remove this when Fleek fixes this.
    serverComponentsExternalPackages: ['@genkit-ai/google-genai'],
    allowedDevOrigins: [
      'http://localhost:9000',
      `https://*.cluster-zhw3w37rxzgkutusbbhib6qhra.cloudworkstations.dev`,
    ],
  },
};

export default nextConfig;
