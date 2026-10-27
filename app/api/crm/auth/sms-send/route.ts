export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCrmContext, rateLimit, smsRequired } from '@/lib/crm/auth'
import { adminDb } from '@/lib/serverDb'
import { createCrmAdminClient } from '@/lib/crm/supabase/admin'

export async function POST() {
  const ctx = await getCrmContext()
  if (!ctx || !ctx.profile.is_active) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  if (!smsRequired(ctx)) return NextResponse.json({ ok: true, skip: true })
  if (!rateLimit(`crmsms:${ctx.userId}`, 5, 10 * 60_000)) return NextResponse.json({ ok: false, error: 'Çok fazla deneme. Birkaç dakika bekleyin.' }, { status: 429 })
  const phoneRaw = (ctx.profile as { phone?: string | null }).phone
  if (!phoneRaw) return NextResponse.json({ ok: false, error: 'Hesapta telefon numarası kayıtlı değil. Yöneticiye başvurun.' }, { status: 400 })
  const db = adminDb()
  const { data: prev } = await db.from('crm_otp').select('sent_at, used').eq('user_id', ctx.userId).maybeSingle()
  if (prev && !prev.used && Date.now() - new Date(prev.sent_at).getTime() < 60_000) {
    return NextResponse.json({ ok: false, error: 'Kod az önce gönderildi. 1 dakika sonra tekrar deneyin.' }, { status: 429 })
  }
  const code = crypto.randomInt(100000, 1000000).toString()
  const hash = crypto.createHash('sha256').update(`${ctx.userId}:${code}`).digest('hex')
  await db.from('crm_otp').upsert({ user_id: ctx.userId, code_hash: hash, expires_at: new Date(Date.now() + 5 * 60_000).toISOString(), attempts: 0, used: false, sent_at: new Date().toISOString() }, { onConflict: 'user_id' })
  const norm = (x: string) => x.replace(/\D/g, '').replace(/^90/, '').replace(/^0/, '')
  const phone = norm(phoneRaw)
  const { data: ex } = await createCrmAdminClient().from('profiles').select('sms_extra_phones').eq('id', ctx.userId).maybeSingle()
  const alici = Array.from(new Set([phone, ...((ex?.sms_extra_phones as string[] | null) || []).map(norm)])).filter(x => /^\d{10}$/.test(x))
  const msg = `Roberto CRM giris kodunuz: ${code}`
  const url = `https://api.netgsm.com.tr/sms/send/get/?usercode=${encodeURIComponent(process.env.NETGSM_USERCODE || '')}&password=${encodeURIComponent(process.env.NETGSM_PASSWORD || '')}&gsmno=${alici.join(',')}&message=${encodeURIComponent(msg)}&msgheader=${encodeURIComponent(process.env.NETGSM_MSGHEADER || '')}`
  try {
    const txt = await (await fetch(url)).text()
    if (!/^0[0-9]/.test(txt.trim()) && !txt.trim().startsWith('00')) console.error('Netgsm CRM:', txt)
  } catch (e) { console.error('SMS hatası:', e); return NextResponse.json({ ok: false, error: 'SMS gönderilemedi' }, { status: 502 }) }
  const p = phone.padStart(10, '0')
  return NextResponse.json({ ok: true, masked: `0${p.slice(0, 3)} *** ** ${p.slice(-2)}` })
}
