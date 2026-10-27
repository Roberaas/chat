'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, X, Crown, Trash2 } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { SOURCE_LABEL } from '@/lib/crm/labels'

type Seg = { id: string; name: string; description: string | null; rules: Record<string, any>; is_active: boolean }
const EMPTY = { id: '', name: '', description: '', vip: '', store_id: '', min_spent: '', max_spent: '', min_orders: '', inactive_days: '', registered_within_days: '', source: '', city: '', birthday_month: '', consent_channel: '', tag_id: '', custom_key: '', custom_value: '' }
type Form = typeof EMPTY

function toRules(f: Form) {
  const r: Record<string, any> = {}
  if (f.vip) r.vip = f.vip === 'true'
  if (f.store_id) r.store_id = f.store_id
  for (const k of ['min_spent', 'max_spent'] as const) if (f[k].trim() !== '') r[k] = Number(f[k])
  for (const k of ['min_orders', 'inactive_days', 'registered_within_days', 'birthday_month'] as const) if (f[k].trim() !== '') r[k] = parseInt(f[k])
  if (f.source) r.source = f.source
  if (f.city.trim()) r.city = f.city.trim()
  if (f.consent_channel) r.consent_channel = f.consent_channel
  if (f.tag_id) r.tag_id = f.tag_id
  if (f.custom_key && f.custom_value.trim()) { r.custom_key = f.custom_key; r.custom_value = f.custom_value.trim() }
  return r
}
function describe(r: Record<string, any>, stores: { id: string; name: string }[], tags: { id: string; name: string }[] = []) {
  const p: string[] = []
  if (r.vip !== undefined) p.push(r.vip ? 'VIP' : 'VIP değil')
  if (r.store_id) p.push(stores.find(s => s.id === r.store_id)?.name || 'Mağaza')
  if (r.min_spent !== undefined) p.push(`≥ ${Number(r.min_spent).toLocaleString('tr-TR')} ₺ harcama`)
  if (r.max_spent !== undefined) p.push(`≤ ${Number(r.max_spent).toLocaleString('tr-TR')} ₺ harcama`)
  if (r.min_orders !== undefined) p.push(`≥ ${r.min_orders} sipariş`)
  if (r.inactive_days !== undefined) p.push(`${r.inactive_days} gündür alışveriş yok`)
  if (r.registered_within_days !== undefined) p.push(`Son ${r.registered_within_days} günde kayıt`)
  if (r.source) p.push(SOURCE_LABEL[r.source] || r.source)
  if (r.city) p.push(r.city)
  if (r.birthday_month !== undefined) p.push(`Doğum ayı: ${r.birthday_month}`)
  if (r.consent_channel) p.push(`${r.consent_channel.toUpperCase()} izni var`)
  if (r.tag_id) p.push(`Etiket: ${tags.find(t => t.id === r.tag_id)?.name || '?'}`)
  if (r.custom_key) p.push(`${r.custom_key} = ${r.custom_value}`)
  return p.length ? p.join(' · ') : 'Tüm aktif müşteriler'
}

