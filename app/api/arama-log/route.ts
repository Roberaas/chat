export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET() {
  const { data } = await db()
    .from('arama_logu')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100)
  return NextResponse.json({ aramalar: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const payload = {
    telefon:     body.telefon?.trim() || null,
    musteri_adi: body.musteri_adi?.trim() || null,
    sure_dakika: parseInt(body.sure_dakika) || 0,
    notlar:      body.notlar?.trim() || null,
    sonuc:       body.sonuc || 'tamamlandi',
    arayan:      body.arayan?.trim() || 'admin',
  }
  const { error } = await db().from('arama_logu').insert(payload)
  return NextResponse.json({ ok: !error, error: error?.message })
}
