export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET() {
  const { data } = await db().from('canli_destek_log').select('*').order('created_at', { ascending: false }).limit(100)
  return NextResponse.json({ loglar: data || [] })
}
export async function POST(req: Request) {
  const body = await req.json()
  const { error } = await db().from('canli_destek_log').upsert(body, { onConflict: 'slack_thread_ts' })
  return NextResponse.json({ ok: !error })
}
