'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, X, Search, Lock } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Coll = { id: string; code: string; name: string; description: string | null; is_active: boolean; source_system: string | null }
type Prod = { id: string; sku: string; name: string; collection_id: string | null; category: string | null; material: string | null; description: string | null; price: number | null; currency: string; status: string; source_system: string | null }
const STATUS: Record<string, [string, string]> = { active: ['Aktif', 'badge-green'], draft: ['Taslak', 'badge-muted'], discontinued: ['Üretim dışı', 'badge-red'] }
const EP = { id: '', sku: '', name: '', collection_id: '', category: '', material: '', description: '', price: '', status: 'active', source_system: null as string | null }

export default function UrunlerPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const canWrite = crm.can('products.write')
  const [tab, setTab] = useState<'urun' | 'koleksiyon'>('urun')
  const [prods, setProds] = useState<Prod[]>([])
  const [colls, setColls] = useState<Coll[]>([])
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [pf, setPf] = useState<(typeof EP & { show: boolean }) | null>(null)
  const [cf, setCf] = useState<{ show: boolean; id: string; code: string; name: string; description: string; is_active: boolean } | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [p, c] = await Promise.all([supabase.from('products').select('*').order('name').limit(1000), supabase.from('collections').select('*').order('name')])
    setProds((p.data || []) as Prod[]); setColls((c.data || []) as Coll[]); setLoading(false)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const cname = (id: string | null) => colls.find(c => c.id === id)?.name || '—'
  const list = prods.filter(p => !q.trim() || `${p.name} ${p.sku}`.toLowerCase().includes(q.trim().toLowerCase()))

  async function saveProd() {
    if (!pf) return
    if (!pf.sku.trim() || !pf.name.trim()) { setErr('SKU ve ad zorunlu'); return }
    const price = pf.price === '' ? null : Number(pf.price)
    if (price !== null && (isNaN(price) || price < 0)) { setErr('Geçersiz fiyat'); return }
    const base = { name: pf.name.trim(), collection_id: pf.collection_id || null, category: pf.category.trim() || null, material: pf.material.trim() || null, description: pf.description.trim() || null, status: pf.status }
    const sourced = !!pf.source_system
    const { error } = pf.id
      ? await supabase.from('products').update(sourced ? base : { ...base, sku: pf.sku.trim(), price }).eq('id', pf.id)
      : await supabase.from('products').insert({ ...base, sku: pf.sku.trim(), price })
    if (error) { setErr(error.code === '23505' ? 'Bu SKU kayıtlı' : error.message); return }
    setErr(''); setPf(null); load()
  }
  async function saveColl() {
    if (!cf) return
    if (!cf.code.trim() || !cf.name.trim()) { setErr('Kod ve ad zorunlu'); return }
    const payload = { name: cf.name.trim(), description: cf.description.trim() || null, is_active: cf.is_active }
    const { error } = cf.id ? await supabase.from('collections').update(payload).eq('id', cf.id) : await supabase.from('collections').insert({ ...payload, code: cf.code.trim().toUpperCase() })
    if (error) { setErr(error.code === '23505' ? 'Bu kod kayıtlı' : error.message); return }
    setErr(''); setCf(null); load()
  }

  return (
    <>
      <CrmTopBar title="Ürünler" subtitle={tab === 'urun' ? `${prods.length} ürün` : `${colls.length} koleksiyon`}
        action={canWrite && <button className="btn" onClick={() => { setErr(''); tab === 'urun' ? setPf({ ...EP, show: true }) : setCf({ show: true, id: '', code: '', name: '', description: '', is_active: true }) }}><Plus size={14} /> {tab === 'urun' ? 'Ürün Ekle' : 'Koleksiyon Ekle'}</button>} />
      <div style={{ padding: 22, maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="tabs"><button className={`tab ${tab === 'urun' ? 'active' : ''}`} onClick={() => setTab('urun')}>Ürünler</button><button className={`tab ${tab === 'koleksiyon' ? 'active' : ''}`} onClick={() => setTab('koleksiyon')}>Koleksiyonlar</button></div>
          {tab === 'urun' && <div style={{ padding: 12, position: 'relative' }}><Search size={14} style={{ position: 'absolute', left: 24, top: 25, color: 'var(--tx3)' }} /><input className="inp" style={{ paddingLeft: 32 }} placeholder="Ürün adı veya SKU" value={q} onChange={e => setQ(e.target.value)} /></div>}
          {loading ? <div className="anim-pulse" style={{ height: 120 }} /> : tab === 'urun' ? (
            list.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Ürün yok. ERP/e-ticaret entegrasyonu bağlanana kadar elle ekleyebilirsiniz.</div> : (
              <div style={{ overflowX: 'auto' }}><table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 11.5 }}>{['SKU', 'Ürün', 'Koleksiyon', 'Fiyat', 'Durum', ''].map(h => <th key={h} style={{ padding: '10px 14px' }}>{h}</th>)}</tr></thead>
                <tbody>{list.map(p => (
                  <tr key={p.id} style={{ borderTop: '1px solid var(--bdr)' }}>
                    <td style={{ padding: '10px 14px', fontFamily: 'JetBrains Mono, monospace', color: 'var(--tx3)' }}>{p.sku}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--tx)', fontWeight: 600 }}>{p.name}{p.source_system && <span title={`${p.source_system} kaynaklı`}><Lock size={11} style={{ marginLeft: 6, color: 'var(--tx3)' }} /></span>}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--tx2)' }}>{cname(p.collection_id)}</td>
                    <td style={{ padding: '10px 14px' }}>{p.price !== null ? `${Number(p.price).toLocaleString('tr-TR')} ${p.currency === 'TRY' ? '₺' : p.currency}` : '—'}</td>
                    <td style={{ padding: '10px 14px' }}><span className={`badge ${STATUS[p.status][1]}`}>{STATUS[p.status][0]}</span></td>
                    <td style={{ padding: '10px 14px', textAlign: 'right' }}>{canWrite && <button className="btn-ghost" onClick={() => { setErr(''); setPf({ id: p.id, sku: p.sku, name: p.name, collection_id: p.collection_id || '', category: p.category || '', material: p.material || '', description: p.description || '', price: p.price?.toString() || '', status: p.status, source_system: p.source_system, show: true }) }}>Düzenle</button>}</td>
                  </tr>))}</tbody></table></div>)
          ) : colls.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Koleksiyon yok</div> : colls.map(c => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--bdr)', fontSize: 13 }}>
              <div><b style={{ color: 'var(--tx)' }}>{c.name}</b> <span style={{ color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5 }}>{c.code}</span> {!c.is_active && <span className="badge badge-muted">Pasif</span>}<div style={{ color: 'var(--tx3)', fontSize: 12 }}>{prods.filter(p => p.collection_id === c.id).length} ürün{c.description ? ` · ${c.description}` : ''}</div></div>
              {canWrite && <button className="btn-ghost" onClick={() => { setErr(''); setCf({ show: true, id: c.id, code: c.code, name: c.name, description: c.description || '', is_active: c.is_active }) }}>Düzenle</button>}
            </div>))}
        </div>
      </div>

      {pf?.show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setPf(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{pf.id ? 'Ürünü Düzenle' : 'Ürün Ekle'}</h2><button onClick={() => setPf(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            {pf.source_system && <div style={{ fontSize: 12, color: 'var(--amber)', marginBottom: 10 }}>Bu ürün {pf.source_system} sisteminden gelir; SKU ve fiyat orada yönetilir.</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="modal-grid">
                <div><label className="label">SKU *</label><input className="inp" disabled={!!pf.source_system} value={pf.sku} onChange={e => setPf({ ...pf, sku: e.target.value })} /></div>
                <div><label className="label">Fiyat (₺)</label><input className="inp" inputMode="decimal" disabled={!!pf.source_system} value={pf.price} onChange={e => setPf({ ...pf, price: e.target.value })} /></div>
              </div>
              <div><label className="label">Ad *</label><input className="inp" value={pf.name} onChange={e => setPf({ ...pf, name: e.target.value })} /></div>
              <div className="modal-grid">
                <div><label className="label">Koleksiyon</label><select className="inp" value={pf.collection_id} onChange={e => setPf({ ...pf, collection_id: e.target.value })}><option value="">—</option>{colls.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                <div><label className="label">Durum</label><select className="inp" value={pf.status} onChange={e => setPf({ ...pf, status: e.target.value })}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Kategori</label><input className="inp" value={pf.category} onChange={e => setPf({ ...pf, category: e.target.value })} /></div>
                <div><label className="label">Malzeme</label><input className="inp" value={pf.material} onChange={e => setPf({ ...pf, material: e.target.value })} /></div>
              </div>
              <div><label className="label">Açıklama</label><textarea className="inp" rows={2} value={pf.description} onChange={e => setPf({ ...pf, description: e.target.value })} /></div>
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setPf(null)}>Vazgeç</button><button className="btn" onClick={saveProd}>Kaydet</button></div>
            </div>
          </div>
        </div>
      )}
      {cf?.show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setCf(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 440 }}>
            <h2 className="modal-title">{cf.id ? 'Koleksiyonu Düzenle' : 'Koleksiyon Ekle'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="modal-grid"><div><label className="label">Kod *</label><input className="inp" disabled={!!cf.id} value={cf.code} onChange={e => setCf({ ...cf, code: e.target.value })} /></div><div><label className="label">Ad *</label><input className="inp" value={cf.name} onChange={e => setCf({ ...cf, name: e.target.value })} /></div></div>
              <div><label className="label">Açıklama</label><input className="inp" value={cf.description} onChange={e => setCf({ ...cf, description: e.target.value })} /></div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--tx2)' }}><input type="checkbox" checked={cf.is_active} onChange={e => setCf({ ...cf, is_active: e.target.checked })} /> Aktif</label>
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setCf(null)}>Vazgeç</button><button className="btn" onClick={saveColl}>Kaydet</button></div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
