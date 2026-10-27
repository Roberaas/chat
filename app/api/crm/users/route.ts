export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'
import { createCrmAdminClient } from '@/lib/crm/supabase/admin'
import { isEmail, isUuid, str, optStr, strongPassword, normPhone } from '@/lib/crm/validate'

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

// Kullanıcı oluştur — Super Admin (serbest) veya users.manage yetkili bayi/mağaza yöneticisi (yalnız kendi mağazası, devredilebilir roller; DB'de zorlanır).
// Auth kullanıcısı service role ile; profil/rol/üyelik yazımları KULLANICININ oturumuyla (RLS + audit actor).
export async function POST(req: Request) {
  const g = await apiGuard('users.manage')
  if ('res' in g) return g.res
  const { ctx } = g

  const b = await req.json().catch(() => null)
  if (!b) return bad('Geçersiz istek')
  const email = isEmail(b.email) ? b.email.toLowerCase() : null
  const first = str(b.first_name, 80), last = str(b.last_name, 80)
  const phone = b.phone ? normPhone(b.phone) : null
  const dept = b.department_id ? (isUuid(b.department_id) ? b.department_id : null) : null
  const role = str(b.role_code, 40)
  const storeIds: string[] = Array.isArray(b.store_ids) ? b.store_ids.filter(isUuid) : []
  if (!email) return bad('Geçerli e-posta gerekli')
  if (!first || !last) return bad('Ad ve soyad gerekli')
  if (b.phone && !phone) return bad('Telefon geçersiz')
  if (b.department_id && !dept) return bad('Departman geçersiz')
  if (!role) return bad('Rol gerekli')
  if (!strongPassword(b.password)) return bad('Geçici şifre en az 12 karakter, büyük/küçük harf ve rakam içermeli')
  if (storeIds.length === 0) return bad('En az bir mağaza seçin')

  const db = createCrmServerClient()
  if (!ctx.isSuperAdmin) {
    // Devredilmiş yetki: tüm denetimler delegated_provision_user içinde (rol, mağaza kapsamı)
    const admin = createCrmAdminClient()
    const created = await admin.auth.admin.createUser({ email, password: b.password, email_confirm: true })
    if (created.error || !created.data.user) {
      const dup = /already|registered|exists/i.test(created.error?.message || '')
      return bad(dup ? 'Bu e-posta ile kayıtlı kullanıcı var' : 'Kullanıcı oluşturulamadı', dup ? 409 : 500)
    }
    const uid = created.data.user.id
    const { error } = await db.rpc('delegated_provision_user', { p_uid: uid, p_first: first, p_last: last, p_email: email, p_phone: phone, p_role: role, p_stores: storeIds })
    if (error) { await admin.auth.admin.deleteUser(uid); return bad(error.code === '42501' ? error.message : 'Kayıt tamamlanamadı: ' + error.message, error.code === '42501' ? 403 : 400) }
    return NextResponse.json({ ok: true, id: uid })
  }
  const { data: roleRow } = await db.from('roles').select('code').eq('code', role).maybeSingle()
  if (!roleRow) return bad('Rol bulunamadı')
  const { data: stores } = await db.from('stores').select('id').in('id', storeIds)
  if ((stores || []).length !== new Set(storeIds).size) return bad('Mağaza bulunamadı')

  const admin = createCrmAdminClient()
  const created = await admin.auth.admin.createUser({ email, password: b.password, email_confirm: true })
  if (created.error || !created.data.user) {
    const dup = /already|registered|exists/i.test(created.error?.message || '')
    return bad(dup ? 'Bu e-posta ile kayıtlı kullanıcı var' : 'Kullanıcı oluşturulamadı', dup ? 409 : 500)
  }
  const uid = created.data.user.id
  const rollback = async () => { await admin.auth.admin.deleteUser(uid) }

  try {
    const { data: org } = await db.from('organizations').select('id').limit(1).single()
    const p = await db.from('profiles').insert({
      id: uid, organization_id: org!.id, first_name: first, last_name: last, email,
      phone, department_id: dept, created_by: ctx.userId, must_change_password: true,
    })
    if (p.error) throw p.error
    const r = await db.from('user_roles').insert({ user_id: uid, role_code: role, granted_by: ctx.userId })
    if (r.error) throw r.error
    const m = await db.from('store_memberships').insert(storeIds.map((s, i) => ({ user_id: uid, store_id: s, is_primary: i === 0 })))
    if (m.error) throw m.error
  } catch (e: any) {
    await rollback()
    return bad('Kayıt tamamlanamadı: ' + (e?.message || 'bilinmeyen hata'), 500)
  }
  return NextResponse.json({ ok: true, id: uid })
}
