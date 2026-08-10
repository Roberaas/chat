import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const telefon = searchParams.get('telefon')
  let q = db().from('musteri_etiketler').select('*').order('created_at')
  if (telefon) q = q.eq('telefon', telefon)
  const { data } = await q
  return NextResponse.json({ etiketler: data || [] })
}
export async function POST(req: Request) {
  const { telefon, etiket, renk } = await req.json()
  const { error } = await db().from('musteri_etiketler').upsert({ telefon, etiket, renk: renk || '#7c9059' }, { onConflict: 'telefon,etiket' })
  return NextResponse.json({ ok: !error, error: error?.message })
}
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await db().from('musteri_etiketler').delete().eq('id', id)
  return NextResponse.json({ ok: !error })
}
