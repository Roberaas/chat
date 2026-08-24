export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const client = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const telefon = searchParams.get('telefon')
  if (!telefon) return NextResponse.json({ notlar: [] })
  const { data } = await client().from('musteri_notlari').select('*').eq('telefon', telefon).order('created_at', { ascending: false })
  return NextResponse.json({ notlar: data || [] })
}

export async function POST(req: Request) {
  const { telefon, icerik } = await req.json()
  if (!telefon || !icerik) return NextResponse.json({ ok: false })
  const { error } = await client().from('musteri_notlari').insert({ telefon, icerik })
  return NextResponse.json({ ok: !error, error: error?.message })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false })
  const { error } = await client().from('musteri_notlari').delete().eq('id', id)
  return NextResponse.json({ ok: !error })
}
