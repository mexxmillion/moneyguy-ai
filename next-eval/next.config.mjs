/** @type {import('next').NextConfig} */
const nextConfig = {
  // Allow Tailscale remote access in dev
  allowedDevOrigins: [
    '100.90.81.105',
    '100.90.81.105:3003',
    'layers-mac-mini.tailae4663.ts.net',
    'layers-mac-mini.tailae4663.ts.net:3003',
    '192.168.50.41',
    '192.168.50.41:3003',
  ],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3002/api/:path*',
      },
    ];
  },
};

export default nextConfig;
