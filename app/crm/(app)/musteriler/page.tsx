'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Search, X, Crown, ChevronLeft, ChevronRight } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { SOURCE_LABEL } from '@/lib/crm/labels'

type Row = {
  id: string; customer_no: number; first_name: string; last_name: string; phone: string | null; email: string | null
  is_vip: boolean; store_id: string; assigned_to: string | null; registered_at: string; total_spent: number; last_purchase_at: string | null; source: string
}
type StoreOpt = { id: string; name: string }
type Person = { id: string; first_name: string; last_name: string }
type Dup = { id: string; customer_no: number; display_name: string; store_name: string; accessible: boolean; match_on: string }

const PAGE = 25
const EMPTY = { first_name: '', last_name: '', phone: '', email: '', store_id: '', source: 'walk_in', city: '', is_vip: false }

export default function MusterilerPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const canWrite = crm.can('customers.write')
  const [rows, setRows] = useState<Row[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [qDebounced, setQDebounced] = useState('')
  const [storeF, setStoreF] = useState('')
  const [vipF, setVipF] = useState(false)
  const [mineF, setMineF] = useState(false)
  const [stores, setStores] = useState<StoreOpt[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [form, setForm] = useState<typeof EMPTY & { show: boolean }>({ ...EMPTY, show: false })
  const [dups, setDups] = useState<Dup[]>([])
  const [err, setErr] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => { const t = setTimeout(() => { setQDebounced(q.trim().toLowerCase()); setPage(0) }, 300); return () => clearTimeout(t) }, [q])

  useEffect(() => {
    (async () => {
      const [s, p] = await Promise.all([
        supabase.from('stores').select('id, name').eq('is_active', true).order('name'),
        supabase.from('profiles').select('id, first_name, last_name'),
      ])
      setStores((s.data || []) as StoreOpt[]); setPeople((p.data || []) as Person[])
    })()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true)
    let qb = supabase.from('customers')
      .select('id, customer_no, first_name, last_name, phone, email, is_vip, store_id, assigned_to, registered_at, total_spent, last_purchase_at, source', { count: 'exact' })
      .eq('status', 'active')
    if (qDebounced) qb = qb.ilike('search_text', `%${qDebounced.replace(/[%_]/g, ' ')}%`)
    if (storeF) qb = qb.eq('store_id', storeF)
    if (vipF) qb = qb.eq('is_vip', true)
    if (mineF) qb = qb.eq('assigned_to', crm.profile.id)
    const { data, count } = await qb.order('registered_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    setRows((data || []) as Row[]); setTotal(count || 0); setLoading(false)
  }, [qDebounced, storeF, vipF, mineF, page])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const storeName = (id: string) => stores.find(s => s.id === id)?.name || '—'
  const personName = (id: string | null) => { const p = people.find(x => x.id === id); return p ? `${p.first_name} ${p.last_name}` : '—' }

  async function checkDup(f = form) {
    if (!f.phone.trim() && !f.email.trim()) { setDups([]); return [] as Dup[] }
    const { data } = await supabase.rpc('find_duplicates', { p_phone: f.phone || null, p_email: f.email || null })
    const d = (data || []) as Dup[]; setDups(d); return d
  }

  async function save() {
    setErr('')
    if (!form.first_name.trim()) { setErr('Ad zorunlu'); return }
    if (!form.store_id) { setErr('Mağaza seçin'); return }
    if (!form.phone.trim() && !form.email.trim()) { setErr('Telefon veya e-posta girin'); return }
    setSaving(true)
    const d = await checkDup()
    if (d.length) { setSaving(false); setErr('Bu telefon/e-posta ile kayıtlı müşteri var. Aşağıdaki kayda gidin veya mağazanıza bağlayın.'); return }
    const { data: org } = await supabase.from('organizations').select('id').limit(1).single()
    const { data, error } = await supabase.from('customers').insert({
      organization_id: org!.id, store_id: form.store_id, first_name: form.first_name, last_name: form.last_name,
      phone: form.phone.trim() || null, email: form.email.trim() || null, source: form.source,
      city: form.city.trim() || null, ...(form.is_vip ? { is_vip: true } : {}),
    }).select('id').single()
    setSaving(false)
    if (error) { setErr(error.code === '23505' ? 'Bu telefon/e-posta zaten kayıtlı' : error.message); return }
    window.location.href = `/crm/musteriler/${data!.id}`
  }

  async function linkToMyStore(id: string) {
    if (!form.store_id) { setErr('Önce mağaza seçin'); return }
    const { error } = await supabase.rpc('link_customer_to_store', { p_customer: id, p_store: form.store_id })
    if (error) { setErr(error.message); return }
    setErr('Müşteri mağazanıza bağlandı. Mağaza yöneticisi/CRM ekibi görür; danışmansanız size atanması gerekir.'); checkDup()
  }

  return (
    <>
      <CrmTopBar title="Müşteriler" subtitle={`${total} kayıt`}
        action={canWrite && <button className="btn" onClick={() => { setForm({ ...EMPTY, store_id: stores.length === 1 ? stores[0].id : '', show: true }); setDups([]); setErr('') }}><Plus size={14} /> Müşteri Ekle</button>} />
      <div style={{ padding: 22, maxWidth: 1300, width: '100%', margin: '0 auto' }}>
        <div className="card" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ position: 'relative', flex: '1 1 240px' }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: 12, color: 'var(--tx3)' }} />
            <input className="inp" style={{ paddingLeft: 32 }} placeholder="Ad, telefon veya e-posta ara" value={q} onChange={e => setQ(e.target.value)} />
          </div>
          <select className="inp" style={{ width: 180 }} value={storeF} onChange={e => { setStoreF(e.target.value); setPage(0) }}>
            <option value="">Tüm mağazalar</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--tx2)' }}><input type="checkbox" checked={vipF} onChange={e => { setVipF(e.target.checked); setPage(0) }} /> Sadece VIP</label>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--tx2)' }}><input type="checkbox" checked={mineF} onChange={e => { setMineF(e.target.checked); setPage(0) }} /> Benim müşterilerim</label>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          {loading ? <div className="anim-pulse" style={{ height: 160 }} /> : rows.length === 0 ? (
            <div style={{ padding: 48, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>
              {qDebounced || storeF || vipF || mineF ? 'Filtreye uyan müşteri yok' : 'Henüz müşteri kaydı yok'}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 11.5 }}>
                  {['No', 'Müşteri', 'İletişim', 'Mağaza', 'Danışman', 'Kaynak', 'Kayıt'].map(h => <th key={h} style={{ padding: '10px 14px', fontWeight: 600 }}>{h}</th>)}
                </tr></thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} style={{ borderTop: '1px solid var(--bdr)' }}>
                      <td style={{ padding: '10px 14px', color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace' }}>{r.customer_no}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <Link href={`/crm/musteriler/${r.id}`} style={{ color: 'var(--tx)', fontWeight: 600, textDecoration: 'none' }}>{r.first_name} {r.last_name}</Link>
                        {r.is_vip && <span className="badge badge-amber" style={{ marginLeft: 8 }}><Crown size={11} style={{ marginRight: 3 }} />VIP</span>}
                      </td>
                      <td style={{ padding: '10px 14px', color: 'var(--tx2)' }}>{r.phone || '—'}<div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{r.email || ''}</div></td>
                      <td style={{ padding: '10px 14px', color: 'var(--tx2)' }}>{storeName(r.store_id)}</td>
                      <td style={{ padding: '10px 14px', color: 'var(--tx2)' }}>{personName(r.assigned_to)}</td>
                      <td style={{ padding: '10px 14px' }}><span className="badge badge-muted">{SOURCE_LABEL[r.source] || r.source}</span></td>
                      <td style={{ padding: '10px 14px', color: 'var(--tx3)' }}>{new Date(r.registered_at).toLocaleDateString('tr-TR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {total > PAGE && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--bdr)', fontSize: 12.5, color: 'var(--tx3)' }}>
              <span>{page * PAGE + 1}–{Math.min((page + 1) * PAGE, total)} / {total}</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn-ghost" disabled={page === 0} onClick={() => setPage(p => p - 1)}><ChevronLeft size={14} /></button>
                <button className="btn-ghost" disabled={(page + 1) * PAGE >= total} onClick={() => setPage(p => p + 1)}><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      </div>

      {form.show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(f => ({ ...f, show: false })) }}>
          <div className="modal anim-pop" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>Müşteri Ekle</h2>
              <button onClick={() => setForm(f => ({ ...f, show: false }))} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="modal-grid">
                <div><label className="label">Ad *</label><input className="inp" value={form.first_name} onChange={e => setForm(f => ({ ...f, first_name: e.target.value }))} /></div>
                <div><label className="label">Soyad</label><input className="inp" value={form.last_name} onChange={e => setForm(f => ({ ...f, last_name: e.target.value }))} /></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Telefon</label><input className="inp" inputMode="tel" value={form.phone} onBlur={() => checkDup()} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="05xx xxx xx xx" /></div>
                <div><label className="label">E-posta</label><input className="inp" type="email" value={form.email} onBlur={() => checkDup()} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Mağaza *</label>
                  <select className="inp" value={form.store_id} onChange={e => setForm(f => ({ ...f, store_id: e.target.value }))}>
                    <option value="">Seçin</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select></div>
                <div><label className="label">Kaynak</label>
                  <select className="inp" value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}>
                    {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select></div>
              </div>
              <div><label className="label">Şehir</label><input className="inp" value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} /></div>
              {crm.can('vip.manage') && <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--tx2)' }}><input type="checkbox" checked={form.is_vip} onChange={e => setForm(f => ({ ...f, is_vip: e.target.checked }))} /> VIP müşteri</label>}
              {dups.length > 0 && (
                <div style={{ border: '1px solid var(--amber)', borderRadius: 10, padding: 12, fontSize: 12.5 }}>
                  <b style={{ color: 'var(--amber)' }}>Olası mükerrer kayıt</b>
                  {dups.map(d => (
                    <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, gap: 8, color: 'var(--tx2)' }}>
                      <span>#{d.customer_no} · {d.display_name} · {d.store_name} <span className="badge badge-muted">{d.match_on}</span></span>
                      {d.accessible
                        ? <Link href={`/crm/musteriler/${d.id}`} className="btn-ghost">Aç</Link>
                        : <button className="btn-ghost" onClick={() => linkToMyStore(d.id)}>Mağazama bağla</button>}
                    </div>
                  ))}
                </div>
              )}
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button className="btn-ghost" onClick={() => setForm(f => ({ ...f, show: false }))}>Vazgeç</button>
                <button className="btn" disabled={saving} onClick={save}>{saving ? 'Kaydediliyor…' : 'Kaydet'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
