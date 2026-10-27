export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { rateLimit } from '@/lib/crm/auth'

// Tarayıcıların CSP ihlal raporları (yalnız günlüğe yazılır; veri saklanmaz)
export async function POST(req: Request) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`csp:${ip}`, 30, 60_000)) return new NextResponse(null, { status: 204 })
  try {
    const text = (await req.text()).slice(0, 2000)
    console.warn('[csp-report]', text)
  } catch { /* yok say */ }
  return new NextResponse(null, { status: 204 })
}
