/** @type {import('next').NextConfig} */

// Bundle analyzer configuration for bulletproof monitoring (conditional loading)
let withBundleAnalyzer;
try {
  // Only attempt to load bundle analyzer in development or when explicitly requested
  if (process.env.NODE_ENV === 'development' || process.env.ANALYZE === 'true') {
    withBundleAnalyzer = require('@next/bundle-analyzer')({
      enabled: process.env.ANALYZE === 'true',
    });
  } else {
    withBundleAnalyzer = (config) => config;
  }
} catch (error) {
  // Fallback if @next/bundle-analyzer is not available (production builds)
  console.warn('Bundle analyzer not available, using fallback...');
  withBundleAnalyzer = (config) => config;
}

const nextConfig = {
  // 🛡️ BULLETPROOF TYPE SAFETY - NO TOLERANCE FOR ERRORS
  typescript: {
    // CHANGED: Block builds with type errors (was: ignoreBuildErrors: true)
    ignoreBuildErrors: false,
  },
  eslint: {
    // CHANGED: Block builds with ESLint errors (was: ignoreDuringBuilds: true)
    ignoreDuringBuilds: false,
    dirs: ['src'], // Only lint src directory
  },

  // Performance optimizations
  experimental: {
    optimizeCss: true,
    optimizePackageImports: [
      'lucide-react',
      '@heroicons/react',
      'react-icons',
      'apexcharts',
      'react-apexcharts',
      '@tanstack/react-query',
    ],
  },

  // Enhanced webpack configuration
  webpack: (config, { buildId, dev, isServer, defaultLoaders, webpack }) => {
    // Docker hot reload optimization (keep existing)
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      }
    }

    // Bundle size monitoring and type safety enforcement
    if (!dev && !isServer) {
      // Bundle size limits (STRICT)
      const BUNDLE_SIZE_LIMITS = {
        maxAssetSize: 362000, // 362 KB target (was 500KB)
        maxEntrypointSize: 362000, // 362 KB target per entry point
      };

      config.performance = {
        ...config.performance,
        maxAssetSize: BUNDLE_SIZE_LIMITS.maxAssetSize,
        maxEntrypointSize: BUNDLE_SIZE_LIMITS.maxEntrypointSize,
        assetFilter: (assetFilename) => {
          return assetFilename.endsWith('.js');
        },
      };

      // Advanced code splitting for large libraries
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          ...config.optimization.splitChunks,
          chunks: 'all',
          cacheGroups: {
            ...config.optimization.splitChunks.cacheGroups,
            // ApexCharts vendor chunk
            apexcharts: {
              test: /[\\/]node_modules[\\/](apexcharts|react-apexcharts)[\\/]/,
              name: 'apexcharts',
              chunks: 'all',
              priority: 30,
              reuseExistingChunk: true,
            },
            // React Query vendor chunk  
            reactQuery: {
              test: /[\\/]node_modules[\\/]@tanstack[\\/]react-query[\\/]/,
              name: 'react-query',
              chunks: 'all',
              priority: 25,
              reuseExistingChunk: true,
            },
            // Lucide icons chunk
            icons: {
              test: /[\\/]node_modules[\\/]lucide-react[\\/]/,
              name: 'icons',
              chunks: 'all',
              priority: 20,
              reuseExistingChunk: true,
            },
            // Common vendor libraries
            vendor: {
              test: /[\\/]node_modules[\\/]/,
              name: 'vendors',
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      };

      // Build ID for tracking
      config.plugins.push(
        new webpack.DefinePlugin({
          'process.env.BUILD_ID': JSON.stringify(buildId),
        })
      );
    }

    // TypeScript strict mode enforcement
    if (config.module && config.module.rules) {
      const tsRule = config.module.rules.find(
        (rule) => rule.test && rule.test.toString().includes('tsx?')
      );

      if (tsRule && tsRule.use) {
        const tsLoader = Array.isArray(tsRule.use) 
          ? tsRule.use.find(loader => 
              typeof loader === 'object' && 
              loader.loader && 
              loader.loader.includes('typescript')
            )
          : tsRule.use;

        if (tsLoader && typeof tsLoader === 'object' && tsLoader.options) {
          tsLoader.options = {
            ...tsLoader.options,
            compilerOptions: {
              ...tsLoader.options.compilerOptions,
              strict: true,
              noImplicitAny: true,
              strictNullChecks: true,
              noImplicitReturns: true,
              noFallthroughCasesInSwitch: true,
            },
          };
        }
      }
    }

    return config;
  },

  // Environment variables for feature flags
  env: {
    NEXT_PUBLIC_FEATURE_FLAGS_ENABLED: process.env.NODE_ENV === 'development' ? 'true' : 'false',
  },

  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },

  // Transpile the shared module (keep existing)
  transpilePackages: ['@portfolio-tracker/shared'],
}

module.exports = withBundleAnalyzer(nextConfig); 