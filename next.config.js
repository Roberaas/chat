/** @type {import('next').NextConfig} */
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), geolocation=(), payment=(), usb=()' },
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
]
// Tam CSP önce yalnızca raporlanır (hiçbir şeyi engellemez); /api/csp-report ihlalleri Vercel günlüğüne yazar.
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "report-uri /api/csp-report",
].join('; ')
// Sayfaları bozmayan, hemen uygulanan kısım
const cspEnforced = "frame-ancestors 'self'; base-uri 'self'; object-src 'none'; form-action 'self'"
securityHeaders.push({ key: 'Content-Security-Policy', value: cspEnforced }, { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly })
const nextConfig = {
  // next/image kullanılmıyor: Görsel Optimizasyon uç noktası (/_next/image) kapatıldı
  images: { unoptimized: true },
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/api/crm/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ]
  },
}

module.exports = nextConfig
