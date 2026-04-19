/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['three', 'react-globe.gl'],
  experimental: {
    esmExternals: 'loose',
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: 'canvas' }];
    return config;
  },
};

module.exports = nextConfig;
