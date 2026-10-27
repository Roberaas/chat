export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { getCrmContext, rateLimit } from '@/lib/crm/auth'
import { adminDb } from '@/lib/serverDb'
import { signCrm2fa, CRM2FA_COOKIE } from '@/lib/panelSession'

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
  const res = NextResponse.json({ ok: true })
  res.cookies.set(CRM2FA_COOKIE, await signCrm2fa(ctx.userId), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 12 * 3600 })
  return res
}
