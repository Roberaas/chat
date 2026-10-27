import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

// /crm için oturum yenileme + kimlik doğrulama kapısı.
// Yetkilendirme (rol/mağaza) burada DEĞİL, sunucu tarafında ve RLS'te yapılır.
const PUBLIC = ['/crm/login']

export async function crmMiddleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          list.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  if (!user && !PUBLIC.includes(path)) {
    const url = new URL('/crm/login', request.url)
    if (path !== '/crm') url.searchParams.set('next', path)
    return NextResponse.redirect(url)
  }
  return response
}
