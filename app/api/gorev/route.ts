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
  const { show, ...gorevData } = body

  // sms_saati string → time formatına çevir (HH:MM)
  const payload = {
    ...gorevData,
    sms_saati: gorevData.sms_saati || null,
    sms_telefon: gorevData.sms_telefon || '905392993103',
    sms_gonderildi: false,
  }

  const { error } = await db().from('gorevler').insert(payload)
  if (error) return NextResponse.json({ ok: false, error: error.message })

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
