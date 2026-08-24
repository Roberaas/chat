export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET() {
  const { data } = await db().from('gorevler').select('*').order('created_at', { ascending: false })
  return NextResponse.json({ gorevler: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { show, sms_saati, sms_telefon, ...gorevData } = body

  // Temiz insert — form state alanlarını çıkar
  const { error, data } = await db().from('gorevler').insert(gorevData).select().single()
  if (error) return NextResponse.json({ ok: false, error: error.message })

  // SMS gönder
  if (sms_saati && sms_telefon) {
    const [saat, dakika] = sms_saati.split(':').map(Number)
    const simdi = new Date()
    const hedef = new Date()
    hedef.setHours(saat, dakika, 0, 0)

    const gecikmeMs = hedef.getTime() - simdi.getTime()

    if (gecikmeMs > 0) {
      // Zamanlanmış — n8n webhook veya basit setTimeout (serverless'ta çalışmaz, anında gönder)
      // Serverless ortamda setTimeout güvenilir değil, direkt şimdi gönder
    }

    // Direkt gönder (Vercel serverless — setTimeout çalışmaz)
    const mesaj = `[Roberto Bravo] Görev: ${gorevData.baslik}${gorevData.aciklama ? ' — ' + gorevData.aciklama : ''}${gorevData.bitis_tarihi ? ' | Bitiş: ' + gorevData.bitis_tarihi : ''}`
    await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'https://chat.robertobravo.com'}/api/sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaj, tel: sms_telefon })
    }).catch(() => {})
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(req: Request) {
  const { id, ...updates } = await req.json()
  const { error } = await db().from('gorevler').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id)
  return NextResponse.json({ ok: !error })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await db().from('gorevler').delete().eq('id', id)
  return NextResponse.json({ ok: !error })
}
