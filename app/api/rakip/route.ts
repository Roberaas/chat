import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET() {
  const { data } = await db().from('rakip_fiyatlar').select('*').order('tarih', { ascending: false })
  return NextResponse.json({ rakipler: data || [] })
}
export async function POST(req: Request) {
  const body = await req.json()
  const { error } = await db().from('rakip_fiyatlar').insert(body)
  return NextResponse.json({ ok: !error, error: error?.message })
}
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await db().from('rakip_fiyatlar').delete().eq('id', id)
  return NextResponse.json({ ok: !error })
}
