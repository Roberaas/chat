'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { Check, Lock, Plus, Pencil, Trash2, X, Store } from 'lucide-react'
import ConfirmModal from '@/components/ConfirmModal'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { ROLE_LABEL } from '@/lib/crm/types'

const MODULE: Record<string, string> = { customers: 'Müşteri', opportunities: 'Fırsat', tasks: 'Görev', appointments: 'Randevu', orders: 'Sipariş', products: 'Ürün', service: 'Satış sonrası', campaigns: 'Kampanya', segments: 'Segment', consents: 'İzin', reports: 'Rapor', users: 'Kullanıcı', stores: 'Mağaza', settings: 'Ayar', audit: 'Denetim', b2b: 'B2B', data: 'Veri', integrations: 'Entegrasyon', dashboard: 'Dashboard', quotations: 'Teklif', activity: 'Aktivite', announcements: 'Duyuru', targets: 'Hedef' }
const SCOPE: Record<string, string> = { all: 'tümü', stores: 'mağaza', own: 'kendi' }
type Role = { code: string; name: string; description: string | null; scope: string; sort_order: number; is_system: boolean; store_id: string | null; delegable: boolean }
type Perm = { code: string; module: string; description: string }
type Opt = { id: string; name: string }
const EMPTY = { show: false, code: '', name: '', description: '', scope: 'stores', store_id: '', delegable: false, copy: '' }

const slug = (s: string) => s.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u')
  .replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30)

