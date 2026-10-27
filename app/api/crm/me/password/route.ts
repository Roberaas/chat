export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { getCrmContext, rateLimit } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'
import { createCrmAdminClient } from '@/lib/crm/supabase/admin'

// Kullanıcı kendi şifresini değiştirir; must_change_password bayrağı sunucuda kapatılır.
export async function POST(req: Request) {
  const ctx = await getCrmContext()
  if (!ctx) return NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 })
  if (!rateLimit('pw:' + ctx.userId, 10)) return NextResponse.json({ ok: false, error: 'Çok fazla deneme' }, { status: 429 })
  const { password } = await req.json().catch(() => ({ password: '' }))
  if (typeof password !== 'string' || password.length < 12 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))
    return NextResponse.json({ ok: false, error: 'Şifre en az 12 karakter, büyük/küçük harf ve rakam içermeli' }, { status: 400 })

  const { error } = await createCrmServerClient().auth.updateUser({ password })
  if (error) return NextResponse.json({ ok: false, error: 'Şifre güncellenemedi: ' + error.message }, { status: 400 })

  const { error: e2 } = await createCrmAdminClient().from('profiles').update({ must_change_password: false }).eq('id', ctx.userId)
  if (e2) return NextResponse.json({ ok: false, error: 'Profil güncellenemedi' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
