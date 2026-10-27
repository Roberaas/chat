'use client'
import { useCallback, useEffect, useState } from 'react'
import { Store, Plus, X, Users, MapPin, ArrowRightLeft, Trash2 } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import ConfirmModal from '@/components/ConfirmModal'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import Link from 'next/link'
import { ROLE_LABEL } from '@/lib/crm/types'

type StoreRow = { id: string; code: string; name: string; store_type: string; city: string | null; address: string | null; phone: string | null; manager_id: string | null; is_active: boolean; parent_id: string | null }
type Person = { id: string; first_name: string; last_name: string }
type Member = { user_id: string; store_id: string; is_primary: boolean }
const TYPE: Record<string, string> = { store: 'Mağaza', hq: 'Merkez', online: 'Online', dealer: 'Bayi', wholesale: 'Toptancı' }
const EMPTY = { id: '', code: '', name: '', store_type: 'store', city: '', address: '', phone: '', manager_id: '', parent_id: '', is_active: true }

export default function MagazalarPage() {
  const crm = useCrm()
  const canManage = crm.can('stores.manage')
  const canMembers = crm.can('users.manage')
  const supabase = createCrmBrowserClient()
  const [stores, setStores] = useState<StoreRow[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [roleOf, setRoleOf] = useState<Record<string, string>>({})
  const [roleList, setRoleList] = useState<{ code: string; name: string; store_id: string | null; is_system: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<typeof EMPTY & { show: boolean }>({ ...EMPTY, show: false })
  const [staffOf, setStaffOf] = useState<StoreRow | null>(null)
  const [addUser, setAddUser] = useState('')
  const [transfer, setTransfer] = useState<{ user: string; to: string }>({ user: '', to: '' })
  const [removeM, setRemoveM] = useState<Member | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [s, p, m, ur, rl] = await Promise.all([
      supabase.from('stores').select('*').order('created_at'),
      supabase.from('profiles').select('id, first_name, last_name').eq('is_active', true).order('first_name'),
      supabase.from('store_memberships').select('user_id, store_id, is_primary'),
      supabase.from('user_roles').select('user_id, role_code'),
      supabase.from('roles').select('code, name, store_id, is_system').order('sort_order'),
    ])
    ;(rl.data || []).forEach((x: any) => { if (!x.is_system) ROLE_LABEL[x.code] = x.name })
    setRoleList((rl.data || []) as any); setRoleOf(Object.fromEntries((ur.data || []).map((x: any) => [x.user_id, x.role_code])))
    setStores((s.data || []) as StoreRow[]); setPeople((p.data || []) as Person[]); setMembers((m.data || []) as Member[])
    setLoading(false)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const nameOf = (id: string | null) => { const p = people.find(x => x.id === id); return p ? `${p.first_name} ${p.last_name}` : '—' }
  const storeName = (id: string | null) => stores.find(x => x.id === id)?.name
  const branchCount = (id: string) => stores.filter(x => x.parent_id === id).length
  const staffCount = (sid: string) => members.filter(m => m.store_id === sid).length

  async function save() {
    if (!form.code.trim() || !form.name.trim()) { setErr('Kod ve ad gerekli'); return }
    setErr('')
    const payload = {
      code: form.code.trim().toUpperCase(), name: form.name.trim(), store_type: form.store_type,
      city: form.city.trim() || null, address: form.address.trim() || null, phone: form.phone.trim() || null,
      manager_id: form.manager_id || null, parent_id: form.parent_id || null, is_active: form.is_active,
    }
    let error
    if (form.id) ({ error } = await supabase.from('stores').update(payload).eq('id', form.id))
    else {
      const { data: org } = await supabase.from('organizations').select('id').limit(1).single()
      ;({ error } = await supabase.from('stores').insert({ ...payload, organization_id: org!.id }))
    }
    if (error) { setErr(error.code === '23505' ? 'Bu mağaza kodu kullanımda' : error.message); return }
    setForm({ ...EMPTY, show: false }); load()
  }

  async function addMember() {
    if (!staffOf || !addUser) return
    const { error } = await supabase.from('store_memberships').insert({ user_id: addUser, store_id: staffOf.id, is_primary: false })
    if (error) { setErr(error.message); return }
    setAddUser(''); setErr(''); load()
  }
  async function doTransfer() {
    if (!staffOf || !transfer.user || !transfer.to) return
    const mem = members.find(m => m.user_id === transfer.user && m.store_id === staffOf.id)
    const ins = await supabase.from('store_memberships').insert({ user_id: transfer.user, store_id: transfer.to, is_primary: false })
    if (ins.error && ins.error.code !== '23505') { setErr(ins.error.message); return }
    const del = await supabase.from('store_memberships').delete().eq('user_id', transfer.user).eq('store_id', staffOf.id)
    if (del.error) { setErr(del.error.message); return }
    if (mem?.is_primary) await supabase.from('store_memberships').update({ is_primary: true }).eq('user_id', transfer.user).eq('store_id', transfer.to)
    setTransfer({ user: '', to: '' }); setErr(''); load()
  }
  async function changeRole(userId: string, role: string) {
    const { error } = await supabase.from('user_roles').update({ role_code: role }).eq('user_id', userId)
    if (error) { setErr(error.message); return }
    setErr(''); load()
  }
  async function removeMember() {
    if (!removeM) return
    const { error } = await supabase.from('store_memberships').delete().eq('user_id', removeM.user_id).eq('store_id', removeM.store_id)
    if (error) setErr(error.message)
    setRemoveM(null); load()
  }

  const staffMembers = staffOf ? members.filter(m => m.store_id === staffOf.id) : []
  const addable = people.filter(p => !staffMembers.some(m => m.user_id === p.id))

  return (
    <>
      <CrmTopBar title="Mağazalar" subtitle={`${stores.length} birim`}
        action={canManage && <button className="btn" onClick={() => setForm({ ...EMPTY, show: true })}><Plus size={14} /> Mağaza Ekle</button>} />
      <div style={{ padding: 22, maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        {loading ? <div className="card anim-pulse" style={{ height: 120 }} /> : stores.length === 0 ? (
          <div className="card" style={{ padding: 48, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Erişebildiğiniz mağaza yok</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {stores.map(s => (
              <div key={s.id} className="card" style={{ padding: 18, opacity: s.is_active ? 1 : .6 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 12 }}>
                  <div style={{ display: 'flex', gap: 11, minWidth: 0 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--ac2)', color: 'var(--ac)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Store size={16} /></div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>{s.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace' }}>{s.code}</div>
                    </div>
                  </div>
                  <span className={`badge ${s.is_active ? 'badge-green' : 'badge-muted'}`}>{s.is_active ? TYPE[s.store_type] : 'Pasif'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12.5, color: 'var(--tx2)', marginBottom: 14 }}>
                  {(s.city || s.address) && <div style={{ display: 'flex', gap: 6 }}><MapPin size={13} style={{ color: 'var(--tx3)', marginTop: 2 }} />{[s.city, s.address].filter(Boolean).join(' · ')}</div>}
                  {s.parent_id && <div>Bağlı olduğu: <b style={{ color: 'var(--tx)' }}>{storeName(s.parent_id) || '—'}</b></div>}
                  {branchCount(s.id) > 0 && <div>{branchCount(s.id)} şube</div>}
                  <div>Müdür: <b style={{ color: 'var(--tx)' }}>{nameOf(s.manager_id)}</b></div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Users size={13} style={{ color: 'var(--tx3)' }} />{staffCount(s.id)} personel</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => { setStaffOf(s); setErr('') }}>Personel</button>
                  {canManage && <button className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setForm({ id: s.id, code: s.code, name: s.name, store_type: s.store_type, city: s.city || '', address: s.address || '', phone: s.phone || '', manager_id: s.manager_id || '', parent_id: s.parent_id || '', is_active: s.is_active, show: true })}>Düzenle</button>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form.show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(f => ({ ...f, show: false })) }}>
          <div className="modal anim-pop" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>{form.id ? 'Mağazayı Düzenle' : 'Mağaza Ekle'}</h2>
              <button onClick={() => setForm(f => ({ ...f, show: false }))} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="modal-grid">
                <div><label className="label">Kod *</label><input className="inp" value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value }))} placeholder="IST01" style={{ fontFamily: 'JetBrains Mono, monospace' }} /></div>
                <div><label className="label">Tür</label>
                  <select className="inp" value={form.store_type} onChange={e => setForm(f => ({ ...f, store_type: e.target.value }))}>
                    <option value="store">Mağaza</option><option value="hq">Merkez Ofis</option><option value="online">Online Kanal</option><option value="dealer">Bayi</option><option value="wholesale">Toptancı</option>
                  </select></div>
              </div>
              <div><label className="label">Ad *</label><input className="inp" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} /></div>
              <div className="modal-grid">
                <div><label className="label">Şehir</label><input className="inp" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
                <div><label className="label">Telefon</label><input className="inp" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
              </div>
              <div><label className="label">Adres</label><input className="inp" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
              <div><label className="label">Mağaza Müdürü</label>
                <select className="inp" value={form.manager_id} onChange={e => setForm(f => ({ ...f, manager_id: e.target.value }))}>
                  <option value="">— Seçilmedi —</option>
                  {people.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select></div>
              <div><label className="label">Bağlı olduğu bayi / merkez (şube ise)</label>
                <select className="inp" value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}>
                  <option value="">— Bağımsız birim —</option>
                  {stores.filter(x => x.id !== form.id && x.parent_id !== form.id).map(x => <option key={x.id} value={x.id}>{x.name}</option>)}
                </select>
                <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 4 }}>Şube açıldığında üst bayinin yöneticileri şubeyi otomatik görür; şube personeli yalnız kendi şubesini görür.</div></div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tx2)' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Aktif
              </label>
              {err && <div className="toast toast-err" style={{ margin: 0 }}>{err}</div>}
              <button className="btn" onClick={save} style={{ justifyContent: 'center', padding: '11px 0' }}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {staffOf && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) { setStaffOf(null); setErr('') } }}>
          <div className="modal anim-pop" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>{staffOf.name} · Personel</h2>
              <button onClick={() => { setStaffOf(null); setErr('') }} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
            </div>
            <div style={{ border: '1px solid var(--bdr)', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
              {staffMembers.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Personel atanmamış</div>}
              {staffMembers.map(m => (
                <div key={m.user_id} className="row" style={{ justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{nameOf(m.user_id)} {m.is_primary && <span className="badge badge-ac">ana</span>}
                    {crm.isSuperAdmin && roleOf[m.user_id] && roleOf[m.user_id] !== 'super_admin' ? (
                      <select className="inp" value={roleOf[m.user_id]} onChange={e => changeRole(m.user_id, e.target.value)} style={{ padding: '3px 8px', fontSize: 12, width: 'auto' }}>
                        {roleList.filter(x => x.code !== 'super_admin' && (!x.store_id || x.store_id === staffOf.id || x.code === roleOf[m.user_id])).map(x => <option key={x.code} value={x.code}>{ROLE_LABEL[x.code] || x.name}</option>)}
                      </select>
                    ) : roleOf[m.user_id] ? <span className="badge badge-muted">{ROLE_LABEL[roleOf[m.user_id]] || roleOf[m.user_id]}</span> : null}</span>
                  {canMembers && (
                    <span style={{ display: 'flex', gap: 4 }}>
                      <button title="Transfer" onClick={() => setTransfer({ user: m.user_id, to: '' })} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6 }}><ArrowRightLeft size={14} /></button>
                      <button title="Mağazadan çıkar" onClick={() => setRemoveM(m)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6 }}><Trash2 size={14} /></button>
                    </span>
                  )}
                </div>
              ))}
            </div>
            {canMembers && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <select className="inp" value={addUser} onChange={e => setAddUser(e.target.value)} style={{ flex: 1 }}>
                    <option value="">Personel ekle…</option>
                    {addable.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                  </select>
                  <button className="btn" onClick={addMember} disabled={!addUser}>Ekle</button>
                </div>
                {crm.isSuperAdmin && <Link href={`/crm/roller?store=${staffOf.id}`} style={{ fontSize: 12.5, color: 'var(--ac)' }}>+ Bu mağazaya özel rol oluştur (yetkileri siz belirlersiniz) →</Link>}
                {transfer.user && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: 10, background: 'var(--s3)', borderRadius: 10 }}>
                    <span style={{ fontSize: 12.5, color: 'var(--tx2)', flexShrink: 0 }}>{nameOf(transfer.user)} →</span>
                    <select className="inp" value={transfer.to} onChange={e => setTransfer(t => ({ ...t, to: e.target.value }))} style={{ flex: 1 }}>
                      <option value="">Hedef mağaza…</option>
                      {stores.filter(s => s.id !== staffOf.id && s.is_active).map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <button className="btn" onClick={doTransfer} disabled={!transfer.to}>Transfer</button>
                  </div>
                )}
              </div>
            )}
            {err && <div className="toast toast-err" style={{ margin: '12px 0 0' }}>{err}</div>}
          </div>
        </div>
      )}

      <ConfirmModal open={!!removeM} title="Personeli mağazadan çıkar" message="Bu personelin mağaza erişimi kaldırılacak. Devam edilsin mi?" confirmText="Evet, çıkar"
        onConfirm={removeMember} onCancel={() => setRemoveM(null)} />
    </>
  )
}
