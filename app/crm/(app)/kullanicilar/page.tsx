'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, X, Edit2, KeyRound, Search, Eye, EyeOff, RefreshCw } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import CrmTopBar from '@/components/crm/CrmTopBar'
import ConfirmModal from '@/components/ConfirmModal'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { ROLE_LABEL } from '@/lib/crm/types'

type Row = {
  id: string; first_name: string; last_name: string; email: string; phone: string | null
  department_id: string | null; is_active: boolean; last_sign_in_at: string | null
  user_roles: { role_code: string }[]; store_memberships: { store_id: string }[]
}
type Opt = { id: string; name: string }
const EMPTY = { show: false, id: '', first_name: '', last_name: '', email: '', phone: '', department_id: '', role_code: 'sales_advisor', store_ids: [] as string[], password: '', is_active: true }

function genPassword() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ', b = 'abcdefghijkmnpqrstuvwxyz', c = '23456789'
  const pick = (s: string, n: number) => Array.from(crypto.getRandomValues(new Uint32Array(n))).map(x => s[x % s.length]).join('')
  const raw = pick(a, 3) + pick(b, 6) + pick(c, 3) + pick(a + b + c, 2)
  return raw.split('').sort(() => crypto.getRandomValues(new Uint32Array(1))[0] % 2 - .5).join('')
}

