export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const db = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

export async function GET() {
  const { data } = await db()
    .from('ekip_notlari')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  return NextResponse.json({ notlar: data || [] })
}

export async function POST(req: Request) {
  const body = await req.json()
  const payload = {
    icerik:          body.icerik?.trim() || null,
    yazan:           body.yazan?.trim() || 'admin',
    ilgili_telefon:  body.ilgili_telefon?.trim() || null,
    ilgili_siparis:  body.ilgili_siparis?.trim() || null,
    ilgili_tip:      body.ilgili_tip || 'genel',
    // eski kolonlar da doldur (NOT NULL)
    phone:           body.ilgili_telefon?.trim() || '-',
    not_metni:       body.icerik?.trim() || '-',
  }
  const { error } = await db().from('ekip_notlari').insert(payload)
  return NextResponse.json({ ok: !error, error: error?.message })
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  const { error } = await db().from('ekip_notlari').delete().eq('id', id)
  return NextResponse.json({ ok: !error })
}
