import { NextResponse } from 'next/server'
import { createHmac } from 'crypto'
import { apiGuard } from '@/lib/crm/auth'
import { createCrmAdminClient } from '@/lib/crm/supabase/admin'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// İYS eşitleme: bekleyen izin değişikliklerini İYS entegratör köprüsüne (n8n / resmi İYS API istemcisi) imzalı JSON olarak iletir.
// Köprü 2xx dönerse kayıtlar "synced" olur. Yalnız süper admin tetikler.
export async function POST() {
  const g = await apiGuard({ superAdmin: true })
  if ('res' in g) return g.res
  const url = process.env.CRM_IYS_WEBHOOK_URL
  if (!url) return NextResponse.json({ ok: false, error: 'CRM_IYS_WEBHOOK_URL tanımlı değil' }, { status: 409 })
  const db = createCrmAdminClient()
  const { data, error } = await db.rpc('iys_pending', { p_limit: 200 })
  if (error) return NextResponse.json({ ok: false, error: 'Okunamadı' }, { status: 500 })
  const rows = (data || []) as { consent_id: string; channel: string; status: string; phone: string | null; email: string | null; changed_at: string }[]
  if (rows.length === 0) return NextResponse.json({ ok: true, sent: 0 })
  const payload = JSON.stringify({ consents: rows.map(r => ({ id: r.consent_id, channel: r.channel, type: r.channel === 'sms' ? 'MESAJ' : r.channel === 'email' ? 'EPOSTA' : 'ARAMA', status: r.status === 'granted' ? 'ONAY' : 'RET', recipient: r.channel === 'email' ? r.email : r.phone, changed_at: r.changed_at })) })
  const ts = String(Math.floor(Date.now() / 1000)), secret = process.env.CRM_IYS_WEBHOOK_SECRET || ''
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-crm-timestamp': ts }
  if (secret) headers['x-crm-signature'] = createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex')
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 20_000)
  let ok = false
  try { ok = (await fetch(url, { method: 'POST', headers, body: payload, signal: ctl.signal })).ok } catch { ok = false } finally { clearTimeout(t) }
  await db.rpc('iys_mark', { p_ids: rows.map(r => r.consent_id), p_ok: ok })
  return NextResponse.json({ ok, sent: ok ? rows.length : 0, failed: ok ? 0 : rows.length })
}
