import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { format, nextFriday, startOfDay } from 'date-fns'

function buHaftaninCumasi(): string {
  const bugun = startOfDay(new Date())
  const cuma = bugun.getDay() === 5 ? bugun : nextFriday(bugun)
  return format(cuma, 'yyyy-MM-dd')
}

export async function GET() {
  // Bu hafta bildirim gönderildi mi?
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const client = createClient(url, key)
  const hafta = buHaftaninCumasi()
  const { data } = await client.from('bildirim_log').select('*').eq('hafta_tarihi', hafta).single()
  return NextResponse.json({ gonderildi: !!data, log: data })
}

export async function POST(req: Request) {
  const { mesaj, telefonlar } = await req.json()

  if (!mesaj || !telefonlar || telefonlar.length === 0) {
    return NextResponse.json({ ok: false, mesaj: 'Mesaj veya alıcı listesi eksik.' })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const client = createClient(url, key)
  const hafta = buHaftaninCumasi()

  // Aynı haftaya daha önce gönderildi mi?
  const { data: mevcutLog } = await client.from('bildirim_log').select('*').eq('hafta_tarihi', hafta).single()
  if (mevcutLog) {
    return NextResponse.json({
      ok: false,
      mesaj: `Bu hafta (${hafta}) zaten ${mevcutLog.gonderilen_sayi} kişiye bildirim gönderildi. Tekrar göndermek için önce log'u silin.`,
      log: mevcutLog
    })
  }

  const webhookUrl = process.env.N8N_BILDIRIM_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ ok: false, mesaj: 'N8N_BILDIRIM_WEBHOOK_URL Vercel\'e eklenmemiş.' })
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaj, telefonlar })
    })

    if (!res.ok) {
      return NextResponse.json({ ok: false, mesaj: `n8n hatası: ${res.status}` })
    }

    // Log'a kaydet
    await client.from('bildirim_log').insert({
      hafta_tarihi: hafta,
      gonderilen_sayi: telefonlar.length,
      mesaj,
    })

    return NextResponse.json({
      ok: true,
      mesaj: `${telefonlar.length} kişiye bildirim gönderildi. Bu hafta tekrar gönderilemez.`
    })
  } catch (e: any) {
    return NextResponse.json({ ok: false, mesaj: `Bağlantı hatası: ${e.message}` })
  }
}
