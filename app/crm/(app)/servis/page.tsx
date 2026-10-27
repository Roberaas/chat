'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Plus, X, Paperclip, Download } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Req = { id: string; req_no: number; customer_id: string; store_id: string; type: string; status: string; priority: string; subject: string; description: string | null; assigned_to: string | null; sla_due_at: string | null; created_at: string; customers: { first_name: string; last_name: string } | null }
type Ev = { id: number; kind: string; body: string | null; from_value: string | null; to_value: string | null; user_id: string | null; created_at: string }
type Att = { id: string; storage_path: string; file_name: string; size_bytes: number | null }
type Found = { id: string; customer_no: number; first_name: string; last_name: string; store_id: string }
const TYPE: Record<string, string> = { maintenance: 'Bakım', repair: 'Onarım', warranty: 'Garanti', exchange: 'Değişim', return: 'İade', other: 'Diğer' }
const STATUS: Record<string, [string, string]> = { open: ['Açık', 'badge-blue'], in_progress: ['İşlemde', 'badge-amber'], waiting_customer: ['Müşteri bekleniyor', 'badge-muted'], resolved: ['Çözüldü', 'badge-green'], closed: ['Kapandı', 'badge-green'], cancelled: ['İptal', 'badge-red'] }
const PRIO: Record<string, [string, string]> = { low: ['Düşük', 'badge-muted'], normal: ['Normal', 'badge-blue'], high: ['Yüksek', 'badge-red'] }
const OPEN = ['open', 'in_progress', 'waiting_customer']
const dt = (v: string) => new Date(v).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })

