/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    'http://100.90.81.105:3003',
    'https://layers-mac-mini.tailae4663.ts.net',
    'http://layers-mac-mini.tailae4663.ts.net',
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
