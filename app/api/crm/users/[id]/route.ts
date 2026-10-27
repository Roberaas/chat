export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { apiGuard } from '@/lib/crm/auth'
import { createCrmServerClient } from '@/lib/crm/supabase/server'
import { createCrmAdminClient } from '@/lib/crm/supabase/admin'
import { isUuid, str, optStr, normPhone, strongPassword } from '@/lib/crm/validate'

const bad = (error: string, status = 400) => NextResponse.json({ ok: false, error }, { status })

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const g = await apiGuard({ superAdmin: true })
  if ('res' in g) return g.res
  const { ctx } = g
  const id = params.id
  if (!isUuid(id)) return bad('Geçersiz kullanıcı')
  const b = await req.json().catch(() => null)
  if (!b) return bad('Geçersiz istek')

  const db = createCrmServerClient()
  const patch: Record<string, any> = {}
  if (b.first_name !== undefined) { const v = str(b.first_name, 80); if (!v) return bad('Ad geçersiz'); patch.first_name = v }
  if (b.last_name !== undefined) { const v = str(b.last_name, 80); if (!v) return bad('Soyad geçersiz'); patch.last_name = v }
  if (b.phone !== undefined) { if (b.phone) { const p = normPhone(b.phone); if (!p) return bad('Telefon geçersiz'); patch.phone = p } else patch.phone = null }
  if (b.department_id !== undefined) { if (b.department_id && !isUuid(b.department_id)) return bad('Departman geçersiz'); patch.department_id = b.department_id || null }
  if (b.is_active !== undefined) {
    if (typeof b.is_active !== 'boolean') return bad('Durum geçersiz')
    if (id === ctx.userId && !b.is_active) return bad('Kendi hesabınızı pasifleştiremezsiniz')
    patch.is_active = b.is_active
  }

  if (Object.keys(patch).length) {
    const { error } = await db.from('profiles').update(patch).eq('id', id)
    if (error) return bad(error.message, 400)
  }

  if (b.role_code !== undefined) {
    const role = str(b.role_code, 40)
    if (!role) return bad('Rol geçersiz')
    const { data: r } = await db.from('roles').select('code').eq('code', role).maybeSingle()
    if (!r) return bad('Rol bulunamadı')
    const { data: cur } = await db.from('user_roles').select('role_code').eq('user_id', id)
    const have = (cur || []).map((x: any) => x.role_code)
    if (!(have.length === 1 && have[0] === role)) {
      // Önce yeni rolü ekle, sonra eskileri sil (son Super Admin koruması tetikleyicide)
      if (!have.includes(role)) {
        const ins = await db.from('user_roles').insert({ user_id: id, role_code: role, granted_by: ctx.userId })
        if (ins.error) return bad(ins.error.message)
      }
      const del = await db.from('user_roles').delete().eq('user_id', id).neq('role_code', role)
      if (del.error) return bad(del.error.message)
    }
  }

  if (b.store_ids !== undefined) {
    const ids: string[] = Array.isArray(b.store_ids) ? b.store_ids.filter(isUuid) : []
    if (ids.length === 0) return bad('En az bir mağaza seçin')
    const { data: st } = await db.from('stores').select('id').in('id', ids)
    if ((st || []).length !== new Set(ids).size) return bad('Mağaza bulunamadı')
    const { data: cur } = await db.from('store_memberships').select('store_id, is_primary').eq('user_id', id)
    const have = (cur || []).map((x: any) => x.store_id)
    const toAdd = ids.filter(s => !have.includes(s))
    const toDel = have.filter((s: string) => !ids.includes(s))
    const primary = (cur || []).find((x: any) => x.is_primary)?.store_id
    if (toDel.length) {
      const d = await db.from('store_memberships').delete().eq('user_id', id).in('store_id', toDel)
      if (d.error) return bad(d.error.message)
    }
    if (toAdd.length) {
      const a = await db.from('store_memberships').insert(toAdd.map(s => ({ user_id: id, store_id: s, is_primary: false })))
      if (a.error) return bad(a.error.message)
    }
    if (!primary || toDel.includes(primary)) {
      await db.from('store_memberships').update({ is_primary: true }).eq('user_id', id).eq('store_id', ids[0])
    }
  }

  // Pasifleştirme = oturumları da kapat (ban); aktifleştirme = ban kaldır
  if (b.is_active !== undefined) {
    const r = await createCrmAdminClient().auth.admin.updateUserById(id, { ban_duration: b.is_active ? 'none' : '876000h' })
    if (r.error) return bad('Oturum durumu güncellenemedi: ' + r.error.message, 500)
  }
  return NextResponse.json({ ok: true })
}