export default function KullanicilarPage() {
  const crm = useCrm()
  const isAdmin = crm.isSuperAdmin
  const supabase = createCrmBrowserClient()
  const [rows, setRows] = useState<Row[]>([])
  const [stores, setStores] = useState<Opt[]>([])
  const [depts, setDepts] = useState<Opt[]>([])
  const [roles, setRoles] = useState<{ code: string; name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [form, setForm] = useState(EMPTY)
  const [show, setShow] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [reset, setReset] = useState<{ id: string; name: string; password: string } | null>(null)
  const [toggle, setToggle] = useState<Row | null>(null)
  const [info, setInfo] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [u, s, d, r] = await Promise.all([
      supabase.from('profiles').select('id, first_name, last_name, email, phone, department_id, is_active, last_sign_in_at, user_roles(role_code), store_memberships(store_id)').order('first_name'),
      supabase.from('stores').select('id, name').order('name'),
      supabase.from('departments').select('id, name').order('name'),
      supabase.from('roles').select('code, name').order('sort_order'),
    ])
    setRows((u.data || []) as any); setStores((s.data || []) as Opt[]); setDepts((d.data || []) as Opt[]); setRoles((r.data || []) as any)
    setLoading(false)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    return t ? rows.filter(r => `${r.first_name} ${r.last_name} ${r.email}`.toLowerCase().includes(t)) : rows
  }, [rows, q])
  const storeName = (id: string) => stores.find(s => s.id === id)?.name || '—'

  function openNew() { setForm({ ...EMPTY, show: true, password: genPassword() }); setShow(true); setErr(''); setInfo('') }
  function openEdit(r: Row) {
    setForm({ show: true, id: r.id, first_name: r.first_name, last_name: r.last_name, email: r.email, phone: r.phone || '', department_id: r.department_id || '',
      role_code: r.user_roles[0]?.role_code || 'sales_advisor', store_ids: r.store_memberships.map(m => m.store_id), password: '', is_active: r.is_active })
    setShow(true); setErr(''); setInfo('')
  }

  async function save() {
    setErr(''); setBusy(true)
    const body: any = {
      first_name: form.first_name, last_name: form.last_name, phone: form.phone || null,
      department_id: form.department_id || null, role_code: form.role_code, store_ids: form.store_ids,
    }
    const isNew = !form.id
    if (isNew) { body.email = form.email; body.password = form.password }
    else body.is_active = form.is_active
    const res = await fetch(isNew ? '/api/crm/users' : `/api/crm/users/${form.id}`, {
      method: isNew ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const d = await res.json().catch(() => ({}))
    setBusy(false)
    if (!d.ok) { setErr(d.error || 'İşlem başarısız'); return }
    if (isNew) setInfo(`Kullanıcı oluşturuldu. Geçici şifre: ${form.password} (ilk girişte değiştirmesi istenecek; bu şifre bir daha gösterilmez)`)
    else setShow(false)
    load()
  }

  async function doToggle() {
    if (!toggle) return
    const res = await fetch(`/api/crm/users/${toggle.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !toggle.is_active }) })
    const d = await res.json().catch(() => ({}))
    setToggle(null)
    if (!d.ok) { setErr(d.error || 'Durum değiştirilemedi'); window.setTimeout(() => setErr(''), 6000) }
    load()
  }

  async function doReset() {
    if (!reset) return
    const res = await fetch(`/api/crm/users/${reset.id}/reset-password`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: reset.password }) })
    const d = await res.json().catch(() => ({}))
    if (!d.ok) { setErr(d.error || 'Sıfırlanamadı'); return }
    setInfo(`Şifre sıfırlandı. Yeni geçici şifre: ${reset.password}`)
    setReset(null)
  }

  const toggleStore = (id: string) => setForm(f => ({ ...f, store_ids: f.store_ids.includes(id) ? f.store_ids.filter(x => x !== id) : [...f.store_ids, id] }))

  return (
    <>
      <CrmTopBar title="Kullanıcılar" subtitle={`${rows.length} kullanıcı`}
        action={<>
          <button className="btn-ghost" onClick={load} style={{ padding: 8 }} title="Yenile"><RefreshCw size={14} /></button>
          {isAdmin && <button className="btn" onClick={openNew}><Plus size={14} /> Kullanıcı Ekle</button>}
        </>} />
      <div style={{ padding: 22, maxWidth: 1280, width: '100%', margin: '0 auto' }}>
        {info && !show && <div className="toast toast-ok" style={{ margin: '0 0 14px', wordBreak: 'break-all' }}>{info}</div>}
        {err && !show && <div className="toast toast-err" style={{ margin: '0 0 14px' }}>{err}</div>}
        <div style={{ position: 'relative', maxWidth: 320, marginBottom: 14 }}>
          <Search size={14} style={{ position: 'absolute', left: 11, top: 11, color: 'var(--tx3)' }} />
          <input className="inp" placeholder="Ad veya e-posta ara…" value={q} onChange={e => setQ(e.target.value)} style={{ paddingLeft: 32 }} />
        </div>
        <div className="card">
          {loading ? <div style={{ padding: 16 }}><div className="anim-pulse" style={{ height: 120, background: 'var(--s3)', borderRadius: 10 }} /></div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 860, borderCollapse: 'collapse' }}>
                <thead><tr>{['Kullanıcı', 'Rol', 'Mağazalar', 'Durum', 'Son Giriş', ''].map((h, i) =>
                  <th key={i} className="kpi-label" style={{ padding: '12px 18px', textAlign: 'left', marginBottom: 0, borderBottom: '1px solid var(--bdr)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {filtered.map(r => (
                    <tr key={r.id} className="row" style={{ display: 'table-row' }}>
                      <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--bdr)' }}>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{r.first_name} {r.last_name}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{r.email}</div>
                      </td>
                      <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--bdr)' }}>
                        {r.user_roles.map(x => <span key={x.role_code} className="badge badge-ac" style={{ marginRight: 4 }}>{ROLE_LABEL[x.role_code] || x.role_code}</span>)}
                      </td>
                      <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--tx2)', borderBottom: '1px solid var(--bdr)' }}>{r.store_memberships.map(m => storeName(m.store_id)).join(', ') || '—'}</td>
                      <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--bdr)' }}><span className={`badge ${r.is_active ? 'badge-green' : 'badge-red'}`}>{r.is_active ? 'Aktif' : 'Pasif'}</span></td>
                      <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace', borderBottom: '1px solid var(--bdr)' }}>{r.last_sign_in_at ? formatDistanceToNow(new Date(r.last_sign_in_at), { addSuffix: true, locale: tr }) : 'hiç'}</td>
                      <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--bdr)' }}>
                        {isAdmin && (
                          <div style={{ display: 'flex', gap: 2 }}>
                            <button title="Düzenle" onClick={() => openEdit(r)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6 }}><Edit2 size={14} /></button>
                            <button title="Şifre sıfırla" onClick={() => setReset({ id: r.id, name: `${r.first_name} ${r.last_name}`, password: genPassword() })} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6 }}><KeyRound size={14} /></button>
                            {r.id !== crm.userId && <button onClick={() => setToggle(r)} className="btn-ghost" style={{ padding: '3px 9px', fontSize: 11.5 }}>{r.is_active ? 'Pasifleştir' : 'Aktifleştir'}</button>}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Kullanıcı bulunamadı</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget && !info) setShow(false) }}>
          <div className="modal anim-pop" style={{ maxWidth: 500, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>{form.id ? 'Kullanıcıyı Düzenle' : 'Kullanıcı Ekle'}</h2>
              <button onClick={() => setShow(false)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
            </div>
            {info ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="toast toast-ok" style={{ margin: 0, wordBreak: 'break-all' }}>{info}</div>
                <button className="btn" onClick={() => { setShow(false); setInfo('') }} style={{ justifyContent: 'center' }}>Tamam</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div className="modal-grid">
                  <div><label className="label">Ad *</label><input className="inp" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                  <div><label className="label">Soyad *</label><input className="inp" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
                </div>
                <div><label className="label">E-posta *</label><input className="inp" type="email" value={form.email} disabled={!!form.id} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
                <div className="modal-grid">
                  <div><label className="label">Telefon</label><input className="inp" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="905xxxxxxxxx" /></div>
                  <div><label className="label">Departman</label>
                    <select className="inp" value={form.department_id} onChange={e => setForm(f => ({ ...f, department_id: e.target.value }))}>
                      <option value="">—</option>{depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select></div>
                </div>
                <div><label className="label">Rol *</label>
                  <select className="inp" value={form.role_code} onChange={e => setForm(f => ({ ...f, role_code: e.target.value }))}>
                    {roles.map(r => <option key={r.code} value={r.code}>{r.name}</option>)}
                  </select></div>
                <div><label className="label">Mağazalar * (birden fazla seçilebilir; ilk seçilen ana mağaza)</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {stores.map(s => (
                      <button key={s.id} type="button" onClick={() => toggleStore(s.id)} className={form.store_ids.includes(s.id) ? 'badge badge-ac' : 'badge badge-muted'} style={{ border: 'none', cursor: 'pointer', padding: '5px 11px' }}>{s.name}</button>
                    ))}
                  </div></div>
                {!form.id && (
                  <div><label className="label">Geçici şifre (ilk girişte değiştirilecek)</label>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input className="inp" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ fontFamily: 'JetBrains Mono, monospace' }} />
                      <button type="button" className="btn-ghost" onClick={() => setForm(f => ({ ...f, password: genPassword() }))}>Üret</button>
                    </div></div>
                )}
                {form.id && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--tx2)' }}>
                    <input type="checkbox" checked={form.is_active} disabled={form.id === crm.userId} onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))} /> Hesap aktif
                  </label>
                )}
                {err && <div className="toast toast-err" style={{ margin: 0 }}>{err}</div>}
                <button className="btn" onClick={save} disabled={busy} style={{ justifyContent: 'center', padding: '11px 0' }}>{busy ? 'Kaydediliyor…' : 'Kaydet'}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {reset && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setReset(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 420 }}>
            <h2 className="modal-title">Şifre sıfırla · {reset.name}</h2>
            <p style={{ fontSize: 12.5, color: 'var(--tx3)', marginBottom: 12 }}>Yeni geçici şifre atanır; kullanıcı ilk girişte değiştirmek zorundadır.</p>
            <input className="inp" value={reset.password} onChange={e => setReset({ ...reset, password: e.target.value })} style={{ fontFamily: 'JetBrains Mono, monospace', marginBottom: 12 }} />
            {err && <div className="toast toast-err" style={{ margin: '0 0 12px' }}>{err}</div>}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-ghost" onClick={() => setReset({ ...reset, password: genPassword() })}>Üret</button>
              <button className="btn" onClick={doReset} style={{ flex: 1, justifyContent: 'center' }}>Sıfırla</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!toggle} danger={!!toggle?.is_active}
        title={toggle?.is_active ? 'Kullanıcıyı pasifleştir' : 'Kullanıcıyı aktifleştir'}
        message={toggle?.is_active ? 'Kullanıcının tüm oturumları kapanır ve CRM erişimi durur.' : 'Kullanıcı yeniden giriş yapabilir.'}
        confirmText={toggle?.is_active ? 'Evet, pasifleştir' : 'Evet, aktifleştir'}
        onConfirm={doToggle} onCancel={() => setToggle(null)} />
    </>
  )
}
