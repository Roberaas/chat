import { NextResponse } from 'next/server'

const NETGSM_USERCODE = '8503027762'
const NETGSM_PASSWORD = 'A1.95T3v'
const NETGSM_MSGHEADER = 'RobertoBravo'

export async function POST(req: Request) {
  const { mesaj, tel } = await req.json()
  // tel yoksa Mert'in numarasına gönder (operasyonel bildirim)
  const gsm = tel || process.env.MERT_GSM || '905392993103'

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
