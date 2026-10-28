'use client'
import { useEffect, useMemo, useState } from 'react'
import { Store, Users } from 'lucide-react'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { TR_PROVINCES, TR_VIEWBOX } from '@/lib/crm/tr-map-data'

type StoreRow = { id: string; name: string; city: string | null; store_type: string; phone: string | null; address: string | null }
type St = { name: string; type: string; phone?: string | null; address?: string | null }
type Cu = { name: string; phone: string | null; store: string }
type Info = { stores: St[]; customers: number; list: Cu[] }

const TYPE_LABEL: Record<string, string> = { store: 'Perakende mağaza', hq: 'Merkez', online: 'E-ticaret', dealer: 'Bayi', wholesale: 'Toptan' }
const norm = (s: string) => s.toLocaleLowerCase('tr').replace(/[çğıöşü]/g, c => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c] as string)).replace(/[^a-z]/g, '')

// Örnek veri (gerçek kayıt değildir, yalnızca haritayı göstermek içindir)
const P = (c: string, n: number) => `0${c} ${String(200 + n * 7).slice(0, 3)} ${String(10 + n * 13).slice(0, 2)} ${String(20 + n * 11).slice(0, 2)}`
type DS = { name: string; type: string; code: string; addr: string }
const DEMO_BASE: Record<string, { customers: number; area: string; stores: DS[] }> = {
  İstanbul: { customers: 412, area: '212', stores: [{ name: 'İstanbul Toptan Merkez', type: 'wholesale', code: '1', addr: 'Mahmutbey Mah. Toptancılar Sk. No:12 Bağcılar' }, { name: 'Kadıköy Bayi', type: 'dealer', code: '2', addr: 'Caferağa Mah. Moda Cd. No:48 Kadıköy' }, { name: 'Nişantaşı Mağaza', type: 'store', code: '3', addr: 'Teşvikiye Mah. Abdi İpekçi Cd. No:21 Şişli' }] },
  Ankara: { customers: 186, area: '312', stores: [{ name: 'Ankara Bayi', type: 'dealer', code: '4', addr: 'Kızılay Mah. Atatürk Blv. No:80 Çankaya' }, { name: 'Ankara Kızılay Mağaza', type: 'store', code: '5', addr: 'Kızılay Mah. Ziya Gökalp Cd. No:9' }] },
  İzmir: { customers: 154, area: '232', stores: [{ name: 'İzmir Toptan', type: 'wholesale', code: '6', addr: 'Kemeraltı Çarşısı Anafartalar Cd. No:33 Konak' }, { name: 'Alsancak Mağaza', type: 'store', code: '7', addr: 'Alsancak Mah. Kıbrıs Şehitleri Cd. No:17' }] },
  Bursa: { customers: 97, area: '224', stores: [{ name: 'Bursa Bayi', type: 'dealer', code: '8', addr: 'Osmangazi Mah. Atatürk Cd. No:55' }] },
  Kayseri: { customers: 73, area: '352', stores: [{ name: 'Kayseri Toptan', type: 'wholesale', code: '9', addr: 'Kapalı Çarşı Mah. Park Cd. No:6 Melikgazi' }, { name: 'Kayseri Mağaza', type: 'store', code: '10', addr: 'Cumhuriyet Mah. Talas Cd. No:14' }] },
  Antalya: { customers: 61, area: '242', stores: [{ name: 'Antalya Bayi', type: 'dealer', code: '11', addr: 'Muratpaşa Mah. Işıklar Cd. No:42' }] },
  Gaziantep: { customers: 58, area: '342', stores: [{ name: 'Gaziantep Toptan', type: 'wholesale', code: '12', addr: 'Bakırcılar Çarşısı No:23 Şahinbey' }] },
  Konya: { customers: 44, area: '332', stores: [{ name: 'Konya Bayi', type: 'dealer', code: '13', addr: 'Selçuklu Mah. Mevlana Cd. No:31' }] },
  Trabzon: { customers: 29, area: '462', stores: [{ name: 'Trabzon Bayi', type: 'dealer', code: '14', addr: 'Meydan Mah. Uzun Sk. No:8 Ortahisar' }] },
  Adana: { customers: 37, area: '322', stores: [{ name: 'Adana Toptan', type: 'wholesale', code: '15', addr: 'Kuruköprü Mah. Ziyapaşa Blv. No:60 Seyhan' }] },
  Samsun: { customers: 21, area: '362', stores: [{ name: 'Samsun Bayi', type: 'dealer', code: '16', addr: 'İlkadım Mah. Cumhuriyet Cd. No:27' }] },
  Diyarbakır: { customers: 18, area: '412', stores: [{ name: 'Diyarbakır Bayi', type: 'dealer', code: '17', addr: 'Sur Mah. Gazi Cd. No:19' }] },
}
const FIRST = ['Ahmet', 'Mehmet', 'Ayşe', 'Fatma', 'Mustafa', 'Zeynep', 'Emre', 'Elif', 'Hasan', 'Merve', 'Burak', 'Selin']
const LAST = ['Yılmaz', 'Kaya', 'Demir', 'Çelik', 'Şahin', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan', 'Doğan', 'Kılıç', 'Aslan']
function demoFor(types: string[]): Record<string, Info> {
  const out: Record<string, Info> = {}
  let n = 0
  for (const [city, v] of Object.entries(DEMO_BASE)) {
    const stores = v.stores.filter(x => types.includes(x.type))
    if (!stores.length) continue
    const list: Cu[] = Array.from({ length: Math.min(8, v.customers) }, (_, i) => {
      n++
      return { name: `${FIRST[(n * 5) % 12]} ${LAST[(n * 7 + i) % 12]}`, phone: `05${30 + (n % 6)} ${String(200 + n * 17).slice(0, 3)} ${String(10 + n * 3).slice(0, 2)} ${String(40 + n * 7).slice(0, 2)}`, store: stores[i % stores.length].name }
    })
    out[city] = { customers: v.customers, list, stores: stores.map((x, i) => ({ name: x.name, type: x.type, address: x.addr, phone: P(v.area, Number(x.code) + i) })) }
  }
  return out
}

export default function TurkeyMap({ storeTypes, title }: { storeTypes: string[]; title?: string }) {
  const supabase = createCrmBrowserClient()
  const [real, setReal] = useState<Record<string, Info>>({})
  const [loading, setLoading] = useState(true)
  const [demo, setDemo] = useState<boolean | null>(null)
  const [hover, setHover] = useState<string | null>(null)
  const [pinned, setPinned] = useState<string | null>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  useEffect(() => {
    (async () => {
      const st = await supabase.from('stores').select('id, name, city, store_type, phone, address').eq('is_active', true).in('store_type', storeTypes)
      const stores = (st.data || []) as StoreRow[]
      const ids = stores.map(x => x.id)
      const sname = new Map(stores.map(x => [x.id, x.name]))
      const cu = ids.length
        ? await supabase.from('customers').select('city, first_name, last_name, phone, store_id').eq('status', 'active').in('store_id', ids).not('city', 'is', null).order('registered_at', { ascending: false }).limit(50000)
        : { data: [] as { city: string; first_name: string; last_name: string; phone: string | null; store_id: string }[] }
      const m: Record<string, Info> = {}
      const key = (c: string | null) => TR_PROVINCES.find(p => norm(p.name) === norm(c || ''))?.name || null
      for (const s of stores) { const k = key(s.city); if (k) (m[k] ||= { stores: [], customers: 0, list: [] }).stores.push({ name: s.name, type: s.store_type, phone: s.phone, address: s.address }) }
      for (const c of (cu.data || [])) {
        const k = key(c.city); if (!k) continue
        const e = (m[k] ||= { stores: [], customers: 0, list: [] }); e.customers++
        if (e.list.length < 50) e.list.push({ name: `${c.first_name} ${c.last_name}`.trim(), phone: c.phone, store: sname.get(c.store_id) || '' })
      }
      setReal(m); setLoading(false)
    })()
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const hasReal = Object.keys(real).length > 0
  const useDemo = demo ?? !hasReal
  const data = useDemo ? demoFor(storeTypes) : real
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
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 14 }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--tx)' }}>{title || 'Türkiye Haritası'} <span style={{ fontWeight: 400, fontSize: 12.5, color: 'var(--tx3)' }}>· {withCust} ilde müşteri · {totalStores} mağaza</span></div>
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
            {TR_PROVINCES.map(p => (
              <text key={`l${p.plate}`} x={p.lx} y={p.ly} textAnchor="middle" dominantBaseline="middle" fontSize={8.6} fontWeight={600}
                style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: 'rgba(255,255,255,.75)', strokeWidth: 2.2, strokeLinejoin: 'round', fill: '#1f2340' }}>{p.name}</text>
            ))}
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
              {info && info.list.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--tx)', marginBottom: 6 }}>Müşteriler {info.customers > info.list.length && <span style={{ fontWeight: 400, color: 'var(--tx3)' }}>(ilk {info.list.length} / {info.customers})</span>}</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                      <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 12 }}><th style={{ padding: '6px 10px 6px 0' }}>Müşteri</th><th style={{ padding: '6px 10px' }}>Telefon</th><th style={{ padding: '6px 10px' }}>Mağaza</th></tr></thead>
                      <tbody>{info.list.map((c, i) => (
                        <tr key={i} style={{ borderTop: '1px solid var(--bdr)' }}>
                          <td style={{ padding: '7px 10px 7px 0', fontWeight: 500 }}>{c.name}</td>
                          <td style={{ padding: '7px 10px', whiteSpace: 'nowrap' }}>{c.phone || '—'}</td>
                          <td style={{ padding: '7px 10px', color: 'var(--tx2)' }}>{c.store || '—'}</td>
                        </tr>))}</tbody>
                    </table>
                  </div>
                </div>
              )}
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
              <span style={{ flex: 1 }}>{s.name}{big && (s.phone || s.address) && <span style={{ display: 'block', fontSize: 12, color: 'var(--tx3)' }}>{[s.phone, s.address].filter(Boolean).join(' · ')}</span>}</span>
              <span style={{ fontSize: 11, color: 'var(--tx3)' }}>{TYPE_LABEL[s.type] || s.type}</span>
            </div>
          ))}
        </div>
      ) : <div style={{ marginTop: 6, fontSize: 12, color: 'var(--tx3)' }}>Bu ilde mağaza yok</div>}
    </div>
  )
}
