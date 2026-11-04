export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/serverDb'
import { dogrula, esle } from '@/lib/botKurallari'

const ALAN = 'id,ad,anahtar_kelimeler,eslesme,eylem,cevap,yonerge,aktif,oncelik,olusturan,olusturma,guncelleme'

export async function GET() {
  const { data, error } = await adminDb().from('bot_kurallari').select(ALAN).order('oncelik').order('id')
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, kurallar: data || [] })
}

export async function POST(req: Request) {
  const b = await req.json().catch(() => ({}))
  const db = adminDb()
  if (b?.test !== undefined) {
    const { data } = await db.from('bot_kurallari').select(ALAN).eq('aktif', true)
    const k = esle(String(b.test), (data as any[]) || [])
    return NextResponse.json({ ok: true, eslesen: k ? { id: k.id, ad: k.ad, eylem: k.eylem } : null })
  }
  const d = dogrula(b)
  if (!d.ok) return NextResponse.json({ ok: false, error: (d as any).error })
  const { error } = await db.from('bot_kurallari').insert({ ...d.v, olusturan: req.headers.get('x-panel-user') || null })
  return NextResponse.json({ ok: !error, error: error?.message })
}

export async function PATCH(req: Request) {
  const b = await req.json().catch(() => ({}))
  if (!b?.id) return NextResponse.json({ ok: false, error: 'id gerekli' })
  const db = adminDb()
  if (Object.keys(b).length === 2 && typeof b.aktif === 'boolean') {
    const { error } = await db.from('bot_kurallari').update({ aktif: b.aktif }).eq('id', b.id)
    return NextResponse.json({ ok: !error, error: error?.message })
  }
  const d = dogrula(b)
  if (!d.ok) return NextResponse.json({ ok: false, error: (d as any).error })
  const { error } = await db.from('bot_kurallari').update(d.v).eq('id', b.id)
  return NextResponse.json({ ok: !error, error: error?.message })
}

export async function DELETE(req: Request) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ ok: false, error: 'id gerekli' })
  const { error } = await adminDb().from('bot_kurallari').delete().eq('id', id)
  return NextResponse.json({ ok: !error, error: error?.message })
}
