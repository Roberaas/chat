export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCrmContext, rateLimit } from '@/lib/crm/auth'
import { adminDb } from '@/lib/serverDb'
import { createCrmServerClient } from '@/lib/crm/supabase/server'
import { createCrmAdminClient } from '@/lib/crm/supabase/admin'

const SMS_WINDOW_HOURS = 2

export async function POST(req: Request) {
  const ctx = await getCrmContext()
  if (!ctx || !ctx.profile.is_active) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  if (!rateLimit(`crmsmsv:${ctx.userId}`, 15, 10 * 60_000)) return NextResponse.json({ ok: false, error: 'Çok fazla deneme.' }, { status: 429 })
  const { code } = await req.json().catch(() => ({}))
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) return NextResponse.json({ ok: false, error: '6 haneli kodu girin' }, { status: 400 })
  const db = adminDb()
  const { data: row } = await db.from('crm_otp').select('*').eq('user_id', ctx.userId).maybeSingle()
  if (!row || row.used || new Date(row.expires_at).getTime() < Date.now() || row.attempts >= 5) {
    return NextResponse.json({ ok: false, error: 'Kod geçersiz veya süresi dolmuş. Yeni kod isteyin.' }, { status: 400 })
  }
  const hash = crypto.createHash('sha256').update(`${ctx.userId}:${code}`).digest('hex')
  const same = hash.length === row.code_hash.length && crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(row.code_hash))
  if (!same) {
    await db.from('crm_otp').update({ attempts: row.attempts + 1 }).eq('user_id', ctx.userId)
    return NextResponse.json({ ok: false, error: 'Kod hatalı' }, { status: 400 })
  }
  await db.from('crm_otp').update({ used: true }).eq('user_id', ctx.userId)
  // Doğrulama bu Supabase oturumuna (session_id) bağlanır; RLS bunu veritabanında kontrol eder.
  const { data: claims } = await createCrmServerClient().auth.getClaims()
  const sid = claims?.claims?.session_id as string | undefined
  if (!sid) return NextResponse.json({ ok: false, error: 'Oturum bulunamadı, yeniden giriş yapın.' }, { status: 401 })
  const admin = createCrmAdminClient()
  await admin.schema('crm').from('sms_sessions').delete().lt('expires_at', new Date().toISOString())
  const { error } = await admin.schema('crm').from('sms_sessions').upsert({ session_id: sid, user_id: ctx.userId, expires_at: new Date(Date.now() + SMS_WINDOW_HOURS * 3600_000).toISOString() })
  if (error) return NextResponse.json({ ok: false, error: 'Doğrulama kaydedilemedi' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
