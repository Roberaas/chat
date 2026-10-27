export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import crypto from 'crypto'
import { rateLimit } from '@/lib/crm/auth'


function hashSifre(sifre: string) {
  return crypto.createHash('sha256').update(sifre).digest('hex')
}

function maskPhone(phone: string) {
  const p = phone.replace(/\D/g, '')
  return p.slice(0, 3) + '****' + p.slice(-3)
}

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
  const { kullanici_adi, sifre } = await req.json()
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (typeof kullanici_adi !== 'string' || typeof sifre !== 'string' || !rateLimit(`otps:${kullanici_adi}`, 5, 10 * 60_000) || !rateLimit(`otps-ip:${ip}`, 20, 10 * 60_000)) {
    return NextResponse.json({ ok: false, error: 'Çok fazla deneme. Birkaç dakika sonra tekrar deneyin.' }, { status: 429 })
  }

  const { data: user } = await supabase
    .from('kullanicilar')
    .select('id, telefon, aktif')
    .eq('kullanici_adi', kullanici_adi)
    .in('sifre_hash', [hashSifre(sifre), crypto.createHash('sha256').update(sifre + 'roberto-salt-2024').digest('hex')])
    .eq('aktif', true)
    .single()

  if (!user) return NextResponse.json({ ok: false, error: 'Kullanıcı adı veya şifre hatalı' })
  if (!user.telefon) return NextResponse.json({ ok: false, error: 'Telefon numarası kayıtlı değil' })

  const otp = crypto.randomInt(100000, 1000000).toString()
  const expires = new Date(Date.now() + 5 * 60 * 1000).toISOString()

  await supabase.from('otp_codes').upsert({
    kullanici_id: user.id, otp, expires_at: expires, used: false
  }, { onConflict: 'kullanici_id' })

  const phone = user.telefon.replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '')
  const smsUrl = `https://api.netgsm.com.tr/sms/send/get/?usercode=${encodeURIComponent(process.env.NETGSM_USERCODE || '')}&password=${encodeURIComponent(process.env.NETGSM_PASSWORD || '')}&gsmno=${phone}&message=${encodeURIComponent('Roberto Admin giris kodu: ' + otp)}&msgheader=${encodeURIComponent(process.env.NETGSM_MSGHEADER || '')}`

  try {
    const smsRes = await fetch(smsUrl)
    const txt = await smsRes.text()
    console.log('Netgsm:', txt)
  } catch (e) { console.error('SMS hatası:', e) }

  return NextResponse.json({ ok: true, masked_phone: maskPhone(user.telefon) })
}
