'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Search, X, Star, ShoppingBag, MessageSquare, Repeat, TrendingUp, Users, Crown } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { tr } from 'date-fns/locale'

type Customer = {
  phone: string
  name?: string
  orders: any[]
  session?: any
  totalSpent: number
  orderCount: number
  segment: 'vip' | 'aktif' | 'yeni' | 'kayip'
  abonelik?: any   // ← EKLENDİ
}

export default function MusterilerPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'vip' | 'aktif' | 'yeni' | 'kayip'>('all')
  const [selected, setSelected] = useState<Customer | null>(null)
  const [profilEtiketler, setProfilEtiketler] = useState<any[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [sessionRes] = await Promise.all([
      supabase.from('wa_sessions_roberto').select('*').order('updated_at', { ascending: false }),
    ])

    const sessions = (sessionRes.data || []) as any[]
    const aboneler: any[] = []
    const orders: any[] = []
    // Telefon bazlı müşteri map'i
    const customerMap: Record<string, Customer> = {}

    // WhatsApp session'lardan
    sessions.forEach((s: any) => {
      const phone = s.phone
      if (!customerMap[phone]) {
        customerMap[phone] = { phone, orders: [], totalSpent: 0, orderCount: 0, segment: 'yeni', session: s }
      } else {
        customerMap[phone].session = s
      }
    })

    // Aboneleri ekle
    aboneler.forEach((a: any) => {
      const phone = a.iletisim
      if (!customerMap[phone]) {
        customerMap[phone] = { phone, name: `${a.ad} ${a.soyad}`, orders: [], totalSpent: 0, orderCount: 0, segment: 'yeni' }
      }
      customerMap[phone].abonelik = a
      customerMap[phone].name = customerMap[phone].name || `${a.ad} ${a.soyad}`
    })

    // Shopify siparişleri ekle (telefon eşleştirme)
    orders.forEach((o: any) => {
      const rawPhone = (o.phone || '').replace(/\D/g, '')
      // Format normalizasyon: 905xx, 5xx, 05xx hepsini eşleştir
      const phoneVariants = [
        rawPhone,
        rawPhone.startsWith('90') ? rawPhone.slice(2) : rawPhone,
        rawPhone.startsWith('0') ? '90' + rawPhone.slice(1) : '90' + rawPhone,
      ]
      const matchedPhone = phoneVariants.find(p => customerMap[p])
      const phone = matchedPhone || rawPhone
      if (phone && customerMap[phone]) {
        customerMap[phone].orders.push(o)
        customerMap[phone].totalSpent += parseFloat(o.total_price || 0)
        customerMap[phone].orderCount++
        if (!customerMap[phone].name) customerMap[phone].name = o.customer_name
      }
    })

    // Segmentasyon
    const now = new Date()
    const thirtyDays = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDays = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    Object.values(customerMap).forEach(c => {
      const lastActive = c.session ? new Date(c.session.updated_at) : null
      if (c.orderCount >= 3 || c.abonelik?.durum === 'abone') {
        c.segment = 'vip'
      } else if (lastActive && lastActive > thirtyDays) {
        c.segment = 'aktif'
      } else if (lastActive && lastActive < ninetyDays) {
        c.segment = 'kayip'
      } else {
        c.segment = 'yeni'
      }
    })

    setCustomers(Object.values(customerMap).sort((a, b) => {
      if (a.segment === 'vip' && b.segment !== 'vip') return -1

  const filtered = customers.filter(c => {
    const matchSearch = !search || c.phone.includes(search) || (c.name || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.segment === filter
    return matchSearch && matchFilter
  })

  const segmentStats = {
    vip: customers.filter(c => c.segment === 'vip').length,
    aktif: customers.filter(c => c.segment === 'aktif').length,
    yeni: customers.filter(c => c.segment === 'yeni').length,
    kayip: customers.filter(c => c.segment === 'kayip').length,
  }

  const SEG_COLOR: Record<string, {bg:string,color:string,border:string}> = {
    vip: { bg: 'rgba(201,168,76,0.12)', color: '#E8D5A3', border: 'rgba(201,168,76,0.25)' },
    aktif: { bg: 'rgba(58,55,48,0.4)', color: '#9A928A', border: 'rgba(58,55,48,0.3)' },
    yeni: { bg: 'rgba(31,29,23,0.6)', color: '#7A7468', border: 'rgba(58,55,48,0.2)' },
    kayip: { bg: 'rgba(139,38,53,0.1)', color: '#C4364A', border: 'rgba(139,38,53,0.2)' },
  }
  const SEG_LABEL: Record<string, string> = { vip: '✦ VIP', aktif: '✓ Aktif', yeni: '· Yeni', kayip: '⚠ Kayıp' }

  const card = { background: '#1A1712', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12 }
  const th = { padding: '12px 18px', textAlign: 'left' as const, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#5A5550', fontWeight: 500, background: 'rgba(201,168,76,0.02)' }
  const td = { padding: '14px 18px', fontSize: 12, borderTop: '1px solid rgba(201,168,76,0.05)' }

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1280, margin: '0 auto' }}>
      <header style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#5A5550', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>{customers.length} müşteri</p>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 44, fontWeight: 300, color: '#EDE8DF', letterSpacing: '-0.03em', lineHeight: 1 }}>Müşteriler</h1>
        <div style={{ height: 1, background: 'linear-gradient(90deg,rgba(201,168,76,0.3),transparent)', marginTop: 16 }} />
      </header>

      {/* Segment kartlar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {([['vip','VIP','3+ sipariş veya abone'],['aktif','Aktif','Son 30 günde'],['yeni','Yeni','30-90 gün'],['kayip','Kayıp','90+ gün önce']] as const).map(([key,label,sub]) => (
          <div key={key} onClick={() => setFilter(filter === key ? 'all' : key)}
            style={{ ...card, padding: '18px 20px', cursor: 'pointer', borderColor: filter === key ? 'rgba(201,168,76,0.3)' : 'rgba(201,168,76,0.1)', background: filter === key ? 'rgba(201,168,76,0.06)' : '#1A1712' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: SEG_COLOR[key].color, marginBottom: 10 }}>{label}</p>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 40, fontWeight: 300, color: '#EDE8DF', lineHeight: 1 }}>{segmentStats[key]}</div>
            <p style={{ fontSize: 10, color: '#5A5550', fontFamily: 'JetBrains Mono, monospace', marginTop: 8 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Arama */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#5A5550' }} />
          <input type="text" placeholder="Telefon veya isim ara..." value={search} onChange={e => setSearch(e.target.value)} className="input-premium" style={{ paddingLeft: 40, paddingRight: 14, paddingTop: 11, paddingBottom: 11, fontSize: 13 }} />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#5A5550', cursor: 'pointer' }}><X size={14} /></button>}
        </div>
        {filter !== 'all' && <button onClick={() => setFilter('all')} style={{ padding: '0 16px', background: '#1A1712', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8, fontSize: 12, color: '#7A7468', cursor: 'pointer' }}>Filtreyi Kaldır</button>}
      </div>

      {/* Tablo */}
      <div style={{ ...card, overflow: 'hidden' }}>
        {loading ? <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>{[1,2,3,4,5].map(i => <div key={i} style={{ height: 52, background: '#211E18', borderRadius: 8 }} />)}</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr>{['Müşteri','Telefon','Segment','Son Mesaj','KVKK','Son Aktif',''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.phone} onClick={() => setSelected(c)} style={{ cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.03)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <td style={td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: SEG_COLOR[c.segment].bg, color: SEG_COLOR[c.segment].color, border: `1px solid ${SEG_COLOR[c.segment].border}` }}>
                        {c.segment === 'vip' ? '✦' : (c.name || c.phone).slice(0,1).toUpperCase()}
                      </div>
                      <span style={{ color: '#B8B0A0', fontSize: 12 }}>{c.name || '—'}</span>
                    </div>
                  </td>
                  <td style={{ ...td, fontFamily: 'JetBrains Mono, monospace', color: '#7A7468' }}>{c.phone}</td>
                  <td style={td}><span style={{ fontSize: 10, padding: '3px 8px', borderRadius: 4, background: SEG_COLOR[c.segment].bg, color: SEG_COLOR[c.segment].color, border: `1px solid ${SEG_COLOR[c.segment].border}` }}>{SEG_LABEL[c.segment]}</span></td>
                  <td style={{ ...td, color: '#5A5550', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.session?.musteri_yazdigi || '—'}</td>
                  <td style={td}><span style={{ fontSize: 11, color: c.session?.kvkk_onay ? '#C9A84C' : '#5A5550' }}>{c.session?.kvkk_onay ? '✓' : '✗'}</span></td>
                  <td style={{ ...td, fontFamily: 'JetBrains Mono, monospace', color: '#5A5550', whiteSpace: 'nowrap' }}>{c.session ? formatDistanceToNow(new Date(c.session.updated_at), { addSuffix: true, locale: tr }) : '—'}</td>
                  <td style={{ ...td, color: '#5A5550' }}>›</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && <div style={{ padding: 40, textAlign: 'center', fontSize: 11, color: '#5A5550', fontFamily: 'JetBrains Mono, monospace' }}>müşteri bulunamadı</div>}
      </div>

      {/* Profil Drawer */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelected(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 420, background: '#120F0C', height: '100%', overflowY: 'auto', borderLeft: '1px solid rgba(201,168,76,0.15)' }} onClick={e => e.stopPropagation()}>
            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(13,11,9,0.95)', backdropFilter: 'blur(12px)', padding: '20px 24px', borderBottom: '1px solid rgba(201,168,76,0.08)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, fontWeight: 700, background: SEG_COLOR[selected.segment].bg, color: SEG_COLOR[selected.segment].color, border: `1px solid ${SEG_COLOR[selected.segment].border}` }}>
                  {selected.segment === 'vip' ? '✦' : (selected.name || selected.phone).slice(0,1).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#EDE8DF' }}>{selected.name || '—'}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: '#7A7468', marginTop: 2 }}>{selected.phone}</div>
                  <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: SEG_COLOR[selected.segment].bg, color: SEG_COLOR[selected.segment].color, border: `1px solid ${SEG_COLOR[selected.segment].border}`, display: 'inline-block', marginTop: 6 }}>{SEG_LABEL[selected.segment]}</span>
                  {profilEtiketler.map(e => <span key={e.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, color: '#fff', background: e.renk, marginLeft: 4, display: 'inline-block', marginTop: 6 }}>{e.etiket}</span>)}
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#211E18', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8, color: '#7A7468', cursor: 'pointer', flexShrink: 0 }}><X size={14} /></button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Özet */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
                {[{label:'Sipariş',value:selected.orderCount||'—'},{label:'Harcama',value:selected.totalSpent>0?`${selected.totalSpent.toLocaleString('tr')} ₺`:'—'},{label:'Haftalık',value:selected.abonelik?.haftalik_adet||'—'}].map(({label,value}) => (
                  <div key={label} style={{ background: '#211E18', border: '1px solid rgba(201,168,76,0.08)', borderRadius: 10, padding: '14px 12px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: '#EDE8DF', lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5A5550', marginTop: 6 }}>{label}</div>
                  </div>
                ))}
              </div>

              {/* WhatsApp */}
              {selected.session && (
                <div style={{ background: '#211E18', border: '1px solid rgba(201,168,76,0.08)', borderRadius: 10, padding: '14px 16px' }}>
                  <p style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5A5550', marginBottom: 12 }}>WhatsApp</p>
                  {[
                    {label:'Son mesaj',value:`"${selected.session.musteri_yazdigi||'—'}"`},
                    {label:'Son niyet',value:selected.session.last_intent||'—'},
                    {label:'KVKK',value:selected.session.kvkk_onay?'✓ Onaylı':'✗ Yok'},
                    {label:'Son aktif',value:formatDistanceToNow(new Date(selected.session.updated_at),{addSuffix:true,locale:tr})},
                  ].map(({label,value}) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid rgba(201,168,76,0.04)' }}>
                      <span style={{ fontSize: 11, color: '#5A5550' }}>{label}</span>
                      <span style={{ fontSize: 11, color: '#9A928A', maxWidth: 180, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Aksiyonlar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.session?.slack_thread_ts && <a href="/canli-destek" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 0', background: 'rgba(139,38,53,0.15)', border: '1px solid rgba(139,38,53,0.3)', borderRadius: 8, color: '#C4364A', fontSize: 13, textDecoration: 'none' }}>Canlı Destek'te Aç →</a>}
                <a href={`https://wa.me/${selected.phone}`} target="_blank" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '11px 0', background: '#211E18', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8, color: '#7A7468', fontSize: 13, textDecoration: 'none' }}>WhatsApp'ta Aç →</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
