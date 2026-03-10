import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    // ✅ PAKAI INI (Remote Patterns)
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
        port: '3000',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.agri-x.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**.api.co.id',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '**',
        pathname: '/**',
      },
    ],
  },
  env: {
    NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000',
    NEXT_PUBLIC_API_CO_ID_KEY: process.env.NEXT_PUBLIC_API_CO_ID_KEY || '',
  },
};

export default nextConfig;