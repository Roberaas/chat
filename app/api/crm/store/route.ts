export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { apiGuard, rateLimit } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'
import { adminCrm, sendSms } from '@/lib/crm/sms'

const err = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })
const code6 = () => crypto.randomInt(100000, 1000000).toString()
const s = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '')

// Mağaza personeli: kayıt başlat / doğrula, ticari ileti izni başlat / doğrula
export async function POST(req: Request) {
  const g = await apiGuard('customers.register')
  if ('res' in g) return g.res
  const { ctx } = g
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return err('Geçersiz istek') }
  const action = s(b.action, 30)
  const db = createCrmServerClient()

  if (action === 'register-start') {
    if (!rateLimit(`reg:${ctx.userId}`, 20, 10 * 60_000)) return err('Çok fazla deneme, biraz bekleyin', 429)
    const code = code6()
    const phone = s(b.phone, 30)
    const { data, error } = await adminCrm().rpc('start_registration', {
      p_user: ctx.userId, p_code: code, p_first: s(b.first, 80), p_last: s(b.last, 80), p_phone: phone,
      p_email: s(b.email, 120) || null, p_city: s(b.city, 60) || null, p_birth: s(b.birth, 10) || null, p_notice_ack: b.noticeAck === true,
    })
    if (error) return err(error.message.replace(/^.*?:\s*/, ''), 400)
    if (data?.status !== 'code_sent') return NextResponse.json({ ok: true, ...data })
    const sent = await sendSms(phone, `Roberto Bravo: Telefon dogrulama kodunuz ${code}. Yalnizca magaza calisanimiza soyleyin. Bu kod ticari ileti izni yerine gecmez.`)
    if (!sent) return err('SMS gönderilemedi, numarayı kontrol edin', 502)
    return NextResponse.json({ ok: true, status: 'code_sent', pendingId: data.pending_id })
  }

  if (action === 'register-verify') {
    if (!rateLimit(`regv:${ctx.userId}`, 30, 10 * 60_000)) return err('Çok fazla deneme', 429)
    const { data, error } = await db.rpc('finalize_registration', { p_pending: s(b.pendingId, 40), p_code: s(b.code, 10) })
    if (error) return err(error.message.replace(/^.*?:\s*/, ''))
    return NextResponse.json({ ok: true, ...data })
  }

  if (action === 'register-email') {
    const { data, error } = await db.rpc('register_customer', {
      p_first: s(b.first, 80), p_last: s(b.last, 80), p_phone: null, p_email: s(b.email, 120), p_city: s(b.city, 60) || null,
      p_birth: s(b.birth, 10) || null, p_link: b.link === true,
    })
    if (error) return err(error.message.replace(/^.*?:\s*/, ''))
    return NextResponse.json({ ok: true, ...data })
  }

  if (action === 'consent-start') {
    if (!rateLimit(`cons:${ctx.userId}`, 15, 10 * 60_000)) return err('Çok fazla deneme', 429)
    const channels = Array.isArray(b.channels) ? (b.channels as unknown[]).filter((c): c is string => typeof c === 'string') : []
    const code = code6()
    const { data, error } = await adminCrm().rpc('start_consent', { p_user: ctx.userId, p_code: code, p_customer: s(b.customerId, 40), p_channels: channels })
    if (error) return err(error.message.replace(/^.*?:\s*/, ''))
    const sent = await sendSms(data.phone, `Roberto Bravo: Kampanya ve tanitim mesajlari (ticari ileti) gonderilmesine IZIN vermek icin kodunuz ${code}. Izin istege baglidir, vermek zorunda degilsiniz. Istemiyorsaniz kodu paylasmayin.`)
    if (!sent) return err('SMS gönderilemedi', 502)
    return NextResponse.json({ ok: true, status: 'code_sent', pendingId: data.pending_id })
  }

  if (action === 'consent-verify') {
    const { data, error } = await db.rpc('confirm_consent', { p_pending: s(b.pendingId, 40), p_code: s(b.code, 10) })
    if (error) return err(error.message.replace(/^.*?:\s*/, ''))
    if (data?.status === 'granted' && data.phone) {
      await sendSms(data.phone, 'Roberto Bravo: Ticari ileti izniniz kaydedildi. Izni istediginiz zaman Iletisim Yonetim Sistemi (IYS) uzerinden veya magazamiza basvurarak ucretsiz geri alabilirsiniz.')
    }
    return NextResponse.json({ ok: true, status: data?.status, left: data?.left, channels: data?.channels })
  }

  if (action === 'check') {
    const { data, error } = await db.rpc('check_customer_exists', { p_phone: s(b.phone, 30) || null, p_email: s(b.email, 120) || null })
    if (error) return err(error.message.replace(/^.*?:\s*/, ''))
    return NextResponse.json({ ok: true, result: data })
  }

  if (action === 'search') {
    if (!rateLimit(`srch:${ctx.userId}`, 60, 60_000)) return err('Çok fazla arama', 429)
    const { data, error } = await db.rpc('staff_search_customers', { p_q: s(b.q, 60) })
    if (error) return err(error.message.replace(/^.*?:\s*/, ''))
    return NextResponse.json({ ok: true, rows: data })
  }

  if (action === 'legal') {
    const { data, error } = await db.rpc('get_legal_texts')
    if (error) return err(error.message.replace(/^.*?:\s*/, ''))
    return NextResponse.json({ ok: true, texts: data })
  }
  return err('Bilinmeyen işlem')
}
