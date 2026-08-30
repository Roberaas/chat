export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

const NETGSM_USERCODE = '***KULLANICI-KODU-KALDIRILDI***'
const NETGSM_PASSWORD = '***SIFRE-KALDIRILDI***'
const NETGSM_MSGHEADER = 'ROBERTOBRVO'

export async function POST(req: Request) {
  const { mesaj, tel } = await req.json()
  // tel yoksa Mert'in numarasına gönder (operasyonel bildirim)
  const gsm = tel || process.env.MERT_GSM || '905000000000'

  const url = `https://api.netgsm.com.tr/sms/send/get/?usercode=${NETGSM_USERCODE}&password=${NETGSM_PASSWORD}&gsmno=${gsm}&message=${encodeURIComponent(mesaj)}&msgheader=${NETGSM_MSGHEADER}`

  try {
    const res = await fetch(url)
    const text = await res.text()
    // Netgsm başarı: "00 ..." ile başlar
    const ok = text.trim().startsWith('00')
    return NextResponse.json({ ok, response: text.trim() })
  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 })
  }
}
