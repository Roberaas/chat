import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const ROL_YETKILER: Record<string, string[]> = {
  admin: [],
  operasyon: ['/', '/siparisler', '/musteriler', '/satis', '/abonelikler', '/odemeler', '/muhasebe', '/harita', '/calisma', '/raporlar', '/takvim'],
  destek: ['/', '/konusmalar', '/canli-destek', '/calisma', '/takvim'],
}

export function middleware(request: NextRequest) {
  const auth = request.cookies.get('rb_session') || request.cookies.get('roberto-auth') || request.cookies.get('roberto-admin-auth')
  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login'

  // Auth yoksa login'e yönlendir
  if (!auth && !isLoginPage) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Auth varken login'e girmeye çalışıyorsa ana sayfaya yönlendir
  // logout=1 parametresi varsa yönlendirme — çıkış akışı
  const isLogout = request.nextUrl.searchParams.get('logout') === '1'
  if (auth && isLoginPage && !isLogout) {
    return NextResponse.redirect(new URL('/', request.url))
  }

  // Rol kontrolü - sadece auth varsa
  if (auth) {
    try {
      const value = auth.value
      // Cookie değeri JSON mu kontrol et
      if (value && value.startsWith('{')) {
        const user = JSON.parse(value)
        const rol = user?.rol || 'admin' // default admin - güvenli taraf

        if (rol !== 'admin' && ROL_YETKILER[rol]) {
          const izinliSayfalar = ROL_YETKILER[rol]
          const izinli = izinliSayfalar.some(s =>
            s === '/' ? pathname === '/' : pathname.startsWith(s)
          )
          if (!izinli) {
            return NextResponse.redirect(new URL('/', request.url))
          }
        }
      }
      // JSON değilse (eski format) geçir - güvenli taraf
    } catch {
      // Parse hatası - kullanıcıyı geçir, sayfayı göster
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|tv).*)'],
}
