export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { internalToken } from '@/lib/panelSession'
import { rateLimit } from '@/lib/crm/auth'
import { adminDb } from '@/lib/serverDb'

// n8n bu endpoint'i çağırır: müşteri canlı destek istediğinde
// body: { musteri_adi, phone, thread_ts }
export async function POST(req: Request) {
  // n8n çağrısı. PANEL_WEBHOOK_SECRET tanımlıysa x-webhook-secret başlığı zorunlu; tanımsızken de
  // yalnızca bilinen bir WhatsApp oturumu için ve telefon başına 5 dakikada bir çalışır (SMS/push suistimalini önler).
  const wh = process.env.PANEL_WEBHOOK_SECRET
  if (wh && req.headers.get('x-webhook-secret') !== wh) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const body = await req.json().catch(() => ({}))
  const { musteri_adi, phone, thread_ts } = body
  if (typeof phone !== 'string' || !/^[+\d]{8,20}$/.test(phone)) return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 })
  if (!rateLimit('cdb:all', 30, 60_000) || !rateLimit(`cdb:${phone}`, 1, 5 * 60_000)) return NextResponse.json({ ok: true, skipped: 'rate_limited' })
  const { data: knownRows } = await adminDb().from('wa_sessions_roberto').select('phone').in('phone', [phone, phone.replace(/\D/g, '')]).limit(1)
  if (!knownRows || knownRows.length === 0) return NextResponse.json({ ok: false, error: 'unknown_session' }, { status: 404 })
  const ih = { 'Content-Type': 'application/json', 'x-internal-token': await internalToken() }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chat.robertobravo.com'
  const mertGsm = process.env.MERT_GSM // Vercel env'den alınacak

  const title = '🔔 Canlı Destek Talebi'
  const bildirimBody = `${musteri_adi || 'Müşteri'} (${phone || ''}) canlı destek istiyor`

  // 1) Push bildirimi gönder
  try {
    await fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: ih,
      body: JSON.stringify({
        title,
        body: bildirimBody,
        url: '/canli-destek',
        tag: `canli-destek-${phone}`
      })
    })
  } catch (_) {}

  // 2) SMS gönder
  if (mertGsm) {
    try {
      await fetch(`${baseUrl}/api/sms`, {
        method: 'POST',
        headers: ih,
        body: JSON.stringify({
          tel: mertGsm,
          mesaj: `${title}: ${musteri_adi || 'Müşteri'} (${phone}) canlı destek istiyor. chat.robertobravo.com`
        })
      })
    } catch (_) {}
  }

  return NextResponse.json({ ok: true })
}
