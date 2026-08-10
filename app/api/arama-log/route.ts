import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const telefon = searchParams.get('telefon')
  let q = db().from('arama_logu').select('*').order('created_at', { ascending: false })
  if (telefon) q = q.eq('telefon', telefon)
  const { data } = await q.limit(100)
  return NextResponse.json({ aramalar: data || [] })
}
export async function POST(req: Request) {
  const body = await req.json()
  const { error } = await db().from('arama_logu').insert(body)
  return NextResponse.json({ ok: !error })
}