export default function ServisPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const canWrite = crm.can('service.write')
  const [rows, setRows] = useState<Req[]>([])
  const [people, setPeople] = useState<{ id: string; first_name: string; last_name: string }[]>([])
  const [members, setMembers] = useState<{ user_id: string; store_id: string }[]>([])
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [filter, setFilter] = useState<'open' | 'mine' | 'overdue' | 'all'>('open')
  const [sel, setSel] = useState<Req | null>(null)
  const [events, setEvents] = useState<Ev[]>([])
  const [atts, setAtts] = useState<Att[]>([])
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<{ q: string; found: Found[]; cust: Found | null; type: string; priority: string; subject: string; description: string; assigned_to: string } | null>(null)

  const load = useCallback(async () => {
    const [r, p, m, s] = await Promise.all([
      supabase.from('service_requests').select('*, customers(first_name, last_name)').order('created_at', { ascending: false }).limit(500),
      supabase.from('profiles').select('id, first_name, last_name').eq('is_active', true),
      supabase.from('store_memberships').select('user_id, store_id'),
      supabase.from('stores').select('id, name')])
    setRows((r.data || []) as unknown as Req[]); setPeople((p.data || []) as any); setMembers((m.data || []) as any); setStores((s.data || []) as any)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const pname = (id: string | null) => { const p = people.find(x => x.id === id); return p ? `${p.first_name} ${p.last_name}` : '—' }
  const overdue = (r: Req) => OPEN.includes(r.status) && !!r.sla_due_at && new Date(r.sla_due_at) < new Date()
  const shown = rows.filter(r => filter === 'all' || (filter === 'open' && OPEN.includes(r.status)) || (filter === 'mine' && r.assigned_to === crm.profile.id && OPEN.includes(r.status)) || (filter === 'overdue' && overdue(r)))

  async function open(r: Req) {
    setSel(r); setErr('')
    const [e, a] = await Promise.all([
      supabase.from('service_request_events').select('*').eq('request_id', r.id).order('created_at'),
      supabase.from('service_attachments').select('id, storage_path, file_name, size_bytes').eq('request_id', r.id)])
    setEvents((e.data || []) as Ev[]); setAtts((a.data || []) as Att[])
  }
  async function patch(p: Record<string, unknown>) {
    if (!sel) return
    const { data, error } = await supabase.from('service_requests').update(p).eq('id', sel.id).select('*, customers(first_name, last_name)').single()
    if (error) { setErr(error.message); return }
    setErr(''); await load(); open(data as unknown as Req)
  }
  async function addNote() {
    if (!sel || !note.trim()) return
    const { error } = await supabase.from('service_request_events').insert({ request_id: sel.id, kind: 'note', body: note.trim(), user_id: crm.profile.id })
    if (error) { setErr(error.message); return }
    setNote(''); open(sel)
  }
  async function upload(f: File | undefined) {
    if (!sel || !f) return
    const path = `${sel.id}/${Date.now()}-${f.name.replace(/[^\w.\-]+/g, '_')}`
    const up = await supabase.storage.from('crm-service').upload(path, f, { contentType: f.type })
    if (up.error) { setErr(up.error.message); return }
    const { error } = await supabase.from('service_attachments').insert({ request_id: sel.id, storage_path: path, file_name: f.name, content_type: f.type, size_bytes: f.size, uploaded_by: crm.profile.id })
    if (error) { await supabase.storage.from('crm-service').remove([path]); setErr(error.message); return }
    setErr(''); open(sel)
  }
  async function download(a: Att) {
    const { data, error } = await supabase.storage.from('crm-service').createSignedUrl(a.storage_path, 60)
    if (error || !data) { setErr(error?.message || 'Bağlantı oluşturulamadı'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }
  async function search() {
    if (!form) return
    const t = form.q.trim().toLowerCase().replace(/[%_]/g, ' ')
    if (t.length < 2) return
    const { data } = await supabase.from('customers').select('id, customer_no, first_name, last_name, store_id').eq('status', 'active').ilike('search_text', `%${t}%`).limit(8)
    setForm({ ...form, found: (data || []) as Found[] })
  }
  async function create() {
    if (!form?.cust || !form.subject.trim()) { setErr('Müşteri ve konu zorunlu'); return }
    const { error } = await supabase.from('service_requests').insert({ customer_id: form.cust.id, store_id: form.cust.store_id, type: form.type, priority: form.priority, subject: form.subject, description: form.description.trim() || null, assigned_to: form.assigned_to || null })
    if (error) { setErr(error.message); return }
    setErr(''); setForm(null); load()
  }
  const evText = (e: Ev) => e.kind === 'note' ? e.body : e.kind === 'status' ? `Durum: ${STATUS[e.from_value || '']?.[0]} → ${STATUS[e.to_value || '']?.[0]}` : `Atama: ${pname(e.from_value)} → ${pname(e.to_value)}`

  return (
    <>
      <CrmTopBar title="Satış Sonrası" subtitle={`${shown.length} talep`} action={canWrite && <button className="btn" onClick={() => { setErr(''); setForm({ q: '', found: [], cust: null, type: 'repair', priority: 'normal', subject: '', description: '', assigned_to: '' }) }}><Plus size={14} /> Talep Ekle</button>} />
      <div style={{ padding: 22, maxWidth: 1100, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 12, display: 'flex', gap: 8 }}>
          {([['open', 'Açık'], ['mine', 'Bana atanan'], ['overdue', 'SLA aşıldı'], ['all', 'Tümü']] as const).map(([k, l]) => <button key={k} className={filter === k ? 'btn' : 'btn-ghost'} onClick={() => setFilter(k)}>{l}</button>)}
        </div>
        <div className="card">
          {shown.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Talep yok</div> : shown.map(r => (
            <div key={r.id} onClick={() => open(r)} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--bdr)', cursor: 'pointer' }}>
              <span style={{ color: 'var(--tx3)', fontSize: 12, width: 44 }}>#{r.req_no}</span>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{r.subject}</div><div style={{ fontSize: 12, color: 'var(--tx3)' }}>{r.customers?.first_name} {r.customers?.last_name} · {TYPE[r.type]} · {pname(r.assigned_to)}</div></div>
              {overdue(r) && <span className="badge badge-red">SLA aşıldı</span>}
              <span className={`badge ${PRIO[r.priority][1]}`}>{PRIO[r.priority][0]}</span>
              <span className={`badge ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
            </div>))}
        </div>
      </div>

      {sel && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setSel(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 640, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <div><h2 className="modal-title" style={{ marginBottom: 2 }}>#{sel.req_no} {sel.subject}</h2>
                <Link href={`/crm/musteriler/${sel.customer_id}`} style={{ fontSize: 12.5, color: 'var(--ac)' }}>{sel.customers?.first_name} {sel.customers?.last_name}</Link> <span style={{ fontSize: 12, color: 'var(--tx3)' }}>· {TYPE[sel.type]} · {stores.find(s => s.id === sel.store_id)?.name} · SLA: {sel.sla_due_at ? dt(sel.sla_due_at) : '—'}</span></div>
              <button onClick={() => setSel(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
            </div>
            {sel.description && <p style={{ fontSize: 13, color: 'var(--tx2)', whiteSpace: 'pre-wrap' }}>{sel.description}</p>}
            <div className="modal-grid" style={{ marginBottom: 14 }}>
              <div><label className="label">Durum</label><select className="inp" disabled={!canWrite} value={sel.status} onChange={e => patch({ status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></div>
              <div><label className="label">Atanan</label><select className="inp" disabled={!canWrite} value={sel.assigned_to || ''} onChange={e => patch({ assigned_to: e.target.value || null })}><option value="">—</option>{people.filter(p => members.some(m => m.user_id === p.id && m.store_id === sel.store_id)).map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)', marginBottom: 6 }}>Dosyalar</div>
            {atts.map(a => <div key={a.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx2)', padding: '4px 0' }}><span><Paperclip size={12} /> {a.file_name}</span><button className="btn-ghost" onClick={() => download(a)}><Download size={13} /></button></div>)}
            {canWrite && <><input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" hidden onChange={e => { upload(e.target.files?.[0]); e.target.value = '' }} /><button className="btn-ghost" style={{ margin: '6px 0 14px' }} onClick={() => fileRef.current?.click()}><Paperclip size={13} /> Dosya ekle (görsel/PDF, en çok 10 MB)</button></>}
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)', marginBottom: 6 }}>Geçmiş</div>
            {events.map(e => <div key={e.id} style={{ fontSize: 12.5, color: 'var(--tx2)', padding: '4px 0', borderTop: '1px solid var(--bdr)' }}>{evText(e)}<div style={{ fontSize: 11, color: 'var(--tx3)' }}>{pname(e.user_id)} · {dt(e.created_at)}</div></div>)}
            {canWrite && <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><input className="inp" placeholder="Not ekle" value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} /><button className="btn" onClick={addNote}>Ekle</button></div>}
            {err && <div style={{ fontSize: 12.5, color: 'var(--red)', marginTop: 8 }}>{err}</div>}
          </div>
        </div>)}

      {form && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>Servis Talebi</h2><button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Müşteri *</label>
                {form.cust ? <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}><span>#{form.cust.customer_no} {form.cust.first_name} {form.cust.last_name}</span><button className="btn-ghost" onClick={() => setForm({ ...form, cust: null })}>Değiştir</button></div> : (<>
                  <div style={{ display: 'flex', gap: 8 }}><input className="inp" placeholder="Ad, telefon veya e-posta" value={form.q} onChange={e => setForm({ ...form, q: e.target.value })} onKeyDown={e => e.key === 'Enter' && search()} /><button className="btn-ghost" onClick={search}>Ara</button></div>
                  {form.found.map(f => <div key={f.id} onClick={() => setForm({ ...form, cust: f })} style={{ padding: '6px 0', fontSize: 13, color: 'var(--tx2)', cursor: 'pointer' }}>#{f.customer_no} {f.first_name} {f.last_name}</div>)}</>)}</div>
              <div className="modal-grid">
                <div><label className="label">Tür</label><select className="inp" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label">Öncelik</label><select className="inp" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{Object.entries(PRIO).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></div>
              </div>
              <div><label className="label">Konu *</label><input className="inp" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} /></div>
              <div><label className="label">Açıklama</label><textarea className="inp" rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setForm(null)}>Vazgeç</button><button className="btn" onClick={create}>Kaydet</button></div>
            </div>
          </div>
        </div>)}
    </>
  )
}
