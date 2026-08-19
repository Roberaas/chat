import { NextResponse } from 'next/server'

// n8n bu endpoint'i çağırır: müşteri canlı destek istediğinde
// body: { musteri_adi, phone, thread_ts }
export async function POST(req: Request) {
  const body = await req.json()
  const { musteri_adi, phone, thread_ts } = body

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://chat.robertobravo.com'
  const mertGsm = process.env.MERT_GSM // Vercel env'den alınacak

  const title = '🔔 Canlı Destek Talebi'
  const bildirimBody = `${musteri_adi || 'Müşteri'} (${phone || ''}) canlı destek istiyor`

  // 1) Push bildirimi gönder
  try {
    await fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        body: bildirimBody,
        url: '/dashboard/canli-destek',
        tag: `canli-destek-${phone}`
      })
    })
  } catch (_) {}

  // 2) SMS gönder
  if (mertGsm) {
    try {
      await fetch(`${baseUrl}/api/sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tel: mertGsm,
          mesaj: `${title}: ${musteri_adi || 'Müşteri'} (${phone}) canlı destek istiyor. chat.robertobravo.com`
        })
      })
    } catch (_) {}
  }

  return NextResponse.json({ ok: true })
}
