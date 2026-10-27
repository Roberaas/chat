export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'
import { createCrmAdminClient } from '@/lib/crm/supabase/admin'
import { isUuid, strongPassword } from '@/lib/crm/validate'

export async function POST(req: Request, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const g = await apiGuard('users.manage')
  if ('res' in g) return g.res
  if (!g.ctx.isSuperAdmin && isUuid(params.id)) {
    const { data: ok } = await createCrmServerClient().rpc('delegation_ok', { p_target: params.id })
    if (!ok) return NextResponse.json({ ok: false, error: 'Bu kullanıcıyı yönetme yetkiniz yok' }, { status: 403 })
  }
  const b = await req.json().catch(() => null)
  if (!isUuid(params.id) || !b || !strongPassword(b.password))
    return NextResponse.json({ ok: false, error: 'Şifre en az 12 karakter, büyük/küçük harf ve rakam içermeli' }, { status: 400 })
  const r = await createCrmAdminClient().auth.admin.updateUserById(params.id, { password: b.password })
  if (r.error) return NextResponse.json({ ok: false, error: r.error.message }, { status: 500 })
  // Kullanıcının oturumuyla yaz → audit'te işlemi yapan görünür
  const { error } = await createCrmServerClient().from('profiles').update({ must_change_password: true }).eq('id', params.id)
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
