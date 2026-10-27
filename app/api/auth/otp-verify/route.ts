export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { signSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/panelSession'
import { rateLimit } from '@/lib/crm/auth'

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { kullanici_adi, otp } = await req.json()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (typeof kullanici_adi !== 'string' || typeof otp !== 'string' || !rateLimit(`otpv:${kullanici_adi}`, 5, 10 * 60_000) || !rateLimit(`otpv-ip:${ip}`, 20, 10 * 60_000)) {
    return NextResponse.json({ ok: false, error: 'Çok fazla deneme. Birkaç dakika sonra tekrar deneyin.' }, { status: 429 })
  }

  const { data: user } = await supabase
    .from('kullanicilar')
    .select('id, ad, rol')
    .eq('kullanici_adi', kullanici_adi)
    .eq('aktif', true)
    .single()

  if (!user) return NextResponse.json({ ok: false, error: 'Kullanıcı bulunamadı' })

  const { data: code } = await supabase
    .from('otp_codes')
    .select('otp, expires_at, used')
    .eq('kullanici_id', user.id)
    .eq('used', false)
    .single()

  if (!code) return NextResponse.json({ ok: false, error: 'Kod bulunamadı' })
  if (new Date(code.expires_at) < new Date()) return NextResponse.json({ ok: false, error: 'Kod süresi doldu' })
  if (code.otp !== otp) return NextResponse.json({ ok: false, error: 'Kod hatalı' })

  await supabase.from('otp_codes').update({ used: true }).eq('kullanici_id', user.id)
  await supabase.from('kullanicilar').update({ son_giris: new Date().toISOString() }).eq('id', user.id)

  const session = await signSession({ id: user.id, ad: user.ad, rol: user.rol, kullanici_adi })
  
  const res = NextResponse.json({ ok: true })
  res.cookies.set(SESSION_COOKIE, session, { httpOnly: true, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: SESSION_MAX_AGE, sameSite: 'lax' })
  return res
}
