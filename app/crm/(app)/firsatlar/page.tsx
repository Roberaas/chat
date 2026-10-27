'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Plus, X, LayoutGrid, List, Trash2, CalendarClock } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Stage = { code: string; label: string; position: number; kind: 'open' | 'won' | 'lost' }
type Opp = {
  id: string; opp_no: number; customer_id: string; store_id: string; owner_id: string | null; title: string; stage: string; amount: number
  currency: string; expected_close_date: string | null; next_follow_up_at: string | null; lost_reason: string | null; created_at: string
  customers: { first_name: string; last_name: string } | null
}
type Item = { id: string; product_id: string | null; description: string | null; quantity: number; unit_price: number }
type Quote = { id: string; quote_no: number; status: string; total: number; valid_until: string | null; notes: string | null }
type Hist = { id: number; from_stage: string | null; to_stage: string; changed_at: string }
type Person = { id: string; first_name: string; last_name: string }
type Found = { id: string; customer_no: number; first_name: string; last_name: string; store_id: string }

const money = (n: number, cur = 'TRY') => `${Number(n).toLocaleString('tr-TR')} ${cur === 'TRY' ? '₺' : cur}`
const QSTATUS: Record<string, string> = { draft: 'Taslak', sent: 'Gönderildi', accepted: 'Kabul', rejected: 'Red', expired: 'Süresi doldu' }

