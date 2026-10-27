import { NextRequest, NextResponse } from 'next/server'
import { createHmac, timingSafeEqual } from 'crypto'
import { createCrmAdminClient } from '@/lib/crm/supabase/admin'
import { rateLimit } from '@/lib/crm/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const TYPES = new Set(['product.upsert', 'order.upsert'])
const MAX_BYTES = 1_000_000
const TOLERANCE_S = 300

const getPath = (o: any, p: string) => p.split('.').reduce((a, k) => (a == null ? undefined : a[k]), o)
function setPath(o: any, p: string, v: unknown) {
  const ks = p.split('.'); let cur = o
  ks.slice(0, -1).forEach(k => { if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {}; cur = cur[k] })
  cur[ks[ks.length - 1]] = v
}
const safeKey = (p: string) => /^[A-Za-z0-9_.]{1,80}$/.test(p) && !/(^|\.)(__proto__|constructor|prototype)(\.|$)/.test(p)

// Güvenli webhook girişi: HMAC-SHA256(secret, `${timestamp}.${gövde}`), zaman penceresi, tekrar (idempotent) koruması.
// Sır DB'de tutulmaz; entegrasyon kaydındaki secret_env adlı ortam değişkeninden okunur.
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`wh:${ip}`, 120)) return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 })
  if (!/^[a-z0-9_-]{2,40}$/.test(params.code)) return NextResponse.json({ ok: false }, { status: 404 })

  const raw = await req.text()
  if (raw.length > MAX_BYTES) return NextResponse.json({ ok: false, error: 'too_large' }, { status: 413 })

  const db = createCrmAdminClient()
  const { data: ig } = await db.from('integrations').select('id, status, secret_env').eq('code', params.code).maybeSingle()
  // Var olup olmadığını sızdırmamak için aynı yanıt
  if (!ig || ig.status !== 'active' || !ig.secret_env) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  const secret = process.env[ig.secret_env]
  if (!secret) return NextResponse.json({ ok: false, error: 'not_configured' }, { status: 503 })

  const ts = req.headers.get('x-crm-timestamp') || ''
  const sig = (req.headers.get('x-crm-signature') || '').replace(/^sha256=/, '')
  const age = Math.abs(Date.now() / 1000 - Number(ts))
  const expected = createHmac('sha256', secret).update(`${ts}.${raw}`).digest('hex')
  const okSig = sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  if (!ts || !Number.isFinite(age) || age > TOLERANCE_S || !okSig) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })

  let body: any
  try { body = JSON.parse(raw) } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }) }
  const eventId = typeof body?.event_id === 'string' && body.event_id.length <= 128 ? body.event_id : null
  if (!eventId || !TYPES.has(body?.type) || typeof body?.data !== 'object' || body.data === null) {
    return NextResponse.json({ ok: false, error: 'invalid_event' }, { status: 400 })
  }

  // Alan eşlemesi (kaynak alan → canonical alan)
  const entity = body.type === 'product.upsert' ? 'product' : 'order'
  const { data: maps } = await db.from('integration_mappings').select('source_field, target_field').eq('integration_id', ig.id).eq('entity', entity)
  let data = body.data
  if (maps?.length) {
    data = { ...body.data }
    for (const m of maps) if (safeKey(m.source_field) && safeKey(m.target_field)) { const v = getPath(body.data, m.source_field); if (v !== undefined) setPath(data, m.target_field, v) }
  }

  const { error } = await db.from('webhook_inbox').insert({ integration_id: ig.id, external_event_id: eventId, event_type: body.type, payload: { data } })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
    return NextResponse.json({ ok: false, error: 'store_failed' }, { status: 500 })
  }
  try { await db.rpc('process_inbox', { p_limit: 20 }) } catch { /* cron her dakika yeniden dener */ }
  return NextResponse.json({ ok: true })
}
