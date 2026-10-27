'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, X, Trash2, Tags } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import Empty from '@/components/crm/Empty'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type PL = { id: string; name: string; currency: string; discount_pct: number | null; valid_from: string | null; valid_to: string | null; is_active: boolean; notes: string | null }
type Item = { product_id: string; price: number }
type Prod = { id: string; sku: string; name: string; price: number | null }
type St = { id: string; name: string; code: string }
const EMPTY = { id: '', name: '', discount_pct: '', valid_from: '', valid_to: '', is_active: true, notes: '' }
const money = (n: number | null | undefined) => n == null ? '—' : n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

export default function FiyatlarPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const canManage = crm.can('pricing.manage')
  const [lists, setLists] = useState<PL[]>([])
  const [sel, setSel] = useState<string>('')
  const [items, setItems] = useState<Item[]>([])
  const [prods, setProds] = useState<Prod[]>([])
  const [stores, setStores] = useState<St[]>([])
  const [assign, setAssign] = useState<Record<string, string>>({})
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [q, setQ] = useState('')
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [l, p, s, a] = await Promise.all([
      supabase.from('price_lists').select('*').order('name'),
      supabase.from('products').select('id, sku, name, price').eq('status', 'active').order('name').limit(2000),
      supabase.from('stores').select('id, name, code').in('store_type', ['dealer', 'wholesale']).eq('is_active', true).order('name'),
      supabase.from('store_price_list').select('store_id, price_list_id'),
    ])
    const ll = (l.data || []) as PL[]
    setLists(ll); setProds((p.data || []) as Prod[]); setStores((s.data || []) as St[])
    setAssign(Object.fromEntries((a.data || []).map((x: any) => [x.store_id, x.price_list_id])))
    setSel(cur => cur && ll.some(x => x.id === cur) ? cur : ll[0]?.id || '')
    setLoading(false)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  useEffect(() => {
    if (!sel) { setItems([]); return }
    supabase.from('price_list_items').select('product_id, price').eq('price_list_id', sel).then(r => setItems((r.data || []) as Item[]))
  }, [sel])  // eslint-disable-line react-hooks/exhaustive-deps

  const cur = lists.find(l => l.id === sel)
  const prodOf = useMemo(() => new Map(prods.map(p => [p.id, p])), [prods])
  const hits = q.trim().length >= 2 ? prods.filter(p => `${p.name} ${p.sku}`.toLowerCase().includes(q.trim().toLowerCase()) && !items.some(i => i.product_id === p.id)).slice(0, 8) : []

  async function saveList() {
    if (!form || form.name.trim().length < 2) { setErr('Liste adı gerekli'); return }
    const d = form.discount_pct === '' ? null : Number(form.discount_pct)
    if (d !== null && (isNaN(d) || d < 0 || d > 100)) { setErr('İskonto 0-100 arası olmalı'); return }
    const payload = { name: form.name.trim(), discount_pct: d, valid_from: form.valid_from || null, valid_to: form.valid_to || null, is_active: form.is_active, notes: form.notes.trim() || null }
    const { data, error } = form.id ? await supabase.from('price_lists').update(payload).eq('id', form.id).select('id').single() : await supabase.from('price_lists').insert(payload).select('id').single()
    if (error) { setErr(error.code === '23505' ? 'Bu isimde liste var' : error.message); return }
    setErr(''); setForm(null); setSel(data!.id); load()
  }
  async function delList() {
    if (!cur || !confirm(`"${cur.name}" listesi silinsin mi?`)) return
    const { error } = await supabase.from('price_lists').delete().eq('id', cur.id)
    if (error) { setErr(error.code === '23503' ? 'Önce bayi atamalarını kaldırın' : error.message); return }
    setErr(''); setSel(''); load()
  }
  async function addItem(p: Prod) {
    const { error } = await supabase.from('price_list_items').insert({ price_list_id: sel, product_id: p.id, price: p.price ?? 0 })
    if (error) { setErr(error.message); return }
    setQ(''); setItems(i => [...i, { product_id: p.id, price: p.price ?? 0 }])
  }
  async function setPrice(pid: string, v: string) {
    const n = Number(v.replace(',', '.'))
    if (isNaN(n) || n < 0) return
    setItems(i => i.map(x => x.product_id === pid ? { ...x, price: n } : x))
    const { error } = await supabase.from('price_list_items').update({ price: n }).eq('price_list_id', sel).eq('product_id', pid)
    if (error) setErr(error.message)
  }
  async function delItem(pid: string) {
    setItems(i => i.filter(x => x.product_id !== pid))
    await supabase.from('price_list_items').delete().eq('price_list_id', sel).eq('product_id', pid)
  }
  async function toggleStore(sid: string) {
    if (!cur) return
    if (assign[sid] === cur.id) { await supabase.from('store_price_list').delete().eq('store_id', sid) }
    else { const { error } = await supabase.from('store_price_list').upsert({ store_id: sid, price_list_id: cur.id }); if (error) { setErr(error.message); return } }
    load()
  }

  return (
    <>
      <CrmTopBar title="Fiyat Listeleri" subtitle="Bayiye özel fiyat ve iskonto"
        action={canManage && <button className="btn" onClick={() => { setForm({ ...EMPTY }); setErr('') }}><Plus size={14} /> Yeni Liste</button>} />
      <div style={{ padding: 22, maxWidth: 1200, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {err && !form && <div className="toast toast-err" style={{ margin: 0 }}>{err}</div>}
        {loading ? <div className="card anim-pulse" style={{ height: 160 }} /> : lists.length === 0 ? (
          <div className="card"><Empty Icon={Tags} title={canManage ? 'Henüz fiyat listesi yok' : 'Mağazanıza atanmış fiyat listesi yok'}
            desc={canManage ? 'Liste oluşturun: ürün bazlı özel fiyat girin ya da tüm ürünlere yüzde iskonto uygulayın, sonra bayilere atayın.' : 'Bayi fiyatlarınız tanımlandığında burada görünür.'} /></div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(220px,280px) 1fr', gap: 14, alignItems: 'start' }} className="pl-grid">
            <div className="card" style={{ overflow: 'hidden' }}>
              {lists.map(l => (
                <button key={l.id} onClick={() => setSel(l.id)} style={{ width: '100%', textAlign: 'left', padding: '12px 16px', border: 'none', borderBottom: '1px solid var(--bdr)', background: sel === l.id ? 'var(--ac2)' : 'transparent', cursor: 'pointer' }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{l.name} {!l.is_active && <span className="badge badge-red">Pasif</span>}</div>
                  <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{l.discount_pct != null ? `%${l.discount_pct} iskonto` : 'Ürün bazlı'} · {stores.filter(s => assign[s.id] === l.id).length} bayi</div>
                </button>))}
            </div>
            {cur && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div className="card" style={{ padding: 16, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>{cur.name}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>
                      {cur.discount_pct != null ? `Listede olmayan ürünlere %${cur.discount_pct} iskonto` : 'Yalnız listedeki ürünlere özel fiyat'}
                      {(cur.valid_from || cur.valid_to) && ` · ${cur.valid_from || '…'} – ${cur.valid_to || '…'}`}
                    </div>
                  </div>
                  {canManage && <>
                    <button className="btn-ghost" onClick={() => { setForm({ id: cur.id, name: cur.name, discount_pct: cur.discount_pct == null ? '' : String(cur.discount_pct), valid_from: cur.valid_from || '', valid_to: cur.valid_to || '', is_active: cur.is_active, notes: cur.notes || '' }); setErr('') }}>Düzenle</button>
                    <button className="btn-ghost" onClick={delList}><Trash2 size={14} /></button></>}
                </div>

                {canManage && (
                  <div className="card" style={{ padding: 16 }}>
                    <div className="card-title" style={{ marginBottom: 10 }}>Bu listeyi kullanan bayiler</div>
                    {stores.length === 0 ? <div style={{ fontSize: 13, color: 'var(--tx3)' }}>Tür "Bayi" veya "Toptancı" olan aktif mağaza yok.</div> : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {stores.map(s => {
                          const on = assign[s.id] === cur.id, other = assign[s.id] && !on
                          return <button key={s.id} onClick={() => toggleStore(s.id)} className={on ? 'badge badge-ac' : 'badge badge-muted'} style={{ border: 'none', cursor: 'pointer', padding: '5px 11px' }} title={other ? `Şu an: ${lists.find(l => l.id === assign[s.id])?.name}` : ''}>{s.name}{other ? ' ↻' : ''}</button>
                        })}
                      </div>)}
                    <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 8 }}>Bir bayinin tek fiyat listesi olur; başka listedeki bayiye (↻) tıklarsanız bu listeye taşınır.</div>
                  </div>)}

                <div className="card" style={{ overflow: 'hidden' }}>
                  <div style={{ padding: '14px 16px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                    <div className="card-title" style={{ flex: 1 }}>Özel fiyatlı ürünler ({items.length})</div>
                    {canManage && (
                      <div style={{ position: 'relative' }}>
                        <input className="inp" placeholder="Ürün ekle: ad veya SKU…" value={q} onChange={e => setQ(e.target.value)} style={{ minWidth: 260 }} />
                        {hits.length > 0 && <div className="card" style={{ position: 'absolute', zIndex: 20, top: '100%', left: 0, right: 0, marginTop: 4 }}>
                          {hits.map(p => <button key={p.id} onClick={() => addItem(p)} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', padding: '8px 12px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--tx)' }}><span>{p.name} <code style={{ fontSize: 11 }}>{p.sku}</code></span><span style={{ color: 'var(--tx3)' }}>{money(p.price)}</span></button>)}
                        </div>}
                      </div>)}
                  </div>
                  {items.length === 0 ? <div style={{ padding: 28, textAlign: 'center', fontSize: 13, color: 'var(--tx3)' }}>{cur.discount_pct != null ? 'Özel fiyat girilmedi; tüm ürünlere iskonto uygulanır.' : 'Henüz ürün eklenmedi.'}</div> : (
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr style={{ color: 'var(--tx3)', fontSize: 11.5, textAlign: 'left' }}><th style={{ padding: '8px 16px' }}>Ürün</th><th style={{ padding: '8px 16px' }}>Liste fiyatı</th><th style={{ padding: '8px 16px' }}>Bayi fiyatı</th><th /></tr></thead>
                      <tbody>{items.map(i => { const p = prodOf.get(i.product_id); return (
                        <tr key={i.product_id} style={{ borderTop: '1px solid var(--bdr)' }}>
                          <td style={{ padding: '9px 16px' }}>{p?.name || '—'} <code style={{ fontSize: 11 }}>{p?.sku}</code></td>
                          <td style={{ padding: '9px 16px', color: 'var(--tx3)' }}>{money(p?.price)}</td>
                          <td style={{ padding: '9px 16px' }}>{canManage ? <input className="inp" defaultValue={i.price} onBlur={e => setPrice(i.product_id, e.target.value)} style={{ width: 120 }} inputMode="decimal" /> : <b>{money(i.price)}</b>}</td>
                          <td style={{ padding: '9px 16px', textAlign: 'right' }}>{canManage && <button onClick={() => delItem(i.product_id)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', cursor: 'pointer' }}><Trash2 size={14} /></button>}</td>
                        </tr>) })}</tbody>
                    </table>)}
                </div>
              </div>)}
          </div>)}
      </div>
      <style>{`@media(max-width:820px){.pl-grid{grid-template-columns:1fr!important}}`}</style>

      {form && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{form.id ? 'Listeyi Düzenle' : 'Yeni Fiyat Listesi'}</h2><button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Liste adı *</label><input className="inp" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Bayi A – 2026" /></div>
              <div><label className="label">Genel iskonto % (listede olmayan ürünler için, boş = yok)</label><input className="inp" inputMode="decimal" value={form.discount_pct} onChange={e => setForm({ ...form, discount_pct: e.target.value })} placeholder="15" /></div>
              <div className="modal-grid">
                <div><label className="label">Başlangıç</label><input className="inp" type="date" value={form.valid_from} onChange={e => setForm({ ...form, valid_from: e.target.value })} /></div>
                <div><label className="label">Bitiş</label><input className="inp" type="date" value={form.valid_to} onChange={e => setForm({ ...form, valid_to: e.target.value })} /></div>
              </div>
              <div><label className="label">Not</label><input className="inp" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--tx2)' }}><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /> Aktif</label>
              {err && <div className="toast toast-err" style={{ margin: 0 }}>{err}</div>}
              <button className="btn" onClick={saveList} style={{ justifyContent: 'center', padding: '11px 0' }}>Kaydet</button>
            </div>
          </div>
        </div>)}
    </>
  )
}
