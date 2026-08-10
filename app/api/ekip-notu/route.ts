import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const telefon = searchParams.get('telefon')
  const siparis = searchParams.get('siparis')
  let q = db().from('ekip_notlari').select('*').order('created_at', { ascending: false })
  if (telefon) q = q.eq('ilgili_telefon', telefon)
  if (siparis) q = q.eq('ilgili_siparis', siparis)
  const { data } = await q.limit(50)
  return NextResponse.json({ notlar: data || [] })
}
export async function POST(req: Request) {
  const body = await req.json()
  const { error } = await db().from('ekip_notlari').insert(body)
  return NextResponse.json({ ok: !error })
}
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await db().from('ekip_notlari').delete().eq('id', id)
  return NextResponse.json({ ok: !error })
}
