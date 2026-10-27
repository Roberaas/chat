import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createCrmAdminClient } from '@/lib/crm/supabase/admin'
import { rateLimit } from '@/lib/crm/auth'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// Alıcı "STOP/İPTAL" yanıtı veya e-posta çıkışı → pazarlama izni iptal. SMS/WhatsApp sağlayıcısı veya n8n bu adresi çağırır.
// Başlık: x-crm-optout-secret (CRM_OPTOUT_SECRET ile eşleşmeli). Gövde: { channel, phone?, email? }
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  if (!rateLimit(`oo:${ip}`, 120)) return NextResponse.json({ ok: false }, { status: 429 })
  const secret = process.env.CRM_OPTOUT_SECRET || ''
  const given = req.headers.get('x-crm-optout-secret') || ''
  const a = Buffer.from(given), b = Buffer.from(secret)
  if (!secret || a.length !== b.length || !timingSafeEqual(a, b)) return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 }) }
  const channel = String(body?.channel || '')
  const phone = typeof body?.phone === 'string' ? body.phone.slice(0, 30) : null
  const email = typeof body?.email === 'string' ? body.email.slice(0, 200) : null
  if (!['sms', 'email', 'whatsapp', 'call'].includes(channel) || (!phone && !email)) return NextResponse.json({ ok: false, error: 'invalid_request' }, { status: 400 })
  const { data, error } = await createCrmAdminClient().rpc('opt_out', { p_channel: channel, p_phone: phone, p_email: email, p_source: 'other' })
  if (error) return NextResponse.json({ ok: false, error: 'failed' }, { status: 500 })
  return NextResponse.json({ ok: true, revoked: data })
}
