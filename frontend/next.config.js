/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  async rewrites() {
    // Proxy API requests to the backend
    // In Docker: frontend container can reach backend via container name
    // On host: falls back to localhost
    const backendUrl = process.env.BACKEND_URL || 'http://libertas-backend:8000';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
