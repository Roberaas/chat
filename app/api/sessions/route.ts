export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { adminDb } from '@/lib/serverDb'

// Panel sayfaları WhatsApp oturumlarını buradan okur (giriş zorunlu: middleware). Tarayıcıdan doğrudan veritabanı erişimi yok.
// GET ?view=full|mini &menu=canli|bot &kvkk=0 &slack=1 &limit=500
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams
  const mini = sp.get('view') === 'mini'
  let q = adminDb().from('wa_sessions_roberto').select(mini ? 'phone, updated_at, bulundugu_menu' : '*').order('updated_at', { ascending: false })
  const menu = sp.get('menu'); if (menu === 'canli' || menu === 'bot') q = q.eq('bulundugu_menu', menu)
  if (sp.get('kvkk') === '0') q = q.eq('kvkk_onay', false)
  if (sp.get('slack') === '1') q = q.not('slack_thread_ts', 'is', null).neq('slack_thread_ts', '')
  const limit = Math.min(Math.max(parseInt(sp.get('limit') || '0') || 0, 0), 2000)
  if (limit) q = q.limit(limit)
  const { data, error } = await q
  if (error) return NextResponse.json({ ok: false, error: error.message, sessions: [] }, { status: 500 })
  return NextResponse.json({ ok: true, sessions: data || [] })
}

// PATCH { phone, action: 'bildirim_gonderildi' | 'bota_don' }
export async function PATCH(req: Request) {
  const { phone, action } = await req.json().catch(() => ({}))
  if (typeof phone !== 'string' || !phone) return NextResponse.json({ ok: false }, { status: 400 })
  const patch = action === 'bildirim_gonderildi' ? { bildirim_gonderildi: true }
    : action === 'bota_don' ? { bulundugu_menu: 'bot', slack_thread_ts: '', updated_at: new Date().toISOString() } : null
  if (!patch) return NextResponse.json({ ok: false, error: 'invalid_action' }, { status: 400 })
  const { error } = await adminDb().from('wa_sessions_roberto').update(patch).eq('phone', phone)
  return NextResponse.json({ ok: !error, error: error?.message })
}
