'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { ArrowLeft, Crown, Phone, Mail, MapPin, Store as StoreIcon, UserCheck, GitMerge, ShieldOff, Plus, Trash2 } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import ConfirmModal from '@/components/ConfirmModal'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { SOURCE_LABEL, CHANNEL_LABEL, INTERACTION_LABEL } from '@/lib/crm/labels'

type Cust = {
  id: string; customer_no: number; first_name: string; last_name: string; phone: string | null; email: string | null; source: string
  city: string | null; birth_date: string | null; store_id: string; assigned_to: string | null; is_vip: boolean; vip_since: string | null
  registered_at: string; total_spent: number; order_count: number; last_purchase_at: string | null; status: string
}
type Person = { id: string; first_name: string; last_name: string }
type Store = { id: string; name: string }
type Note = { id: string; body: string; author_id: string | null; created_at: string }
type Inter = { id: string; type: string; direction: string | null; summary: string; occurred_at: string; user_id: string | null }
type Visit = { id: string; store_id: string; visited_at: string; purpose: string | null; outcome: string | null; notes: string | null; advisor_id: string | null }
type Addr = { id: string; label: string; line: string; district: string | null; city: string | null; is_default: boolean }
type Consent = { id: string; channel: string; purpose: string; status: string; source: string | null; granted_at: string | null; revoked_at: string | null; iys_sync: string }
type CEvent = { id: number; channel: string; purpose: string; action: string; created_at: string }
type Interest = { id: string; product_id: string | null; collection_id: string | null; note: string | null }
type Order = { id: string; order_no: string | null; status: string; total: number; currency: string; ordered_at: string; source_system: string; store_id: string | null }
type Found = { id: string; customer_no: number; first_name: string; last_name: string; phone: string | null }

const TABS = ['Genel', 'Notlar', 'Etkileşimler', 'Ziyaretler', 'Siparişler', 'Adresler', 'İzinler', 'İlgi'] as const
const CONSENT_LABEL: Record<string, [string, string]> = { granted: ['Onaylı', 'badge-green'], revoked: ['İptal', 'badge-red'], pending: ['Beklemede', 'badge-amber'], unknown: ['Bilinmiyor', 'badge-muted'] }
const dt = (v: string | null) => v ? new Date(v).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' }) : '—'