export default function FirsatlarPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const canWrite = crm.can('opportunities.write')
  const [stages, setStages] = useState<Stage[]>([])
  const [opps, setOpps] = useState<Opp[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [products, setProducts] = useState<{ id: string; name: string; price: number | null }[]>([])
  const [view, setView] = useState<'kanban' | 'table'>('kanban')
  const [loading, setLoading] = useState(true)
  const [mine, setMine] = useState(false)
  const [storeF, setStoreF] = useState('')
  const [err, setErr] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const [lostFor, setLostFor] = useState<{ id: string; reason: string } | null>(null)
  const [sel, setSel] = useState<Opp | null>(null)
  const [items, setItems] = useState<Item[]>([])
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [hist, setHist] = useState<Hist[]>([])
  const [iForm, setIForm] = useState({ product_id: '', description: '', quantity: '1', unit_price: '' })
  const [qForm, setQForm] = useState({ valid_until: '', notes: '' })
  const [create, setCreate] = useState<{ show: boolean; q: string; found: Found[]; cust: Found | null; title: string; store_id: string; follow: string; close: string }>({ show: false, q: '', found: [], cust: null, title: '', store_id: '', follow: '', close: '' })

  const load = useCallback(async () => {
    setLoading(true)
    const [s, o, p, st, pr] = await Promise.all([
      supabase.from('pipeline_stages').select('*').order('position'),
      supabase.from('opportunities').select('*, customers(first_name, last_name)').order('created_at', { ascending: false }).limit(1000),
      supabase.from('profiles').select('id, first_name, last_name'),
      supabase.from('stores').select('id, name').eq('is_active', true),
      supabase.from('products').select('id, name, price').eq('status', 'active').order('name').limit(500),
    ])
    setStages((s.data || []) as Stage[]); setOpps((o.data || []) as unknown as Opp[]); setPeople((p.data || []) as Person[])
    setStores((st.data || []) as any); setProducts((pr.data || []) as any); setLoading(false)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const shown = useMemo(() => opps.filter(o => (!mine || o.owner_id === crm.profile.id) && (!storeF || o.store_id === storeF)), [opps, mine, storeF, crm.profile.id])
  const pname = (id: string | null) => { const p = people.find(x => x.id === id); return p ? `${p.first_name} ${p.last_name}` : '—' }
  const cname = (o: Opp) => o.customers ? `${o.customers.first_name} ${o.customers.last_name}`.trim() : '—'
  const stageOf = (c: string) => stages.find(s => s.code === c)

  async function move(id: string, stage: string, reason?: string) {
    const st = stageOf(stage)
    if (st?.kind === 'lost' && !reason) { setLostFor({ id, reason: '' }); return }
    const { error } = await supabase.rpc('move_opportunity', { p_opp: id, p_stage: stage, p_lost_reason: reason || null })
    if (error) { setErr(error.message); return }
    setErr(''); setLostFor(null); load()
    if (sel?.id === id) openOpp({ ...sel, stage })
  }

  async function openOpp(o: Opp) {
    setSel(o)
    const [i, q, h] = await Promise.all([
      supabase.from('opportunity_items').select('*').eq('opportunity_id', o.id).order('created_at'),
      supabase.from('quotations').select('*').eq('opportunity_id', o.id).order('created_at', { ascending: false }),
      supabase.from('opportunity_stage_history').select('*').eq('opportunity_id', o.id).order('changed_at', { ascending: false }),
    ])
    setItems((i.data || []) as Item[]); setQuotes((q.data || []) as Quote[]); setHist((h.data || []) as Hist[])
  }
  async function refreshSel() {
    if (!sel) return
    const { data } = await supabase.from('opportunities').select('*, customers(first_name, last_name)').eq('id', sel.id).single()
    if (data) await openOpp(data as unknown as Opp)
    load()
  }
  async function addItem() {
    if (!sel) return
    const prod = products.find(p => p.id === iForm.product_id)
    const price = iForm.unit_price !== '' ? Number(iForm.unit_price) : Number(prod?.price || 0)
    if (!prod && !iForm.description.trim()) { setErr('Ürün seçin veya açıklama girin'); return }
    const { error } = await supabase.from('opportunity_items').insert({
      opportunity_id: sel.id, product_id: prod?.id || null, description: iForm.description.trim() || prod?.name || null,
      quantity: Math.max(1, parseInt(iForm.quantity) || 1), unit_price: price,
    })
    if (error) { setErr(error.message); return }
    setErr(''); setIForm({ product_id: '', description: '', quantity: '1', unit_price: '' }); refreshSel()
  }
  async function delItem(id: string) { await supabase.from('opportunity_items').delete().eq('id', id); refreshSel() }
  async function saveField(patch: Record<string, unknown>) {
    if (!sel) return
    const { error } = await supabase.from('opportunities').update(patch).eq('id', sel.id)
    if (error) setErr(error.message); else { setErr(''); refreshSel() }
  }
  async function addQuote() {
    if (!sel) return
    if (!items.length) { setErr('Teklif için önce kalem ekleyin'); return }
    const { error } = await supabase.from('quotations').insert({ opportunity_id: sel.id, total: sel.amount, currency: sel.currency, valid_until: qForm.valid_until || null, notes: qForm.notes || null, created_by: crm.profile.id })
    if (error) { setErr(error.message); return }
    setErr(''); setQForm({ valid_until: '', notes: '' }); refreshSel()
  }
  async function setQuoteStatus(id: string, status: string) {
    const { error } = await supabase.from('quotations').update({ status }).eq('id', id)
    if (error) setErr(error.message); else refreshSel()
  }

  async function searchCust() {
    const t = create.q.trim().toLowerCase().replace(/[%_]/g, ' ')
    if (t.length < 2) return
    const { data } = await supabase.from('customers').select('id, customer_no, first_name, last_name, store_id').eq('status', 'active').ilike('search_text', `%${t}%`).limit(8)
    setCreate(c => ({ ...c, found: (data || []) as Found[] }))
  }
  async function createOpp() {
    if (!create.cust || !create.title.trim()) { setErr('Müşteri ve başlık zorunlu'); return }
    const { error } = await supabase.from('opportunities').insert({
      customer_id: create.cust.id, store_id: create.store_id || create.cust.store_id, title: create.title.trim(),
      next_follow_up_at: create.follow ? new Date(create.follow).toISOString() : null, expected_close_date: create.close || null,
    })
    if (error) { setErr(error.message); return }
    setErr(''); setCreate({ show: false, q: '', found: [], cust: null, title: '', store_id: '', follow: '', close: '' }); load()
  }

  const total = (list: Opp[]) => list.reduce((a, o) => a + Number(o.amount), 0)
  const overdue = (o: Opp) => o.next_follow_up_at && new Date(o.next_follow_up_at) < new Date() && stageOf(o.stage)?.kind === 'open'

  const card = (o: Opp) => (
    <div key={o.id} draggable={canWrite} onDragStart={() => setDragId(o.id)} onClick={() => openOpp(o)}
      style={{ background: 'var(--s2)', border: '1px solid var(--bdr)', borderRadius: 10, padding: 11, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 5 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{o.title}</div>
      <div style={{ fontSize: 12, color: 'var(--tx2)' }}>{cname(o)}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--tx3)' }}>
        <b style={{ color: 'var(--tx)' }}>{money(o.amount, o.currency)}</b><span>{pname(o.owner_id)}</span>
      </div>
      {o.next_follow_up_at && <div style={{ fontSize: 11.5, color: overdue(o) ? 'var(--red)' : 'var(--tx3)', display: 'flex', gap: 4, alignItems: 'center' }}><CalendarClock size={12} />{new Date(o.next_follow_up_at).toLocaleDateString('tr-TR')}</div>}
    </div>
  )

  return (
    <>
      <CrmTopBar title="Fırsatlar" subtitle={`${shown.length} fırsat`} action={canWrite && <button className="btn" onClick={() => { setCreate(c => ({ ...c, show: true })); setErr('') }}><Plus size={14} /> Fırsat Ekle</button>} />
      <div style={{ padding: 22, width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 12, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button className={view === 'kanban' ? 'btn' : 'btn-ghost'} onClick={() => setView('kanban')}><LayoutGrid size={14} /> Pano</button>
            <button className={view === 'table' ? 'btn' : 'btn-ghost'} onClick={() => setView('table')}><List size={14} /> Tablo</button>
          </div>
          <select className="inp" style={{ width: 180 }} value={storeF} onChange={e => setStoreF(e.target.value)}><option value="">Tüm mağazalar</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: 'var(--tx2)' }}><input type="checkbox" checked={mine} onChange={e => setMine(e.target.checked)} /> Benim fırsatlarım</label>
          {err && <span style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</span>}
        </div>

        {loading ? <div className="card anim-pulse" style={{ height: 200 }} /> : view === 'kanban' ? (
          <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 8 }}>
            {stages.map(s => {
              const list = shown.filter(o => o.stage === s.code)
              return (
                <div key={s.code} onDragOver={e => e.preventDefault()} onDrop={() => { if (dragId) move(dragId, s.code); setDragId(null) }}
                  style={{ minWidth: 250, width: 250, flexShrink: 0, background: 'var(--s1)', border: '1px solid var(--bdr)', borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: s.kind === 'won' ? 'var(--green)' : s.kind === 'lost' ? 'var(--red)' : 'var(--tx)' }}>{s.label}</span>
                    <span className="badge badge-muted">{list.length}</span>
                  </div>
                  <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{money(total(list))}</div>
                  {list.length === 0 ? <div style={{ fontSize: 12, color: 'var(--tx3)', padding: '10px 0', textAlign: 'center' }}>Boş</div> : list.map(card)}
                </div>
              )
            })}
          </div>
        ) : (
          <div className="card" style={{ overflowX: 'auto' }}>
            {shown.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Fırsat yok</div> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 11.5 }}>{['No', 'Başlık', 'Müşteri', 'Aşama', 'Tutar', 'Sahip', 'Takip'].map(h => <th key={h} style={{ padding: '10px 14px' }}>{h}</th>)}</tr></thead>
                <tbody>{shown.map(o => (
                  <tr key={o.id} style={{ borderTop: '1px solid var(--bdr)', cursor: 'pointer' }} onClick={() => openOpp(o)}>
                    <td style={{ padding: '10px 14px', color: 'var(--tx3)' }}>{o.opp_no}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--tx)', fontWeight: 600 }}>{o.title}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--tx2)' }}>{cname(o)}</td>
                    <td style={{ padding: '10px 14px' }}><span className={`badge ${stageOf(o.stage)?.kind === 'won' ? 'badge-green' : stageOf(o.stage)?.kind === 'lost' ? 'badge-red' : 'badge-ac'}`}>{stageOf(o.stage)?.label}</span></td>
                    <td style={{ padding: '10px 14px' }}>{money(o.amount, o.currency)}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--tx2)' }}>{pname(o.owner_id)}</td>
                    <td style={{ padding: '10px 14px', color: overdue(o) ? 'var(--red)' : 'var(--tx3)' }}>{o.next_follow_up_at ? new Date(o.next_follow_up_at).toLocaleDateString('tr-TR') : '—'}</td>
                  </tr>))}</tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {lostFor && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setLostFor(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 420 }}>
            <h2 className="modal-title">Kaybedilme nedeni</h2>
            <input className="inp" autoFocus value={lostFor.reason} onChange={e => setLostFor({ ...lostFor, reason: e.target.value })} placeholder="Örn. fiyat, stok, vazgeçti" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 14 }}>
              <button className="btn-ghost" onClick={() => setLostFor(null)}>Vazgeç</button>
              <button className="btn" disabled={!lostFor.reason.trim()} onClick={() => move(lostFor.id, 'lost', lostFor.reason.trim())}>Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {create.show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setCreate(c => ({ ...c, show: false })) }}>
          <div className="modal anim-pop" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>Fırsat Ekle</h2><button onClick={() => setCreate(c => ({ ...c, show: false }))} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label className="label">Müşteri *</label>
                {create.cust ? (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx)' }}><span>#{create.cust.customer_no} {create.cust.first_name} {create.cust.last_name}</span><button className="btn-ghost" onClick={() => setCreate(c => ({ ...c, cust: null }))}>Değiştir</button></div>
                ) : (<>
                  <div style={{ display: 'flex', gap: 8 }}><input className="inp" placeholder="Ad, telefon veya e-posta" value={create.q} onChange={e => setCreate(c => ({ ...c, q: e.target.value }))} onKeyDown={e => e.key === 'Enter' && searchCust()} /><button className="btn-ghost" onClick={searchCust}>Ara</button></div>
                  {create.found.map(f => <div key={f.id} onClick={() => setCreate(c => ({ ...c, cust: f, store_id: f.store_id }))} style={{ padding: '6px 0', fontSize: 13, color: 'var(--tx2)', cursor: 'pointer' }}>#{f.customer_no} {f.first_name} {f.last_name}</div>)}
                </>)}
              </div>
              <div><label className="label">Başlık *</label><input className="inp" value={create.title} onChange={e => setCreate(c => ({ ...c, title: e.target.value }))} placeholder="Örn. Nişan yüzüğü talebi" /></div>
              <div className="modal-grid">
                <div><label className="label">Mağaza</label><select className="inp" value={create.store_id} onChange={e => setCreate(c => ({ ...c, store_id: e.target.value }))}>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                <div><label className="label">Tahmini kapanış</label><input className="inp" type="date" value={create.close} onChange={e => setCreate(c => ({ ...c, close: e.target.value }))} /></div>
              </div>
              <div><label className="label">Sonraki takip</label><input className="inp" type="datetime-local" value={create.follow} onChange={e => setCreate(c => ({ ...c, follow: e.target.value }))} /></div>
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setCreate(c => ({ ...c, show: false }))}>Vazgeç</button><button className="btn" onClick={createOpp}>Oluştur</button></div>
            </div>
          </div>
        </div>
      )}

      {sel && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setSel(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 680, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <div><h2 className="modal-title" style={{ marginBottom: 2 }}>{sel.title}</h2>
                <Link href={`/crm/musteriler/${sel.customer_id}`} style={{ fontSize: 12.5, color: 'var(--ac)' }}>{cname(sel)}</Link> <span style={{ fontSize: 12, color: 'var(--tx3)' }}>· #{sel.opp_no} · Sahip: {pname(sel.owner_id)}</span></div>
              <button onClick={() => setSel(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
            </div>
            <div className="modal-grid" style={{ marginBottom: 12 }}>
              <div><label className="label">Aşama</label>
                <select className="inp" disabled={!canWrite} value={sel.stage} onChange={e => move(sel.id, e.target.value)}>{stages.map(s => <option key={s.code} value={s.code}>{s.label}</option>)}</select></div>
              <div><label className="label">Tutar</label><input className="inp" disabled value={money(sel.amount, sel.currency)} /></div>
            </div>
            {sel.lost_reason && <div style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 10 }}>Kayıp nedeni: {sel.lost_reason}</div>}
            <div className="modal-grid" style={{ marginBottom: 14 }}>
              <div><label className="label">Sonraki takip</label><input className="inp" type="datetime-local" disabled={!canWrite} defaultValue={sel.next_follow_up_at ? new Date(new Date(sel.next_follow_up_at).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''} onBlur={e => saveField({ next_follow_up_at: e.target.value ? new Date(e.target.value).toISOString() : null })} /></div>
              <div><label className="label">Tahmini kapanış</label><input className="inp" type="date" disabled={!canWrite} defaultValue={sel.expected_close_date || ''} onBlur={e => saveField({ expected_close_date: e.target.value || null })} /></div>
            </div>

            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)', marginBottom: 6 }}>Ürünler</div>
            {items.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--tx3)', marginBottom: 8 }}>Kalem yok</div> : items.map(i => (
              <div key={i.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: 'var(--tx2)', padding: '5px 0', borderTop: '1px solid var(--bdr)' }}>
                <span>{i.description} × {i.quantity}</span><span>{money(i.quantity * i.unit_price)} {canWrite && <button onClick={() => delItem(i.id)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><Trash2 size={13} /></button>}</span>
              </div>))}
            {canWrite && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 16px' }}>
                <select className="inp" style={{ flex: 2, minWidth: 160 }} value={iForm.product_id} onChange={e => setIForm(f => ({ ...f, product_id: e.target.value, unit_price: '' }))}><option value="">Ürün seç (veya serbest yaz)</option>{products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                <input className="inp" style={{ flex: 2, minWidth: 140 }} placeholder="Açıklama" value={iForm.description} onChange={e => setIForm(f => ({ ...f, description: e.target.value }))} />
                <input className="inp" style={{ width: 60 }} inputMode="numeric" value={iForm.quantity} onChange={e => setIForm(f => ({ ...f, quantity: e.target.value }))} />
                <input className="inp" style={{ width: 100 }} inputMode="decimal" placeholder="Birim fiyat" value={iForm.unit_price} onChange={e => setIForm(f => ({ ...f, unit_price: e.target.value }))} />
                <button className="btn" onClick={addItem}>Ekle</button>
              </div>)}

            {crm.can('quotations.write') || crm.can('opportunities.read') ? (<>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)', marginBottom: 6 }}>Teklifler</div>
              {quotes.length === 0 ? <div style={{ fontSize: 12.5, color: 'var(--tx3)', marginBottom: 8 }}>Teklif yok</div> : quotes.map(q => (
                <div key={q.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, color: 'var(--tx2)', padding: '5px 0', borderTop: '1px solid var(--bdr)' }}>
                  <span>T-{q.quote_no} · {money(q.total)} {q.valid_until && `· ${new Date(q.valid_until).toLocaleDateString('tr-TR')}'e kadar`}</span>
                  {crm.can('quotations.write') ? <select className="inp" style={{ width: 130 }} value={q.status} onChange={e => setQuoteStatus(q.id, e.target.value)}>{Object.entries(QSTATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select> : <span className="badge badge-muted">{QSTATUS[q.status]}</span>}
                </div>))}
              {crm.can('quotations.write') && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 16px' }}>
                <input className="inp" style={{ width: 150 }} type="date" value={qForm.valid_until} onChange={e => setQForm(f => ({ ...f, valid_until: e.target.value }))} />
                <input className="inp" style={{ flex: 1, minWidth: 140 }} placeholder="Teklif notu" value={qForm.notes} onChange={e => setQForm(f => ({ ...f, notes: e.target.value }))} />
                <button className="btn" onClick={addQuote}>Teklif oluştur</button></div>}
            </>) : null}

            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)', marginBottom: 6 }}>Aşama geçmişi</div>
            {hist.map(h => <div key={h.id} style={{ fontSize: 12.5, color: 'var(--tx3)', padding: '2px 0' }}>{new Date(h.changed_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })} · {h.from_stage ? `${stageOf(h.from_stage)?.label} → ` : ''}{stageOf(h.to_stage)?.label}</div>)}
            {err && <div style={{ fontSize: 12.5, color: 'var(--red)', marginTop: 10 }}>{err}</div>}
          </div>
        </div>
      )}
    </>
  )
}
