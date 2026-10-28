'use client'
import { useEffect, useMemo, useState } from 'react'
import { Store, Users } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { TR_PROVINCES, TR_VIEWBOX } from '@/lib/crm/tr-map-data'

type StoreRow = { id: string; name: string; city: string | null; store_type: string }
type Info = { stores: { name: string; type: string }[]; customers: number }

const TYPE_LABEL: Record<string, string> = { store: 'Perakende mağaza', hq: 'Merkez', online: 'E-ticaret', dealer: 'Bayi', wholesale: 'Toptan' }
const norm = (s: string) => s.toLocaleLowerCase('tr').replace(/[çğıöşü]/g, c => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c] as string)).replace(/[^a-z]/g, '')

// Örnek veri (gerçek kayıt değildir, yalnızca haritayı göstermek içindir)
const DEMO: Record<string, Info> = {
  İstanbul: { customers: 412, stores: [{ name: 'Kadıköy Mağaza', type: 'store' }, { name: 'Nişantaşı Mağaza', type: 'store' }, { name: 'İstanbul Toptan', type: 'wholesale' }] },
  Ankara: { customers: 186, stores: [{ name: 'Ankara Kızılay Mağaza', type: 'store' }, { name: 'Ankara Bayi', type: 'dealer' }] },
  İzmir: { customers: 154, stores: [{ name: 'Alsancak Mağaza', type: 'store' }] },
  Bursa: { customers: 97, stores: [{ name: 'Bursa Bayi', type: 'dealer' }] },
  Kayseri: { customers: 73, stores: [{ name: 'Kayseri Mağaza', type: 'store' }, { name: 'Kayseri Toptan', type: 'wholesale' }] },
  Antalya: { customers: 61, stores: [{ name: 'Antalya Bayi', type: 'dealer' }] },
  Gaziantep: { customers: 58, stores: [{ name: 'Gaziantep Toptan', type: 'wholesale' }] },
  Konya: { customers: 44, stores: [] },
  Trabzon: { customers: 29, stores: [{ name: 'Trabzon Bayi', type: 'dealer' }] },
  Adana: { customers: 37, stores: [] },
  Samsun: { customers: 21, stores: [] },
  Diyarbakır: { customers: 18, stores: [{ name: 'Diyarbakır Bayi', type: 'dealer' }] },
}