export default function MusteriDetay() {
  const { id } = useParams<{ id: string }>()
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const [c, setC] = useState<Cust | null>(null)
  const [missing, setMissing] = useState(false)
  const [people, setPeople] = useState<Person[]>([])
  const [stores, setStores] = useState<Store[]>([])
  const [custStores, setCustStores] = useState<string[]>([])
  const [tab, setTab] = useState<(typeof TABS)[number]>('Genel')
  const [notes, setNotes] = useState<Note[]>([])
  const [inter, setInter] = useState<Inter[]>([])
  const [visits, setVisits] = useState<Visit[]>([])
  const [addrs, setAddrs] = useState<Addr[]>([])
  const [consents, setConsents] = useState<Consent[]>([])
  const [cevents, setCevents] = useState<CEvent[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [interests, setInterests] = useState<Interest[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; sku: string }[]>([])
  const [collections, setCollections] = useState<{ id: string; name: string }[]>([])
  const [edit, setEdit] = useState<Partial<Cust> | null>(null)
  const [msg, setMsg] = useState('')
  const [noteText, setNoteText] = useState('')
  const [iForm, setIForm] = useState({ type: 'call', direction: 'outbound', summary: '' })
  const [vForm, setVForm] = useState({ purpose: '', outcome: '', notes: '' })
  const [aForm, setAForm] = useState({ label: 'Ev', line: '', district: '', city: '' })
  const [intForm, setIntForm] = useState({ kind: 'product', ref: '', note: '' })
  const [mergeQ, setMergeQ] = useState('')
  const [mergeRes, setMergeRes] = useState<Found[]>([])
  const [mergeSel, setMergeSel] = useState<Found | null>(null)
  const [anon, setAnon] = useState(false)
  const [showMerge, setShowMerge] = useState(false)

  const canWrite = crm.can('customers.write')

  const load = useCallback(async () => {
    const { data } = await supabase.from('customers').select('*').eq('id', id).maybeSingle()
    if (!data) { setMissing(true); return }
    setC(data as Cust)
    const [n, i, v, a, k, ke, it, cs, pe, st, pr, co, od] = await Promise.all([
      supabase.from('customer_notes').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('customer_interactions').select('*').eq('customer_id', id).order('occurred_at', { ascending: false }),
      supabase.from('store_visits').select('*').eq('customer_id', id).order('visited_at', { ascending: false }),
      supabase.from('customer_addresses').select('*').eq('customer_id', id).order('created_at'),
      supabase.from('customer_consents').select('*').eq('customer_id', id),
      supabase.from('consent_events').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(30),
      supabase.from('customer_product_interests').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('customer_stores').select('store_id').eq('customer_id', id),
      supabase.from('profiles').select('id, first_name, last_name'),
      supabase.from('stores').select('id, name'),
      supabase.from('products').select('id, name, sku').order('name').limit(500),
      supabase.from('collections').select('id, name').order('name'),
      supabase.from('orders').select('id, order_no, status, total, currency, ordered_at, source_system, store_id').eq('customer_id', id).eq('is_test', false).order('ordered_at', { ascending: false }),
    ])
    setOrders((od.data || []) as Order[])
    setNotes((n.data || []) as Note[]); setInter((i.data || []) as Inter[]); setVisits((v.data || []) as Visit[])
    setAddrs((a.data || []) as Addr[]); setConsents((k.data || []) as Consent[]); setCevents((ke.data || []) as CEvent[])
    setInterests((it.data || []) as Interest[]); setCustStores(((cs.data || []) as { store_id: string }[]).map(x => x.store_id))
    setPeople((pe.data || []) as Person[]); setStores((st.data || []) as Store[])
    setProducts((pr.data || []) as any); setCollections((co.data || []) as any)
  }, [id])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const pname = (pid: string | null) => { const p = people.find(x => x.id === pid); return p ? `${p.first_name} ${p.last_name}` : '—' }
  const sname = (sid: string) => stores.find(x => x.id === sid)?.name || '—'
  const fail = (e: { message: string; code?: string } | null) => { if (e) { setMsg(e.code === '23505' ? 'Bu telefon/e-posta başka bir müşteride kayıtlı' : e.message); return true } setMsg(''); return false }

  if (missing) return (<><CrmTopBar title="Müşteri" /><div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)' }}>Müşteri bulunamadı veya erişim yetkiniz yok. <Link href="/crm/musteriler" style={{ color: 'var(--ac)' }}>Listeye dön</Link></div></>)
  if (!c) return (<><CrmTopBar title="Müşteri" /><div style={{ padding: 22 }}><div className="card anim-pulse" style={{ height: 160 }} /></div></>)

  const active = c.status === 'active'
  const advisors = people

  async function saveEdit() {
    if (!edit) return
    const { error } = await supabase.from('customers').update({
      first_name: edit.first_name, last_name: edit.last_name, phone: edit.phone || null, email: edit.email || null,
      city: edit.city || null, birth_date: edit.birth_date || null, source: edit.source,
    }).eq('id', id)
    if (!fail(error)) { setEdit(null); load() }
  }
  async function setVip(v: boolean) { const { error } = await supabase.from('customers').update({ is_vip: v }).eq('id', id); if (!fail(error)) load() }
  async function assign(pid: string) { const { error } = await supabase.from('customers').update({ assigned_to: pid || null }).eq('id', id); if (!fail(error)) load() }
  async function addNote() {
    if (!noteText.trim()) return
    const { error } = await supabase.from('customer_notes').insert({ customer_id: id, body: noteText.trim(), author_id: crm.profile.id })
    if (!fail(error)) { setNoteText(''); load() }
  }
  async function addInter() {
    if (!iForm.summary.trim()) return
    const { error } = await supabase.from('customer_interactions').insert({ customer_id: id, store_id: c!.store_id, user_id: crm.profile.id, type: iForm.type, direction: iForm.direction, summary: iForm.summary.trim() })
    if (!fail(error)) { setIForm(f => ({ ...f, summary: '' })); load() }
  }
  async function addVisit() {
    const { error } = await supabase.from('store_visits').insert({ customer_id: id, store_id: c!.store_id, advisor_id: crm.profile.id, purpose: vForm.purpose || null, outcome: vForm.outcome || null, notes: vForm.notes || null })
    if (!fail(error)) { setVForm({ purpose: '', outcome: '', notes: '' }); load() }
  }
  async function addAddr() {
    if (!aForm.line.trim()) return
    const { error } = await supabase.from('customer_addresses').insert({ customer_id: id, label: aForm.label || 'Ev', line: aForm.line.trim(), district: aForm.district || null, city: aForm.city || null, is_default: addrs.length === 0 })
    if (!fail(error)) { setAForm({ label: 'Ev', line: '', district: '', city: '' }); load() }
  }
  async function delAddr(aid: string) { const { error } = await supabase.from('customer_addresses').delete().eq('id', aid); if (!fail(error)) load() }
  async function setConsent(channel: string, purpose: string, status: string) {
    const { error } = await supabase.from('customer_consents').upsert({ customer_id: id, channel, purpose, status, source: 'store_form' }, { onConflict: 'customer_id,channel,purpose' })
    if (!fail(error)) load()
  }
  async function addInterest() {
    if (!intForm.ref) return
    const { error } = await supabase.from('customer_product_interests').insert({
      customer_id: id, note: intForm.note || null, created_by: crm.profile.id,
      ...(intForm.kind === 'product' ? { product_id: intForm.ref } : { collection_id: intForm.ref }),
    })
    if (!fail(error)) { setIntForm(f => ({ ...f, ref: '', note: '' })); load() }
  }
  async function delInterest(iid: string) { const { error } = await supabase.from('customer_product_interests').delete().eq('id', iid); if (!fail(error)) load() }
  async function searchMerge() {
    const t = mergeQ.trim().toLowerCase().replace(/[%_]/g, ' ')
    if (t.length < 2) return
    const { data } = await supabase.from('customers').select('id, customer_no, first_name, last_name, phone').eq('status', 'active').neq('id', id).ilike('search_text', `%${t}%`).limit(8)
    setMergeRes((data || []) as Found[])
  }
  async function doMerge() {
    if (!mergeSel) return
    const { error } = await supabase.rpc('merge_customers', { p_primary: id, p_secondary: mergeSel.id, p_reason: 'Manuel birleştirme' })
    if (!fail(error)) { setShowMerge(false); setMergeSel(null); setMergeRes([]); setMergeQ(''); setMsg('Kayıtlar birleştirildi; geçmiş korundu.'); load() }
  }
  async function doAnon() {
    const { error } = await supabase.rpc('anonymize_customer', { p_customer: id, p_reason: 'KVKK silme/anonimleştirme talebi' })
    setAnon(false)
    if (!fail(error)) { setMsg('Müşteri anonimleştirildi.'); load() }
  }

  const row = (Icon: any, v: string | null) => v ? <div style={{ display: 'flex', gap: 8, alignItems: 'center', color: 'var(--tx2)', fontSize: 13 }}><Icon size={14} style={{ color: 'var(--tx3)' }} />{v}</div> : null
  const consentRow = (ch: string, purpose: string) => {
    const k = consents.find(x => x.channel === ch && x.purpose === purpose)
    const [label, cls] = CONSENT_LABEL[k?.status || 'unknown']
    return (
      <tr key={ch + purpose} style={{ borderTop: '1px solid var(--bdr)' }}>
        <td style={{ padding: '9px 12px' }}>{CHANNEL_LABEL[ch]}</td>
        <td style={{ padding: '9px 12px' }}><span className={`badge ${cls}`}>{label}</span></td>
        <td style={{ padding: '9px 12px', color: 'var(--tx3)', fontSize: 12 }}>{k?.status === 'granted' ? dt(k.granted_at) : k?.status === 'revoked' ? dt(k.revoked_at) : '—'}</td>
        <td style={{ padding: '9px 12px', textAlign: 'right' }}>
          {crm.can('consents.write') && active && (
            <span style={{ display: 'inline-flex', gap: 6 }}>
              <button className="btn-ghost" disabled={k?.status === 'granted'} onClick={() => setConsent(ch, purpose, 'granted')}>Onay al</button>
              <button className="btn-ghost" disabled={k?.status === 'revoked'} onClick={() => setConsent(ch, purpose, 'revoked')}>İptal</button>
            </span>
          )}
        </td>
      </tr>
    )
  }
  const empty = (t: string) => <div style={{ padding: 28, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>{t}</div>

  return (
    <>
      <CrmTopBar title={`${c.first_name} ${c.last_name}`.trim()} subtitle={`#${c.customer_no}`}
        action={<Link href="/crm/musteriler" className="btn-ghost"><ArrowLeft size={14} /> Liste</Link>} />
      <div style={{ padding: 22, maxWidth: 1200, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {c.status !== 'active' && <div className="card" style={{ padding: 12, color: 'var(--amber)', fontSize: 13 }}>{c.status === 'merged' ? 'Bu kayıt başka bir müşteriyle birleştirildi.' : 'Bu müşteri anonimleştirildi; kişisel veri tutulmuyor.'}</div>}
        {msg && <div className="card" style={{ padding: 12, fontSize: 13, color: 'var(--tx2)' }}>{msg}</div>}

        <div className="card" style={{ padding: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 18 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)' }}>{c.first_name} {c.last_name}</span>
              {c.is_vip && <span className="badge badge-amber"><Crown size={11} style={{ marginRight: 3 }} />VIP</span>}
            </div>
            {row(Phone, c.phone)}{row(Mail, c.email)}{row(MapPin, c.city)}{row(StoreIcon, custStores.map(sname).join(', ') || sname(c.store_id))}
            <div style={{ fontSize: 12, color: 'var(--tx3)' }}>Kaynak: {SOURCE_LABEL[c.source] || c.source} · Kayıt: {new Date(c.registered_at).toLocaleDateString('tr-TR')}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13, color: 'var(--tx2)' }}>
            <div>Danışman: <b style={{ color: 'var(--tx)' }}>{pname(c.assigned_to)}</b></div>
            <div>Toplam harcama: <b style={{ color: 'var(--tx)' }}>{Number(c.total_spent).toLocaleString('tr-TR')} ₺</b> ({c.order_count} sipariş)</div>
            <div>Son alışveriş: <b style={{ color: 'var(--tx)' }}>{c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('tr-TR') : '—'}</b></div>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Sipariş/harcama verisi ERP–POS–e-ticaret entegrasyonundan gelir; elle girilemez.</div>
          </div>
          {active && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {canWrite && <button className="btn-ghost" onClick={() => setEdit({ ...c })}>Bilgileri düzenle</button>}
              {crm.can('vip.manage') && <button className="btn-ghost" onClick={() => setVip(!c.is_vip)}><Crown size={14} /> {c.is_vip ? 'VIP\'den çıkar' : 'VIP yap'}</button>}
              {crm.can('customers.assign') && (
                <select className="inp" value={c.assigned_to || ''} onChange={e => assign(e.target.value)}>
                  <option value="">Danışman ata…</option>{advisors.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}
                </select>
              )}
              {!c.assigned_to && canWrite && !crm.can('customers.assign') && <button className="btn-ghost" onClick={() => assign(crm.profile.id)}><UserCheck size={14} /> Müşteriyi üstlen</button>}
              {crm.can('customers.merge') && <button className="btn-ghost" onClick={() => setShowMerge(true)}><GitMerge size={14} /> Başka kayıtla birleştir</button>}
              {crm.can('customers.delete') && <button className="btn-danger" onClick={() => setAnon(true)}><ShieldOff size={14} /> Anonimleştir (KVKK)</button>}
            </div>
          )}
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="tabs" style={{ overflowX: 'auto' }}>{TABS.map(t => <button key={t} className={`tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>{t}</button>)}</div>
          <div style={{ padding: 16 }}>
            {tab === 'Genel' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, fontSize: 13, color: 'var(--tx2)' }}>
                <div>Doğum tarihi: <b style={{ color: 'var(--tx)' }}>{c.birth_date ? new Date(c.birth_date).toLocaleDateString('tr-TR') : '—'}</b></div>
                <div>VIP başlangıç: <b style={{ color: 'var(--tx)' }}>{c.vip_since ? new Date(c.vip_since).toLocaleDateString('tr-TR') : '—'}</b></div>
                <div>Etkileşim: <b style={{ color: 'var(--tx)' }}>{inter.length}</b> · Ziyaret: <b style={{ color: 'var(--tx)' }}>{visits.length}</b> · Not: <b style={{ color: 'var(--tx)' }}>{notes.length}</b></div>
              </div>
            )}
            {tab === 'Notlar' && (<>
              {canWrite && active && <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}><textarea className="inp" rows={2} value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Not ekle" /><button className="btn" onClick={addNote}>Ekle</button></div>}
              {notes.length === 0 ? empty('Not yok') : notes.map(n => <div key={n.id} style={{ borderTop: '1px solid var(--bdr)', padding: '10px 0', fontSize: 13 }}><div style={{ color: 'var(--tx)', whiteSpace: 'pre-wrap' }}>{n.body}</div><div style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 4 }}>{pname(n.author_id)} · {dt(n.created_at)}</div></div>)}
            </>)}
            {tab === 'Etkileşimler' && (<>
              {canWrite && active && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <select className="inp" style={{ width: 150 }} value={iForm.type} onChange={e => setIForm(f => ({ ...f, type: e.target.value }))}>{Object.entries(INTERACTION_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <select className="inp" style={{ width: 120 }} value={iForm.direction} onChange={e => setIForm(f => ({ ...f, direction: e.target.value }))}><option value="outbound">Giden</option><option value="inbound">Gelen</option></select>
                <input className="inp" style={{ flex: 1, minWidth: 200 }} value={iForm.summary} onChange={e => setIForm(f => ({ ...f, summary: e.target.value }))} placeholder="Özet" />
                <button className="btn" onClick={addInter}>Kaydet</button></div>}
              {inter.length === 0 ? empty('Etkileşim kaydı yok') : inter.map(n => <div key={n.id} style={{ borderTop: '1px solid var(--bdr)', padding: '10px 0', fontSize: 13 }}><span className="badge badge-blue">{INTERACTION_LABEL[n.type]}</span> <span style={{ color: 'var(--tx)' }}>{n.summary}</span><div style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 4 }}>{pname(n.user_id)} · {dt(n.occurred_at)}</div></div>)}
            </>)}
            {tab === 'Ziyaretler' && (<>
              {canWrite && active && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <input className="inp" style={{ flex: 1, minWidth: 160 }} placeholder="Amaç" value={vForm.purpose} onChange={e => setVForm(f => ({ ...f, purpose: e.target.value }))} />
                <input className="inp" style={{ flex: 1, minWidth: 160 }} placeholder="Sonuç" value={vForm.outcome} onChange={e => setVForm(f => ({ ...f, outcome: e.target.value }))} />
                <input className="inp" style={{ flex: 2, minWidth: 200 }} placeholder="Not" value={vForm.notes} onChange={e => setVForm(f => ({ ...f, notes: e.target.value }))} />
                <button className="btn" onClick={addVisit}>Ziyaret ekle</button></div>}
              {visits.length === 0 ? empty('Mağaza ziyareti yok') : visits.map(v => <div key={v.id} style={{ borderTop: '1px solid var(--bdr)', padding: '10px 0', fontSize: 13, color: 'var(--tx2)' }}><b style={{ color: 'var(--tx)' }}>{sname(v.store_id)}</b> · {dt(v.visited_at)} · {pname(v.advisor_id)}<div>{[v.purpose, v.outcome, v.notes].filter(Boolean).join(' — ')}</div></div>)}
            </>)}
            {tab === 'Siparişler' && (orders.length === 0 ? empty('Sipariş yok. Siparişler ERP/POS/e-ticaret entegrasyonundan otomatik gelir.') : orders.map(o => <div key={o.id} style={{ borderTop: '1px solid var(--bdr)', padding: '10px 0', fontSize: 13, color: 'var(--tx2)', display: 'flex', justifyContent: 'space-between' }}><span><b style={{ color: 'var(--tx)' }}>{o.order_no || o.id.slice(0, 8)}</b> · {dt(o.ordered_at)} · {o.store_id ? sname(o.store_id) : o.source_system}</span><span><span className="badge badge-muted">{o.status}</span> <b style={{ color: 'var(--tx)' }}>{Number(o.total).toLocaleString('tr-TR')} ₺</b></span></div>))}
            {tab === 'Adresler' && (<>
              {canWrite && active && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <input className="inp" style={{ width: 90 }} placeholder="Etiket" value={aForm.label} onChange={e => setAForm(f => ({ ...f, label: e.target.value }))} />
                <input className="inp" style={{ flex: 2, minWidth: 220 }} placeholder="Adres" value={aForm.line} onChange={e => setAForm(f => ({ ...f, line: e.target.value }))} />
                <input className="inp" style={{ width: 130 }} placeholder="İlçe" value={aForm.district} onChange={e => setAForm(f => ({ ...f, district: e.target.value }))} />
                <input className="inp" style={{ width: 130 }} placeholder="Şehir" value={aForm.city} onChange={e => setAForm(f => ({ ...f, city: e.target.value }))} />
                <button className="btn" onClick={addAddr}><Plus size={14} /> Ekle</button></div>}
              {addrs.length === 0 ? empty('Adres yok') : addrs.map(a => <div key={a.id} style={{ borderTop: '1px solid var(--bdr)', padding: '10px 0', fontSize: 13, color: 'var(--tx2)', display: 'flex', justifyContent: 'space-between' }}><span><span className="badge badge-muted">{a.label}</span> {[a.line, a.district, a.city].filter(Boolean).join(', ')}</span>{canWrite && <button onClick={() => delAddr(a.id)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><Trash2 size={14} /></button>}</div>)}
            </>)}
            {tab === 'İzinler' && (<>
              {!crm.can('consents.read') ? empty('İzin bilgilerini görme yetkiniz yok') : (<>
                <div style={{ fontSize: 12, color: 'var(--tx3)', marginBottom: 8 }}>Ticari elektronik ileti izinleri (pazarlama). İzni olmayan müşteriye toplu iletişim gönderilmez. İYS eşitlemesi entegrasyon aşamasında bağlanacaktır (durum: eşitlenmedi).</div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}><tbody>{['sms', 'email', 'call', 'whatsapp'].map(ch => consentRow(ch, 'marketing'))}</tbody></table>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx2)', margin: '16px 0 6px' }}>İzin geçmişi</div>
                {cevents.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>Kayıt yok</div> : cevents.map(e => <div key={e.id} style={{ fontSize: 12.5, color: 'var(--tx2)', padding: '3px 0' }}>{dt(e.created_at)} · {CHANNEL_LABEL[e.channel]} → {CONSENT_LABEL[e.action]?.[0] || e.action}</div>)}
              </>)}
            </>)}
            {tab === 'İlgi' && (<>
              {canWrite && active && <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                <select className="inp" style={{ width: 130 }} value={intForm.kind} onChange={e => setIntForm({ kind: e.target.value, ref: '', note: '' })}><option value="product">Ürün</option><option value="collection">Koleksiyon</option></select>
                <select className="inp" style={{ flex: 1, minWidth: 200 }} value={intForm.ref} onChange={e => setIntForm(f => ({ ...f, ref: e.target.value }))}>
                  <option value="">Seçin</option>
                  {intForm.kind === 'product' ? products.map(p => <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>) : collections.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <input className="inp" style={{ flex: 1, minWidth: 160 }} placeholder="Not" value={intForm.note} onChange={e => setIntForm(f => ({ ...f, note: e.target.value }))} />
                <button className="btn" onClick={addInterest}>Ekle</button></div>}
              {interests.length === 0 ? empty('İlgilenilen ürün/koleksiyon yok (ürünler Ürünler sayfasından eklenir)') : interests.map(i => <div key={i.id} style={{ borderTop: '1px solid var(--bdr)', padding: '10px 0', fontSize: 13, color: 'var(--tx2)', display: 'flex', justifyContent: 'space-between' }}><span><b style={{ color: 'var(--tx)' }}>{i.product_id ? products.find(p => p.id === i.product_id)?.name : collections.find(p => p.id === i.collection_id)?.name}</b> {i.note && `— ${i.note}`}</span>{canWrite && <button onClick={() => delInterest(i.id)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><Trash2 size={14} /></button>}</div>)}
            </>)}
          </div>
        </div>
      </div>

      {edit && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setEdit(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 480 }}>
            <h2 className="modal-title">Müşteri Bilgileri</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="modal-grid">
                <div><label className="label">Ad</label><input className="inp" value={edit.first_name || ''} onChange={e => setEdit(f => ({ ...f, first_name: e.target.value }))} /></div>
                <div><label className="label">Soyad</label><input className="inp" value={edit.last_name || ''} onChange={e => setEdit(f => ({ ...f, last_name: e.target.value }))} /></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Telefon</label><input className="inp" value={edit.phone || ''} onChange={e => setEdit(f => ({ ...f, phone: e.target.value }))} /></div>
                <div><label className="label">E-posta</label><input className="inp" value={edit.email || ''} onChange={e => setEdit(f => ({ ...f, email: e.target.value }))} /></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Şehir</label><input className="inp" value={edit.city || ''} onChange={e => setEdit(f => ({ ...f, city: e.target.value }))} /></div>
                <div><label className="label">Doğum tarihi</label><input className="inp" type="date" value={edit.birth_date || ''} onChange={e => setEdit(f => ({ ...f, birth_date: e.target.value }))} /></div>
              </div>
              <div><label className="label">Kaynak</label><select className="inp" value={edit.source} onChange={e => setEdit(f => ({ ...f, source: e.target.value }))}>{Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              {msg && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{msg}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setEdit(null)}>Vazgeç</button><button className="btn" onClick={saveEdit}>Kaydet</button></div>
            </div>
          </div>
        </div>
      )}

      {showMerge && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setShowMerge(false) }}>
          <div className="modal anim-pop" style={{ maxWidth: 480 }}>
            <h2 className="modal-title">Kayıt Birleştir</h2>
            <p style={{ fontSize: 12.5, color: 'var(--tx3)', marginTop: 0 }}>Seçtiğiniz kayıt bu müşteriye (#{c.customer_no}) katılır; not, etkileşim, ziyaret ve izin geçmişi korunur. İzin iptali her zaman geçerli kalır.</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input className="inp" placeholder="Ad, telefon veya e-posta" value={mergeQ} onChange={e => setMergeQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchMerge()} />
              <button className="btn-ghost" onClick={searchMerge}>Ara</button>
            </div>
            {mergeRes.map(r => (
              <label key={r.id} style={{ display: 'flex', gap: 8, padding: '6px 0', fontSize: 13, color: 'var(--tx2)', cursor: 'pointer' }}>
                <input type="radio" name="m" checked={mergeSel?.id === r.id} onChange={() => setMergeSel(r)} /> #{r.customer_no} {r.first_name} {r.last_name} · {r.phone || '—'}
              </label>
            ))}
            {msg && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{msg}</div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}><button className="btn-ghost" onClick={() => setShowMerge(false)}>Vazgeç</button><button className="btn" disabled={!mergeSel} onClick={doMerge}>Birleştir</button></div>
          </div>
        </div>
      )}

      <ConfirmModal open={anon} danger title="Müşteriyi anonimleştir" confirmText="Anonimleştir"
        message="Ad, telefon, e-posta, adres ve notlar kalıcı olarak silinir; tüm izinler iptal edilir. Bu işlem geri alınamaz."
        onConfirm={doAnon} onCancel={() => setAnon(false)} />
    </>
  )
}
