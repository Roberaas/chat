export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getCrmContext, smsRequired, smsVerified } from '@/lib/crm/auth'
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/panelSession'

// CRM'de SMS ile doğrulanmış kullanıcıyı, e-postası eşleşen panel kullanıcısı olarak panele geçirir.
export async function GET(req: Request) {
  const origin = new URL(req.url).origin
  const site = req.headers.get('sec-fetch-site')
  if (site && site !== 'same-origin' && site !== 'none') return NextResponse.redirect(`${origin}/crm`)

  const ctx = await getCrmContext()
  if (!ctx || !ctx.profile.is_active) return NextResponse.redirect(`${origin}/crm/login`)
  if (!smsRequired(ctx) || !(await smsVerified(ctx))) return NextResponse.redirect(`${origin}/login`)

  const email = String(ctx.profile.email || '').trim().toLowerCase()
  if (!email) return NextResponse.redirect(`${origin}/login`)
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const { data: u } = await db.from('kullanicilar').select('id, ad, rol, kullanici_adi').eq('eposta', email).eq('aktif', true).maybeSingle()
  if (!u) return NextResponse.redirect(`${origin}/login`)

  const res = NextResponse.redirect(`${origin}/`)
  res.cookies.set(SESSION_COOKIE, await signSession({ id: u.id, ad: u.ad, rol: u.rol, kullanici_adi: u.kullanici_adi }), {
    httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_MAX_AGE, sameSite: 'lax',
  })
  return res
}
