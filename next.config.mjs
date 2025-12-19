/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
  // ✅ Optimizare imagini - LCP improvement 20-40%
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    minimumCacheTTL: 60 * 60 * 24 * 30, // 30 zile cache
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.supabase.co',
      },
    ],
  },
  
  // ✅ Optimizare bundle
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-icons',
      'date-fns',
      'recharts',
    ],
  },
  
  // ✅ Compression și headers
  compress: true,
  poweredByHeader: false,
  
  // ✅ Configurare pentru chunk loading pe mobil
  webpack: (config, { isServer, dev }) => {
    if (!isServer) {
      // Optimizare pentru chunk loading pe mobil
      config.optimization = {
        ...config.optimization,
        splitChunks: {
          chunks: 'all',
          cacheGroups: {
            default: false,
            vendors: false,
            // Vendor chunks mai mici pentru încărcare mai rapidă pe mobil
            vendor: {
              name: 'vendor',
              chunks: 'all',
              test: /node_modules/,
              priority: 20,
              maxSize: 244000, // ~240KB per chunk pentru mobil
            },
            common: {
              name: 'common',
              minChunks: 2,
              chunks: 'all',
              priority: 10,
              reuseExistingChunk: true,
            },
          },
        },
      }
      
      // Retry logic pentru chunk loading failures
      if (!dev) {
        config.output = {
          ...config.output,
          chunkLoadTimeout: 30000, // 30 secunde timeout pentru chunk loading
        }
      }
    }
    
    // Bundle analyzer în dev
    if (process.env.ANALYZE === 'true' && !isServer) {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: '../bundle-report.html',
          openAnalyzer: false,
        })
      )
    }
    
    return config
  },
}

export default nextConfig
