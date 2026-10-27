'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, X } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Appt = { id: string; customer_id: string; store_id: string; advisor_id: string; starts_at: string; ends_at: string; status: string; purpose: string | null; notes: string | null; customers: { first_name: string; last_name: string } | null }
type Found = { id: string; customer_no: number; first_name: string; last_name: string; store_id: string }
const STATUS: Record<string, [string, string]> = { scheduled: ['Planlandı', 'badge-blue'], completed: ['Tamamlandı', 'badge-green'], cancelled: ['İptal', 'badge-muted'], no_show: ['Gelmedi', 'badge-red'] }
const fmt = (v: string) => new Date(v).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
const day = (v: string) => new Date(v).toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

export default function RandevularPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const canWrite = crm.can('appointments.write')
  const [rows, setRows] = useState<Appt[]>([])
  const [people, setPeople] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [members, setMembers] = useState<{ user_id: string; store_id: string }[]>([])
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [range, setRange] = useState<'upcoming' | 'past' | 'mine'>('upcoming')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<{ show: boolean; q: string; found: Found[]; cust: Found | null; store_id: string; advisor_id: string; start: string; minutes: string; purpose: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const now = new Date().toISOString()
    let q = supabase.from('appointments').select('*, customers(first_name, last_name)').limit(300)
    q = range === 'past' ? q.lt('starts_at', now).order('starts_at', { ascending: false }) : q.gte('starts_at', now).order('starts_at')
    if (range === 'mine') q = q.eq('advisor_id', crm.profile.id)
    const [a, p, m, s] = await Promise.all([q,
      supabase.from('profiles').select('id, first_name, last_name').eq('is_active', true),
      supabase.from('store_memberships').select('user_id, store_id'),
      supabase.from('stores').select('id, name').eq('is_active', true)])
    setRows((a.data || []) as unknown as Appt[]); setPeople((p.data || []) as any); setMembers((m.data || []) as any); setStores((s.data || []) as any); setLoading(false)
  }, [range])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const pname = (id: string) => { const p = people.find(x => x.id === id); return p ? `${p.first_name} ${p.last_name}` : '—' }
  const sname = (id: string) => stores.find(x => x.id === id)?.name || '—'
  const staffOf = (sid: string) => people.filter(p => members.some(m => m.user_id === p.id && m.store_id === sid))

  async function setStatus(id: string, status: string) { const { error } = await supabase.from('appointments').update({ status }).eq('id', id); if (error) setErr(error.message); else { setErr(''); load() } }
  async function search() {
    if (!form) return
    const t = form.q.trim().toLowerCase().replace(/[%_]/g, ' ')
    if (t.length < 2) return
    const { data } = await supabase.from('customers').select('id, customer_no, first_name, last_name, store_id').eq('status', 'active').ilike('search_text', `%${t}%`).limit(8)
    setForm({ ...form, found: (data || []) as Found[] })
  }
  async function create() {
    if (!form?.cust || !form.advisor_id || !form.store_id || !form.start) { setErr('Müşteri, mağaza, danışman ve zaman zorunlu'); return }
    const start = new Date(form.start); const end = new Date(start.getTime() + (parseInt(form.minutes) || 60) * 60000)
    const { error } = await supabase.from('appointments').insert({ customer_id: form.cust.id, store_id: form.store_id, advisor_id: form.advisor_id, starts_at: start.toISOString(), ends_at: end.toISOString(), purpose: form.purpose.trim() || null })
    if (error) { setErr(error.code === '23P01' ? 'Bu danışmanın o saatte başka randevusu var' : error.message); return }
    setErr(''); setForm(null); load()
  }

  let lastDay = ''
  return (
    <>
      <CrmTopBar title="Randevular" subtitle={`${rows.length} randevu`} action={canWrite && <button className="btn" onClick={() => { setErr(''); setForm({ show: true, q: '', found: [], cust: null, store_id: '', advisor_id: crm.profile.id, start: '', minutes: '60', purpose: '' }) }}><Plus size={14} /> Randevu Ekle</button>} />
      <div style={{ padding: 22, maxWidth: 1000, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          {([['upcoming', 'Yaklaşan'], ['mine', 'Benim'], ['past', 'Geçmiş']] as const).map(([k, l]) => <button key={k} className={range === k ? 'btn' : 'btn-ghost'} onClick={() => setRange(k)}>{l}</button>)}
          {err && <span style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</span>}
        </div>
        <div className="card">
          {loading ? <div className="anim-pulse" style={{ height: 100 }} /> : rows.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Randevu yok</div> : rows.map(a => {
            const d = day(a.starts_at); const head = d !== lastDay; lastDay = d
            return (
              <div key={a.id}>
                {head && <div style={{ padding: '8px 16px', fontSize: 11.5, fontWeight: 700, color: 'var(--tx3)', background: 'var(--s1)', textTransform: 'capitalize' }}>{d}</div>}
                <div style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--bdr)' }}>
                  <div style={{ width: 90, fontSize: 13, color: 'var(--tx)', fontWeight: 600 }}>{new Date(a.starts_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}–{new Date(a.ends_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 13 }}>
                    <Link href={`/crm/musteriler/${a.customer_id}`} style={{ color: 'var(--tx)', fontWeight: 600 }}>{a.customers?.first_name} {a.customers?.last_name}</Link>
                    <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{sname(a.store_id)} · {pname(a.advisor_id)}{a.purpose ? ` · ${a.purpose}` : ''}</div>
                  </div>
                  {canWrite ? <select className="inp" style={{ width: 130 }} value={a.status} onChange={e => setStatus(a.id, e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select> : <span className={`badge ${STATUS[a.status][1]}`}>{STATUS[a.status][0]}</span>}
                </div>
              </div>)
          })}
        </div>
      </div>
      {form?.show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>Randevu Ekle</h2><button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Müşteri *</label>
                {form.cust ? <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}><span>#{form.cust.customer_no} {form.cust.first_name} {form.cust.last_name}</span><button className="btn-ghost" onClick={() => setForm({ ...form, cust: null })}>Değiştir</button></div> : (<>
                  <div style={{ display: 'flex', gap: 8 }}><input className="inp" placeholder="Ad, telefon veya e-posta" value={form.q} onChange={e => setForm({ ...form, q: e.target.value })} onKeyDown={e => e.key === 'Enter' && search()} /><button className="btn-ghost" onClick={search}>Ara</button></div>
                  {form.found.map(f => <div key={f.id} onClick={() => setForm({ ...form, cust: f, store_id: f.store_id })} style={{ padding: '6px 0', fontSize: 13, color: 'var(--tx2)', cursor: 'pointer' }}>#{f.customer_no} {f.first_name} {f.last_name}</div>)}</>)}
              </div>
              <div className="modal-grid">
                <div><label className="label">Mağaza *</label><select className="inp" value={form.store_id} onChange={e => setForm({ ...form, store_id: e.target.value })}><option value="">Seçin</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label className="label">Danışman *</label><select className="inp" value={form.advisor_id} onChange={e => setForm({ ...form, advisor_id: e.target.value })}>{(form.store_id ? staffOf(form.store_id) : people).map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Başlangıç *</label><input className="inp" type="datetime-local" value={form.start} onChange={e => setForm({ ...form, start: e.target.value })} /></div>
                <div><label className="label">Süre (dk)</label><input className="inp" inputMode="numeric" value={form.minutes} onChange={e => setForm({ ...form, minutes: e.target.value })} /></div>
              </div>
              <div><label className="label">Amaç</label><input className="inp" value={form.purpose} onChange={e => setForm({ ...form, purpose: e.target.value })} /></div>
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setForm(null)}>Vazgeç</button><button className="btn" onClick={create}>Kaydet</button></div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
