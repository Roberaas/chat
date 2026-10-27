'use client'
import Attachments from '@/components/crm/Attachments'
import { useCallback, useEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Acc = { id: string; account_no: number; name: string; type: string; status: string; tax_office: string | null; tax_no: string | null; city: string | null; phone: string | null; email: string | null; notes: string | null }
type Con = { id: string; account_id: string; full_name: string; title: string | null; phone: string | null; email: string | null; is_primary: boolean }
type Opp = { id: string; account_id: string; title: string; stage: string; amount: number; currency: string; expected_close_date: string | null }
const TYPE: Record<string, string> = { dealer: 'Bayi', corporate: 'Kurumsal', wholesale: 'Toptan' }
const STATUS: Record<string, string> = { prospect: 'Aday', active: 'Aktif', suspended: 'Askıda', closed: 'Kapalı' }
const STAGE: Record<string, string> = { lead: 'Aday', negotiation: 'Görüşme', quote: 'Teklif', won: 'Kazanıldı', lost: 'Kaybedildi' }
const EMPTY = { id: '', name: '', type: 'dealer', status: 'prospect', tax_office: '', tax_no: '', city: '', phone: '', email: '', notes: '' }

export default function B2BPage() {
  const supabase = createCrmBrowserClient()
  const [accs, setAccs] = useState<Acc[]>([])
  const [sel, setSel] = useState<Acc | null>(null)
  const [cons, setCons] = useState<Con[]>([])
  const [opps, setOpps] = useState<Opp[]>([])
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [conF, setConF] = useState({ full_name: '', title: '', phone: '', email: '' })
  const [oppF, setOppF] = useState({ title: '', amount: '' })
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('business_accounts').select('*').order('created_at', { ascending: false }).limit(200)
    setAccs((data || []) as Acc[])
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const loadDetail = useCallback(async (id: string) => {
    const [c, o] = await Promise.all([
      supabase.from('business_contacts').select('*').eq('account_id', id).order('is_primary', { ascending: false }),
      supabase.from('business_opportunities').select('*').eq('account_id', id).order('created_at', { ascending: false })])
    setCons((c.data || []) as Con[]); setOpps((o.data || []) as Opp[])
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  useEffect(() => { if (sel) loadDetail(sel.id) }, [sel, loadDetail])

  async function save() {
    if (!form || !form.name.trim()) { setErr('Firma adı zorunlu'); return }
    const n = (v: string) => v.trim() || null
    const payload = { name: form.name.trim(), type: form.type, status: form.status, tax_office: n(form.tax_office), tax_no: n(form.tax_no), city: n(form.city), phone: n(form.phone), email: n(form.email), notes: n(form.notes) }
    const { error } = form.id ? await supabase.from('business_accounts').update(payload).eq('id', form.id) : await supabase.from('business_accounts').insert(payload)
    if (error) { setErr(error.code === '42501' ? 'Bu işlem için yetkiniz yok' : error.message); return }
    setErr(''); setForm(null); setSel(null); load()
  }
  async function addCon() {
    if (!sel || !conF.full_name.trim()) return
    const n = (v: string) => v.trim() || null
    const { error } = await supabase.from('business_contacts').insert({ account_id: sel.id, full_name: conF.full_name.trim(), title: n(conF.title), phone: n(conF.phone), email: n(conF.email), is_primary: cons.length === 0 })
    if (error) { setErr(error.message); return }
    setErr(''); setConF({ full_name: '', title: '', phone: '', email: '' }); loadDetail(sel.id)
  }
  async function addOpp() {
    if (!sel || !oppF.title.trim()) return
    const { error } = await supabase.from('business_opportunities').insert({ account_id: sel.id, title: oppF.title.trim(), amount: Math.max(0, parseFloat(oppF.amount.replace(',', '.')) || 0) })
    if (error) { setErr(error.message); return }
    setErr(''); setOppF({ title: '', amount: '' }); loadDetail(sel.id)
  }
  async function setStage(id: string, stage: string) {
    const { error } = await supabase.from('business_opportunities').update({ stage }).eq('id', id)
    if (error) setErr(error.message); else if (sel) loadDetail(sel.id)
  }
  const shown = accs.filter(a => !q || a.name.toLowerCase().includes(q.toLowerCase()) || (a.city || '').toLowerCase().includes(q.toLowerCase()))
  const money = (v: number, c: string) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: c }).format(v)

  return (
    <>
      <CrmTopBar title="B2B / Bayi" subtitle={`${accs.length} firma`} action={<button className="btn" onClick={() => { setErr(''); setForm({ ...EMPTY }) }}><Plus size={14} /> Firma Ekle</button>} />
      <div style={{ padding: 22, maxWidth: 1000, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input className="inp" placeholder="Firma veya şehir ara…" value={q} onChange={e => setQ(e.target.value)} />
        {err && !form && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
        <div className="card">
          {shown.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>{accs.length ? 'Sonuç yok' : 'Henüz firma kaydı yok'}</div> : shown.map(a => (
            <div key={a.id} onClick={() => { setErr(''); setSel(a) }} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--bdr)', cursor: 'pointer' }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{a.name}</div><div style={{ fontSize: 12, color: 'var(--tx3)' }}>#{a.account_no} · {TYPE[a.type]}{a.city ? ` · ${a.city}` : ''}</div></div>
              <span className={`badge ${a.status === 'active' ? 'badge-green' : a.status === 'prospect' ? 'badge-amber' : 'badge-muted'}`}>{STATUS[a.status]}</span>
            </div>))}
        </div>
      </div>

      {sel && !form && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setSel(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 620, maxHeight: '88vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{sel.name}</h2><button onClick={() => setSel(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginBottom: 12 }}>{TYPE[sel.type]} · {STATUS[sel.status]}{sel.tax_no ? ` · VKN ${sel.tax_no}` : ''}{sel.phone ? ` · ${sel.phone}` : ''}{sel.email ? ` · ${sel.email}` : ''} <button className="btn-ghost" onClick={() => { setErr(''); setForm({ id: sel.id, name: sel.name, type: sel.type, status: sel.status, tax_office: sel.tax_office || '', tax_no: sel.tax_no || '', city: sel.city || '', phone: sel.phone || '', email: sel.email || '', notes: sel.notes || '' }) }}>Düzenle</button></div>
            {err && <div style={{ fontSize: 12.5, color: 'var(--red)', marginBottom: 8 }}>{err}</div>}
            <div className="card-title" style={{ marginBottom: 6 }}>İlgili kişiler</div>
            {cons.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--tx3)', marginBottom: 6 }}>Kişi yok</div>}
            {cons.map(c => <div key={c.id} style={{ fontSize: 12.5, color: 'var(--tx2)', padding: '4px 0' }}>{c.full_name}{c.is_primary ? ' ★' : ''}{c.title ? ` · ${c.title}` : ''}{c.phone ? ` · ${c.phone}` : ''}{c.email ? ` · ${c.email}` : ''}</div>)}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '8px 0 16px' }}>
              <input className="inp" style={{ flex: '1 1 140px' }} placeholder="Ad soyad" value={conF.full_name} onChange={e => setConF({ ...conF, full_name: e.target.value })} />
              <input className="inp" style={{ flex: '1 1 100px' }} placeholder="Ünvan" value={conF.title} onChange={e => setConF({ ...conF, title: e.target.value })} />
              <input className="inp" style={{ flex: '1 1 110px' }} placeholder="Telefon" value={conF.phone} onChange={e => setConF({ ...conF, phone: e.target.value })} />
              <button className="btn" onClick={addCon}>Ekle</button>
            </div>
            <div className="card-title" style={{ marginBottom: 6 }}>Fırsatlar</div>
            {opps.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--tx3)', marginBottom: 6 }}>Fırsat yok</div>}
            {opps.map(o => (
              <div key={o.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 12.5, color: 'var(--tx2)' }}>
                <span style={{ flex: 1 }}>{o.title} · {money(o.amount, o.currency)}</span>
                <select className="inp" style={{ width: 130 }} value={o.stage} onChange={e => setStage(o.id, e.target.value)}>{Object.entries(STAGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
              </div>))}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input className="inp" style={{ flex: 1 }} placeholder="Fırsat başlığı" value={oppF.title} onChange={e => setOppF({ ...oppF, title: e.target.value })} />
              <input className="inp" style={{ width: 110 }} inputMode="decimal" placeholder="Tutar (₺)" value={oppF.amount} onChange={e => setOppF({ ...oppF, amount: e.target.value })} />
              <button className="btn" onClick={addOpp}>Ekle</button>
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx2)', margin: '16px 0 6px' }}>Dosyalar (sözleşme, vergi levhası vb.)</div>
            <Attachments entity="business_account" entityId={sel.id} />
          </div>
        </div>)}

      {form && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{form.id ? 'Firmayı Düzenle' : 'Firma Ekle'}</h2><button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Firma adı *</label><input className="inp" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="modal-grid">
                <div><label className="label">Tür</label><select className="inp" value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label">Durum</label><select className="inp" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Vergi dairesi</label><input className="inp" value={form.tax_office} onChange={e => setForm({ ...form, tax_office: e.target.value })} /></div>
                <div><label className="label">Vergi no</label><input className="inp" value={form.tax_no} onChange={e => setForm({ ...form, tax_no: e.target.value })} /></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Şehir</label><input className="inp" value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} /></div>
                <div><label className="label">Telefon</label><input className="inp" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              </div>
              <div><label className="label">E-posta</label><input className="inp" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
              <div><label className="label">Not</label><textarea className="inp" rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setForm(null)}>Vazgeç</button><button className="btn" onClick={save}>Kaydet</button></div>
            </div>
          </div>
        </div>)}
    </>
  )
}
