import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { crmMiddleware } from '@/lib/crm/supabase/middleware'

const ROL_YETKILER: Record<string, string[]> = {
  admin: [],
  operasyon: ['/', '/siparisler', '/musteriler', '/satis', '/abonelikler', '/odemeler', '/muhasebe', '/harita', '/calisma', '/raporlar', '/takvim'],
  destek: ['/', '/konusmalar', '/canli-destek', '/calisma', '/takvim'],
}

import { verifySession, verifyInternal, SESSION_COOKIE } from '@/lib/panelSession'

// Oturum gerektirmeyen API'ler: giriş akışı, CRM (kendi yetki kontrolü var), n8n çağrısı (rota içinde ayrıca korunur)
const API_PUBLIC = ['/api/auth', '/api/crm/', '/api/canli-destek-bildirim', '/api/csp-report']
// Yalnızca admin rolü
const ADMIN_ONLY = ['/api/kullanici', '/api/aktivite', '/kullanicilar', '/api/kullanim', '/api-kullanimi', '/api/rapor-ilet', '/api/sms', '/api/bildirim/toplu']

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname
  // CRM (Supabase Auth) — WhatsApp paneli cookie girişinden tamamen ayrı
  if (pathname === '/crm' || pathname.startsWith('/crm/')) return crmMiddleware(request)

  const isApi = pathname.startsWith('/api/')
  if (isApi && API_PUBLIC.some(p => pathname === p || pathname.startsWith(p.endsWith('/') ? p : p + '/') || pathname === p)) return NextResponse.next()

  const user = await verifySession(request.cookies.get(SESSION_COOKIE)?.value)

  if (isApi) {
    if (!user && !(await verifyInternal(request.headers.get('x-internal-token')))) {
      return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
    }
    if (ADMIN_ONLY.some(p => pathname.startsWith(p)) && user && user.rol !== 'admin') {
      return NextResponse.json({ ok: false, error: 'Yetkiniz yok' }, { status: 403 })
    }
    return NextResponse.next()
  }

  const isLoginPage = pathname === '/login'
  if (!user && !isLoginPage) return NextResponse.redirect(new URL('/login', request.url))

  // logout=1 ile gelindiyse login'e izin ver
  const isLogout = request.nextUrl.searchParams.get('logout') === '1'
  if (user && isLoginPage && !isLogout) return NextResponse.redirect(new URL('/', request.url))

  if (user && user.rol !== 'admin') {
    const izinli = ROL_YETKILER[user.rol]
    if (!izinli) return NextResponse.redirect(new URL('/login?logout=1', request.url))
    if (!isLoginPage && !izinli.some(s => (s === '/' ? pathname === '/' : pathname.startsWith(s)))) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|tv).*)'],
}
