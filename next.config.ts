import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The /embed route is loaded inside an <iframe> on third-party sites,
  // so we must NOT send X-Frame-Options DENY for it. Allow framing globally
  // (the chat is meant to be embedded anywhere).
  async headers() {
    return [
      {
        source: '/embed',
        headers: [
          { key: 'Content-Security-Policy', value: 'frame-ancestors *' },
        ],
      },
      {
        source: '/widget.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=300, must-revalidate' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
        ],
      },
    ];
  },
};

export default nextConfig;