export default function HaritaPage() {
  const supabase = createCrmBrowserClient()
  const [real, setReal] = useState<Record<string, Info>>({})
  const [loading, setLoading] = useState(true)
  const [demo, setDemo] = useState<boolean | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    (async () => {
      const [st, cu] = await Promise.all([
        supabase.from('stores').select('id, name, city, store_type').eq('is_active', true),
        supabase.from('customers').select('city').eq('status', 'active').not('city', 'is', null).limit(50000),
      ])
      const m: Record<string, Info> = {}
      const key = (c: string | null) => { const k = TR_PROVINCES.find(p => norm(p.name) === norm(c || '')); return k?.name || null }
      for (const s of (st.data || []) as StoreRow[]) { const k = key(s.city); if (k) (m[k] ||= { stores: [], customers: 0 }).stores.push({ name: s.name, type: s.store_type }) }
      for (const c of (cu.data || []) as { city: string }[]) { const k = key(c.city); if (k) (m[k] ||= { stores: [], customers: 0 }).customers++ }
      setReal(m); setLoading(false)
    })()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const hasReal = Object.keys(real).length > 0
  const useDemo = demo ?? !hasReal
  const data = useDemo ? DEMO : real
  const max = useMemo(() => Math.max(1, ...Object.values(data).map(d => d.customers)), [data])
  const active = pinned || hover
  const info = active ? data[active] : null
  const withCust = Object.entries(data).filter(([, d]) => d.customers > 0).length
  const totalStores = Object.values(data).reduce((a, d) => a + d.stores.length, 0)

  const fill = (name: string) => {
    const d = data[name]
    if (!d || d.customers === 0) return 'var(--map-empty, #d9dbe6)'
    const t = 0.35 + 0.65 * Math.min(1, d.customers / max)
    return `rgba(22,163,74,${t.toFixed(2)})`
  }

  return (
    <>
      <CrmTopBar title="Türkiye Haritası" subtitle={`${withCust} ilde müşteri · ${totalStores} mağaza`} />
      <div style={{ padding: 22, maxWidth: 1200, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', fontSize: 13, color: 'var(--tx2)' }}>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" checked={useDemo} onChange={e => setDemo(e.target.checked)} /> Örnek verilerle göster
          </label>
          {useDemo && <span style={{ color: 'var(--tx3)' }}>Gösterilen veriler örnektir, gerçek kayıt değildir.</span>}
          {!useDemo && !hasReal && !loading && <span style={{ color: 'var(--tx3)' }}>Henüz şehir bilgisi olan müşteri veya mağaza yok.</span>}
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
            <span><i style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: 'rgba(22,163,74,.9)', verticalAlign: -2, marginRight: 5 }} />Müşterisi olan il</span>
            <span><i style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: '#d9dbe6', verticalAlign: -2, marginRight: 5 }} />Müşteri yok</span>
          </span>
        </div>

        <div className="card" style={{ padding: 12, position: 'relative' }}
          onMouseMove={e => { const r = e.currentTarget.getBoundingClientRect(); setPos({ x: e.clientX - r.left, y: e.clientY - r.top }) }}
          onMouseLeave={() => { setHover(null); setPos(null) }}>
          <svg viewBox={TR_VIEWBOX} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Türkiye il haritası">
            {TR_PROVINCES.map(p => {
              const d = data[p.name]
              const isActive = active === p.name
              return (
                <path key={p.plate} d={p.path} fill={fill(p.name)}
                  stroke={isActive ? 'var(--ac, #6d5ce7)' : d?.stores.length ? 'var(--ac, #6d5ce7)' : 'var(--bg, #fff)'}
                  strokeWidth={isActive ? 2.4 : d?.stores.length ? 1.4 : 0.8}
                  style={{ cursor: 'pointer', transition: 'fill .15s' }}
                  onMouseEnter={() => setHover(p.name)}
                  onClick={() => setPinned(v => (v === p.name ? null : p.name))}>
                  <title>{p.name}</title>
                </path>
              )
            })}
          </svg>
          {hover && pos && (
            <div className="hidden-touch" style={{ position: 'absolute', left: Math.min(pos.x + 14, 9999), top: pos.y + 14, pointerEvents: 'none', background: 'var(--card, #fff)', border: '1px solid var(--bdr)', borderRadius: 10, padding: '10px 12px', boxShadow: '0 8px 24px rgba(0,0,0,.14)', fontSize: 12.5, minWidth: 190, maxWidth: 260, zIndex: 5 }}>
              <Tip name={hover} info={data[hover]} />
            </div>
          )}
        </div>

        <div className="card" style={{ padding: 16 }}>
          {active ? (
            <>
              <Tip name={active} info={info} big />
              {pinned && <button className="btn-ghost" style={{ marginTop: 10 }} onClick={() => setPinned(null)}>Seçimi kaldır</button>}
            </>
          ) : (
            <div style={{ color: 'var(--tx3)', fontSize: 13 }}>Bir ile gelin veya dokunun: o ildeki mağazaları ve müşteri sayısını gösterir.</div>
          )}
        </div>
      </div>
    </>
  )
}

function Tip({ name, info, big }: { name: string; info?: Info | null; big?: boolean }) {
  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: big ? 16 : 13.5, color: 'var(--tx)', marginBottom: 6 }}>{name}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--tx2)' }}><Users size={13} /> {info?.customers ?? 0} müşteri</div>
      {info && info.stores.length > 0 ? (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {info.stores.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', color: 'var(--tx)' }}>
              <Store size={13} style={{ color: 'var(--ac)', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{s.name}</span>
              <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{TYPE_LABEL[s.type] || s.type}</span>
            </div>
          ))}
        </div>
      ) : <div style={{ marginTop: 6, fontSize: 12, color: 'var(--tx3)' }}>Bu ilde mağaza yok</div>}
    </div>
  )
}
