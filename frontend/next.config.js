/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    // Allows production builds to successfully complete even if
    // your project has type errors.
    ignoreBuildErrors: true,
  },
  eslint: {
    // Allows production builds to successfully complete even if
    // your project has ESLint errors.
    ignoreDuringBuilds: true,
  },
  // 🔥 Docker hot reload optimization
  webpack: (config, { dev }) => {
    if (dev) {
      // Enable polling for file changes in Docker environment
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }
    return config
  },
  // Transpile the shared module
  transpilePackages: ['@portfolio-tracker/shared'],
}

module.exports = nextConfig 