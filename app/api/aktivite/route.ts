export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const kullanici = searchParams.get('kullanici')
  let q = db().from('aktivite_log').select('*').order('created_at', { ascending: false }).limit(100)
  if (kullanici) q = q.eq('kullanici_adi', kullanici)
  const { data } = await q
  return NextResponse.json({ aktiviteler: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const { error } = await db().from('aktivite_log').insert(body)
  return NextResponse.json({ ok: !error })
}
