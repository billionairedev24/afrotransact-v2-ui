/** @type {import('next').NextConfig} */

// Headers are evaluated at build time for standalone builds.
// Use ENFORCE_HTTPS=true in production deployments to enable upgrade-insecure-requests and HSTS.
const enforceHttps = process.env.ENFORCE_HTTPS === 'true'

const cspDirectives = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://maps.googleapis.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  `img-src 'self' data: blob: https://cdn.afrotransact.com https://images.unsplash.com https://maps.gstatic.com https://maps.googleapis.com https://utfs.io https://*.ufs.sh https://*.uploadthing.com https://*.ingest.uploadthing.com`,
  "font-src 'self' https://fonts.gstatic.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  `connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080'} https://api.afrotransact.com https://api.stripe.com https://maps.googleapis.com https://utfs.io https://*.ufs.sh https://*.uploadthing.com https://*.ingest.uploadthing.com http://localhost:* ws://localhost:*`,
  "media-src 'self' https://cdn.afrotransact.com",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  enforceHttps ? "upgrade-insecure-requests" : "",
].filter(Boolean).join('; ')

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  ...(enforceHttps ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }] : []),
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(self), geolocation=(self), payment=(self "https://js.stripe.com")',
  },
  { key: 'Content-Security-Policy', value: cspDirectives },
]

const nextConfig = {
  // Use standalone output for custom server deployments (e.g. Docker), 
  // but let Vercel handle output optimization automatically.
  ...(process.env.VERCEL ? {} : { output: 'standalone' }),
  
  // Set tracing root only if not on Vercel to avoid manifest path issues.
  ...(process.env.VERCEL ? {} : { outputFileTracingRoot: require('path').join(__dirname, '../') }),

  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [32, 48, 64, 80, 96, 128, 256, 384],
    remotePatterns: [
      { protocol: 'https', hostname: 'cdn.afrotransact.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'http', hostname: 'localhost' },
      { protocol: 'https', hostname: 'utfs.io' },
      { protocol: 'https', hostname: '*.ufs.sh' },
      { protocol: 'https', hostname: '*.uploadthing.com' },
      { protocol: 'https', hostname: '*.ingest.uploadthing.com' },
      { protocol: 'https', hostname: '**.amazonaws.com' },
      { protocol: 'https', hostname: '**.s3.amazonaws.com' },
    ],
  },

  experimental: {
    // Tree-shake barrel imports from heavy packages. Each entry here tells
    // Next.js to rewrite `import { X } from 'pkg'` into a direct deep import
    // so only the used symbols land in the bundle.
    optimizePackageImports: [
      'lucide-react',
      '@tanstack/react-query',
      '@tanstack/react-table',
      'date-fns',
      'sonner',
      'zod',
      'recharts',
      'react-icons',
    ],
  },
  reactStrictMode: true,
  poweredByHeader: false,
  productionBrowserSourceMaps: false,

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },

  async redirects() {
    return enforceHttps
      ? [{ source: '/(.*)', has: [{ type: 'header', key: 'x-forwarded-proto', value: 'http' }], destination: 'https://afrotransact.com/:path*', permanent: true }]
      : []
  },
}

module.exports = nextConfig