export default function RoleEditor({ canEdit }: { canEdit: boolean }) {
  const supabase = createCrmBrowserClient()
  const sp = useSearchParams()
  const [roles, setRoles] = useState<Role[]>([])
  const [perms, setPerms] = useState<Perm[]>([])
  const [stores, setStores] = useState<Opt[]>([])
  const [has, setHas] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(EMPTY)
  const [del, setDel] = useState<Role | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [r, p, rp, s] = await Promise.all([
      supabase.from('roles').select('code, name, description, scope, sort_order, is_system, store_id, delegable').order('sort_order').order('name'),
      supabase.from('permissions').select('code, module, description').order('module').order('code'),
      supabase.from('role_permissions').select('role_code, permission_code'),
      supabase.from('stores').select('id, name').order('name'),
    ])
    const rr = (r.data || []) as Role[]
    rr.forEach(x => { if (x.is_system) return; ROLE_LABEL[x.code] = x.name })
    setRoles(rr); setPerms((p.data || []) as Perm[]); setStores((s.data || []) as Opt[])
    setHas(new Set((rp.data || []).map((x: any) => `${x.role_code}|${x.permission_code}`)))
    setLoading(false)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  useEffect(() => { const st = sp.get('store'); if (st && canEdit) setForm({ ...EMPTY, show: true, store_id: st }) }, [sp, canEdit])

  const mods = useMemo(() => Array.from(new Set(perms.map(x => x.module))), [perms])
  const storeName = (id: string | null) => stores.find(s => s.id === id)?.name

  async function toggle(role: Role, perm: string) {
    if (!canEdit || role.is_system) return
    const key = `${role.code}|${perm}`, on = has.has(key)
    setHas(h => { const n = new Set(h); on ? n.delete(key) : n.add(key); return n })
    const { error } = on
      ? await supabase.from('role_permissions').delete().eq('role_code', role.code).eq('permission_code', perm)
      : await supabase.from('role_permissions').insert({ role_code: role.code, permission_code: perm })
    if (error) { setErr(error.message); load() } else setErr('')
  }

  async function save() {
    const name = form.name.trim()
    if (name.length < 3) { setErr('Rol adı en az 3 karakter olmalı'); return }
    setErr('')
    const payload = { name, description: form.description.trim() || null, scope: form.scope, store_id: form.store_id || null, delegable: form.delegable }
    if (form.code) {
      const { error } = await supabase.from('roles').update(payload).eq('code', form.code)
      if (error) { setErr(error.message); return }
    } else {
      const base = slug(name) || 'rol'
      const code = `${base}_${Math.random().toString(36).slice(2, 5)}`.slice(0, 40)
      const { data: me } = await supabase.auth.getUser()
      const { error } = await supabase.from('roles').insert({ code, ...payload, sort_order: 100 + roles.length, created_by: me.user?.id })
      if (error) { setErr(error.message); return }
      if (form.copy) {
        const rows = perms.filter(p => has.has(`${form.copy}|${p.code}`)).map(p => ({ role_code: code, permission_code: p.code }))
        if (form.copy === 'super_admin') perms.forEach(p => rows.push({ role_code: code, permission_code: p.code }))
        const uniq = Array.from(new Map(rows.map(r => [r.permission_code, r])).values())
        if (uniq.length) await supabase.from('role_permissions').insert(uniq)
      }
      setMsg('Rol oluşturuldu. Aşağıdaki tabloda yetkilerini işaretleyin.')
    }
    setForm(EMPTY); load()
  }

  async function remove() {
    if (!del) return
    const { error } = await supabase.from('roles').delete().eq('code', del.code)
    setDel(null)
    if (error) setErr(error.message); else { setErr(''); setMsg('Rol silindi'); load() }
  }

  const colLabel = (r: Role) => ROLE_LABEL[r.code] || r.name

  return (
    <div style={{ padding: '24px 28px 40px', maxWidth: 1280, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, color: 'var(--tx3)', maxWidth: 700 }}>
          Hangi rolün neyi yapabildiği. Süper Admin her şeyi yapar. Kapsam: "tümü" her mağazayı, "mağaza" yalnız bağlı olduğu mağaza ve şubeleri, "kendi" yalnız kendisine atanan kayıtları görür.
          {canEdit && <> <b style={{ color: 'var(--tx2)' }}>Sistem rolleri kilitlidir; kendi rollerinizi oluşturup kutulara tıklayarak yetki verin.</b> Bir rolü mağazaya bağlarsanız yalnız o mağazanın kullanıcılarına atanır.</>}
        </div>
        {canEdit && <button className="btn" onClick={() => { setForm({ ...EMPTY, show: true }); setErr('') }}><Plus size={14} /> Yeni Rol</button>}
      </div>
      {msg && <div className="toast" style={{ margin: 0 }}>{msg}</div>}
      {err && !form.show && <div className="toast toast-err" style={{ margin: 0 }}>{err}</div>}

      {loading ? <div className="card anim-pulse" style={{ height: 200 }} /> : (
        <div className="card" style={{ overflow: 'auto', maxHeight: '74vh' }}>
          <table style={{ borderCollapse: 'separate', borderSpacing: 0, fontSize: 13, minWidth: '100%' }}>
            <thead><tr>
              <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 3, background: 'var(--s1)', padding: '12px 18px', textAlign: 'left', minWidth: 260, borderBottom: '1px solid var(--bdr)' }}>Yetki</th>
              {roles.map(x => (
                <th key={x.code} style={{ position: 'sticky', top: 0, zIndex: 2, background: 'var(--s1)', padding: '12px 10px', fontWeight: 600, fontSize: 12, minWidth: 124, textAlign: 'center', borderBottom: '1px solid var(--bdr)' }}>
                  {colLabel(x)}
                  <div style={{ fontWeight: 400, color: 'var(--tx3)', fontSize: 11 }}>{SCOPE[x.scope]}{x.delegable ? ' · devredilebilir' : ''}</div>
                  {x.store_id && <div style={{ fontWeight: 500, color: 'var(--ac)', fontSize: 11, display: 'flex', gap: 3, alignItems: 'center', justifyContent: 'center' }}><Store size={10} />{storeName(x.store_id)}</div>}
                  {canEdit && !x.is_system && (
                    <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 4 }}>
                      <button title="Düzenle" onClick={() => { setForm({ show: true, code: x.code, name: x.name, description: x.description || '', scope: x.scope, store_id: x.store_id || '', delegable: x.delegable, copy: '' }); setErr('') }} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 4, cursor: 'pointer' }}><Pencil size={13} /></button>
                      <button title="Sil" onClick={() => setDel(x)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 4, cursor: 'pointer' }}><Trash2 size={13} /></button>
                    </div>)}
                </th>))}
            </tr></thead>
            <tbody>
              {mods.map(mod => [
                <tr key={`m-${mod}`}><td colSpan={roles.length + 1} style={{ padding: '10px 18px', background: 'var(--s2)', fontWeight: 600, fontSize: 12.5, color: 'var(--tx2)' }}>{MODULE[mod] || mod}</td></tr>,
                ...perms.filter(x => x.module === mod).map(x => (
                  <tr key={x.code}>
                    <td style={{ position: 'sticky', left: 0, background: 'var(--s1)', padding: '9px 18px', borderBottom: '1px solid var(--bdr)' }}><div style={{ color: 'var(--tx)' }}>{x.description}</div><code style={{ fontSize: 11 }}>{x.code}</code></td>
                    {roles.map(ro => {
                      const on = ro.code === 'super_admin' || has.has(`${ro.code}|${x.code}`)
                      const editable = canEdit && !ro.is_system
                      return (
                        <td key={ro.code} onClick={editable ? () => toggle(ro, x.code) : undefined}
                          style={{ textAlign: 'center', borderBottom: '1px solid var(--bdr)', cursor: editable ? 'pointer' : 'default', background: editable ? 'var(--s2)' : undefined }}>
                          {on ? <Check size={15} style={{ color: 'var(--green)' }} strokeWidth={2.6} /> : <span style={{ color: 'var(--s5)' }}>–</span>}
                        </td>)
                    })}
                  </tr>)),
              ])}
            </tbody>
          </table>
        </div>
      )}
      {canEdit && <div style={{ fontSize: 12, color: 'var(--tx3)', display: 'flex', gap: 6, alignItems: 'center' }}><Lock size={12} /> Gri zeminli sütunlar sizin oluşturduğunuz rollerdir. Devredilebilir roller bayi yöneticisi ve mağaza müdürü tarafından atanabilir; kullanıcı, ayar, entegrasyon, mağaza yönetimi ve denetim yetkisi taşıyan roller devredilemez.</div>}

      {form.show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(EMPTY) }}>
          <div className="modal anim-pop" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>{form.code ? 'Rolü Düzenle' : 'Yeni Rol'}</h2>
              <button onClick={() => setForm(EMPTY)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Rol adı *</label><input className="inp" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Kadıköy Mağaza Müdürü" /></div>
              <div><label className="label">Açıklama</label><input className="inp" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div>
              <div className="modal-grid">
                <div><label className="label">Görünürlük</label>
                  <select className="inp" value={form.scope} onChange={e => setForm(f => ({ ...f, scope: e.target.value }))}>
                    <option value="stores">Bağlı olduğu mağaza(lar)</option><option value="own">Yalnız kendi kayıtları</option>
                  </select></div>
                <div><label className="label">Mağazaya bağla</label>
                  <select className="inp" value={form.store_id} onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}>
                    <option value="">— Tüm mağazalar —</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
              </div>
              {!form.code && (
                <div><label className="label">Yetkileri şu rolden kopyala</label>
                  <select className="inp" value={form.copy} onChange={e => setForm(f => ({ ...f, copy: e.target.value }))}>
                    <option value="">— Boş başla —</option>{roles.map(r => <option key={r.code} value={r.code}>{colLabel(r)}</option>)}
                  </select></div>)}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tx2)' }}>
                <input type="checkbox" checked={form.delegable} onChange={e => setForm(f => ({ ...f, delegable: e.target.checked }))} /> Bayi yöneticisi / mağaza müdürü bu rolü kendi personeline atayabilsin
              </label>
              {err && <div className="toast toast-err" style={{ margin: 0 }}>{err}</div>}
              <button className="btn" onClick={save} style={{ justifyContent: 'center', padding: '11px 0' }}>{form.code ? 'Kaydet' : 'Rolü Oluştur'}</button>
            </div>
          </div>
        </div>)}

      <ConfirmModal open={!!del} title="Rolü sil" message={`"${del?.name}" rolü silinecek. Role atanmış kullanıcı varsa silinemez.`} confirmText="Evet, sil" onConfirm={remove} onCancel={() => setDel(null)} />
    </div>
  )
}
