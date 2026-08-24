export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { kullanici_adi, otp } = await req.json()

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

  const session = Buffer.from(JSON.stringify({ id: user.id, ad: user.ad, rol: user.rol, kullanici_adi })).toString('base64')
  
  const res = NextResponse.json({ ok: true })
  res.cookies.set('rb_session', session, {
    httpOnly: true,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
    sameSite: 'lax'
  })
  return res
}