export default function SegmentlerPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const canWrite = crm.can('segments.write')
  const [segs, setSegs] = useState<Seg[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [tags, setTags] = useState<{ id: string; name: string }[]>([])
  const [cfs, setCfs] = useState<{ key: string; label: string; field_type: string; options: string[] }[]>([])
  const [form, setForm] = useState<Form | null>(null)
  const [preview, setPreview] = useState<number | null>(null)
  const [err, setErr] = useState('')
  const [vipMin, setVipMin] = useState('')
  const [vipMsg, setVipMsg] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    supabase.from('tags').select('id, name').order('name').then(t => setTags((t.data || []) as any))
    supabase.from('custom_fields').select('key, label, field_type, options').eq('is_active', true).order('label').then(t => setCfs((t.data || []) as any))
    const [s, st, v] = await Promise.all([
      supabase.from('segments').select('*').order('name'),
      supabase.from('stores').select('id, name').eq('is_active', true),
      supabase.from('system_settings').select('value').eq('key', 'vip_rules').maybeSingle(),
    ])
    const list = (s.data || []) as Seg[]
    setSegs(list); setStores((st.data || []) as any)
    if (v.data?.value?.min_spent) setVipMin(String(v.data.value.min_spent))
    setLoading(false)
    const c: Record<string, number> = {}
    await Promise.all(list.map(async x => { const { data } = await supabase.rpc('count_segment', { p_rules: x.rules }); c[x.id] = Number(data || 0) }))
    setCounts(c)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  async function runPreview(f: Form) { const { data, error } = await supabase.rpc('count_segment', { p_rules: toRules(f) }); setPreview(error ? null : Number(data)) }
  async function save() {
    if (!form || !form.name.trim()) { setErr('Ad zorunlu'); return }
    const payload = { name: form.name.trim(), description: form.description.trim() || null, rules: toRules(form) }
    const { error } = form.id ? await supabase.from('segments').update(payload).eq('id', form.id) : await supabase.from('segments').insert(payload)
    if (error) { setErr(error.code === '23505' ? 'Bu isim kullanımda' : error.message); return }
    setErr(''); setForm(null); setPreview(null); load()
  }
  async function del(id: string) { const { error } = await supabase.from('segments').delete().eq('id', id); if (error) setErr(error.message); else load() }
  async function saveVip() {
    const n = Number(vipMin)
    if (!n || n <= 0) { setVipMsg('Geçerli bir tutar girin'); return }
    const { error } = await supabase.from('system_settings').upsert({ key: 'vip_rules', value: { min_spent: n } })
    setVipMsg(error ? error.message : 'Kural kaydedildi')
  }
  async function applyVip() {
    const { data, error } = await supabase.rpc('apply_vip_rules')
    setVipMsg(error ? error.message : `${data} müşteri VIP yapıldı`)
    load()
  }
  const fromSeg = (s: Seg): Form => {
    const r = s.rules
    return { ...EMPTY, id: s.id, name: s.name, description: s.description || '', vip: r.vip === undefined ? '' : String(r.vip), store_id: r.store_id || '', min_spent: r.min_spent ?? '', max_spent: r.max_spent ?? '', min_orders: r.min_orders ?? '', inactive_days: r.inactive_days ?? '', registered_within_days: r.registered_within_days ?? '', source: r.source || '', city: r.city || '', birthday_month: r.birthday_month ?? '', consent_channel: r.consent_channel || '', tag_id: r.tag_id || '', custom_key: r.custom_key || '', custom_value: r.custom_value || '' } as Form
  }
  const set = (k: keyof Form, v: string) => { if (!form) return; const f = { ...form, [k]: v }; setForm(f); runPreview(f) }

  return (
    <>
      <CrmTopBar title="Segmentler" subtitle={`${segs.length} segment`} action={canWrite && <button className="btn" onClick={() => { setForm({ ...EMPTY }); setPreview(null); setErr(''); runPreview(EMPTY) }}><Plus size={14} /> Segment Ekle</button>} />
      <div style={{ padding: 22, maxWidth: 1000, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {err && !form && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
        <div className="card">
          {loading ? <div className="anim-pulse" style={{ height: 100 }} /> : segs.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Segment yok</div> : segs.map(s => (
            <div key={s.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--bdr)' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{s.name}</div>
                <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{describe(s.rules, stores, tags)}</div>
              </div>
              <span className="badge badge-ac">{counts[s.id] ?? '…'} müşteri</span>
              {canWrite && <><button className="btn-ghost" onClick={() => { setForm(fromSeg(s)); setErr(''); runPreview(fromSeg(s)) }}>Düzenle</button>
                <button onClick={() => del(s.id)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><Trash2 size={14} /></button></>}
            </div>))}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>Sayılar yalnızca erişim yetkinizin olduğu müşterileri kapsar.</div>

        {crm.can('vip.manage') && (
          <div className="card" style={{ padding: 18 }}>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 14, fontWeight: 700, color: 'var(--tx)', marginBottom: 6 }}><Crown size={15} style={{ color: 'var(--amber)' }} /> VIP kuralı</div>
            <div style={{ fontSize: 12.5, color: 'var(--tx3)', marginBottom: 10 }}>Toplam harcaması eşiğe ulaşan müşteriler VIP yapılır (harcama verisi sipariş entegrasyonundan gelir). Otomatik VIP'den çıkarma yapılmaz.</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input className="inp" style={{ width: 160 }} inputMode="decimal" placeholder="Eşik (₺)" value={vipMin} onChange={e => setVipMin(e.target.value)} />
              <button className="btn-ghost" onClick={saveVip}>Kaydet</button>
              <button className="btn" onClick={applyVip}>Kuralı şimdi uygula</button>
              {vipMsg && <span style={{ fontSize: 12.5, color: 'var(--tx2)' }}>{vipMsg}</span>}
            </div>
          </div>)}
      </div>

      {form && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 560, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{form.id ? 'Segmenti Düzenle' : 'Segment Ekle'}</h2><button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="modal-grid"><div><label className="label">Ad *</label><input className="inp" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
                <div><label className="label">Açıklama</label><input className="inp" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div></div>
              <div className="modal-grid">
                <div><label className="label">VIP</label><select className="inp" value={form.vip} onChange={e => set('vip', e.target.value)}><option value="">Fark etmez</option><option value="true">Sadece VIP</option><option value="false">VIP olmayan</option></select></div>
                <div><label className="label">Mağaza</label><select className="inp" value={form.store_id} onChange={e => set('store_id', e.target.value)}><option value="">Tümü</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Min. harcama (₺)</label><input className="inp" inputMode="decimal" value={form.min_spent} onChange={e => set('min_spent', e.target.value)} /></div>
                <div><label className="label">Maks. harcama (₺)</label><input className="inp" inputMode="decimal" value={form.max_spent} onChange={e => set('max_spent', e.target.value)} /></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Min. sipariş sayısı</label><input className="inp" inputMode="numeric" value={form.min_orders} onChange={e => set('min_orders', e.target.value)} /></div>
                <div><label className="label">X gündür alışveriş yok</label><input className="inp" inputMode="numeric" value={form.inactive_days} onChange={e => set('inactive_days', e.target.value)} /></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Son X günde kayıt</label><input className="inp" inputMode="numeric" value={form.registered_within_days} onChange={e => set('registered_within_days', e.target.value)} /></div>
                <div><label className="label">Doğum ayı (1-12)</label><input className="inp" inputMode="numeric" value={form.birthday_month} onChange={e => set('birthday_month', e.target.value)} /></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Kaynak</label><select className="inp" value={form.source} onChange={e => set('source', e.target.value)}><option value="">Tümü</option>{Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label">Şehir</label><input className="inp" value={form.city} onChange={e => set('city', e.target.value)} /></div>
              </div>
              <div><label className="label">Pazarlama izni olanlar</label><select className="inp" value={form.consent_channel} onChange={e => set('consent_channel', e.target.value)}><option value="">Fark etmez</option><option value="sms">SMS</option><option value="email">E-posta</option><option value="whatsapp">WhatsApp</option><option value="call">Arama</option></select></div>
              <div className="modal-grid">
                <div><label className="label">Etiket</label><select className="inp" value={form.tag_id} onChange={e => set('tag_id', e.target.value)}><option value="">Fark etmez</option>{tags.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
                <div><label className="label">Özel alan</label><select className="inp" value={form.custom_key} onChange={e => set('custom_key', e.target.value)}><option value="">Fark etmez</option>{cfs.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
              </div>
              {form.custom_key && <div><label className="label">Özel alan değeri</label>{(() => { const c = cfs.find(x => x.key === form.custom_key); return c?.field_type === 'select' ? <select className="inp" value={form.custom_value} onChange={e => set('custom_value', e.target.value)}><option value="">Seçin</option>{c.options.map(o => <option key={o} value={o}>{o}</option>)}</select> : <input className="inp" value={form.custom_value} onChange={e => set('custom_value', e.target.value)} /> })()}</div>}
              <div style={{ fontSize: 13, color: 'var(--tx2)' }}>Eşleşen müşteri: <b style={{ color: 'var(--tx)' }}>{preview ?? '…'}</b></div>
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setForm(null)}>Vazgeç</button><button className="btn" onClick={save}>Kaydet</button></div>
            </div>
          </div>
        </div>)}
    </>
  )
}
