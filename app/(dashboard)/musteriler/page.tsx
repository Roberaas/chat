'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import StatCard from '@/components/StatCard'
import { Search, X, ShoppingBag, MessageSquare, Repeat, TrendingUp, Users, Crown, UserX, ChevronRight } from 'lucide-react'
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
  abonelik?: any
}

type Seg = 'vip' | 'aktif' | 'yeni' | 'kayip'

const SEG_BADGE: Record<Seg, string> = { vip: 'badge-ac', aktif: 'badge-green', yeni: 'badge-blue', kayip: 'badge-red' }
const SEG_LABEL: Record<Seg, string> = { vip: 'VIP', aktif: 'Aktif', yeni: 'Yeni', kayip: 'Kayıp' }

export default function MusterilerPage() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | Seg>('all')
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
    const customerMap: Record<string, Customer> = {}

    sessions.forEach((s: any) => {
      const phone = s.phone
      if (!customerMap[phone]) {
        customerMap[phone] = { phone, name: s.musteri_adi || undefined, orders: [], totalSpent: 0, orderCount: 0, segment: 'yeni', session: s }
      } else {
        customerMap[phone].session = s
      }
    })

    aboneler.forEach((a: any) => {
      const phone = a.iletisim
      if (!customerMap[phone]) {
        customerMap[phone] = { phone, name: `${a.ad} ${a.soyad}`, orders: [], totalSpent: 0, orderCount: 0, segment: 'yeni' }
      }
      customerMap[phone].abonelik = a
      customerMap[phone].name = customerMap[phone].name || `${a.ad} ${a.soyad}`
    })

    orders.forEach((o: any) => {
      const rawPhone = (o.phone || '').replace(/\D/g, '')
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

    const now = new Date()
    const thirtyDays = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const ninetyDays = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)

    Object.values(customerMap).forEach(c => {
      const lastActive = c.session ? new Date(c.session.updated_at) : null
      if (c.orderCount >= 3 || c.abonelik?.durum === 'abone') c.segment = 'vip'
      else if (lastActive && lastActive > thirtyDays) c.segment = 'aktif'
      else if (lastActive && lastActive < ninetyDays) c.segment = 'kayip'
      else c.segment = 'yeni'
    })

    setCustomers(Object.values(customerMap).sort((a, b) => {
      if (a.segment === 'vip' && b.segment !== 'vip') return -1
      if (b.segment === 'vip' && a.segment !== 'vip') return 1
      return b.totalSpent - a.totalSpent
    }))
    setLoading(false)
  }

  useEffect(() => {
    if (selected) {
      fetch(`/api/etiket?telefon=${selected.phone}`).then(r => r.json()).then(d => setProfilEtiketler(d.etiketler || []))
    } else {
      setProfilEtiketler([])
    }
  }, [selected])

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

  const cards: { key: Seg; label: string; Icon: any; accent: string; sub: string }[] = [
    { key: 'vip', label: 'VIP', Icon: Crown, accent: 'var(--ac)', sub: '3+ sipariş veya abone' },
    { key: 'aktif', label: 'Aktif', Icon: TrendingUp, accent: 'var(--green)', sub: 'Son 30 günde aktif' },
    { key: 'yeni', label: 'Yeni', Icon: Users, accent: 'var(--blue)', sub: '30–90 gün' },
    { key: 'kayip', label: 'Kayıp', Icon: UserX, accent: 'var(--red)', sub: '90+ gün önce aktif' },
  ]

  return (
    <>
      <TopBar title="Müşteriler" subtitle={`${customers.length} müşteri`} />
      <div style={{ padding: 22, maxWidth: 1360, width: '100%', margin: '0 auto' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 16 }}>
          {cards.map(c => (
            <div key={c.key} style={{ outline: filter === c.key ? `2px solid ${c.accent}` : 'none', outlineOffset: 2, borderRadius: 14 }}>
              <StatCard label={c.label} value={segmentStats[c.key]} sub={c.sub} Icon={c.Icon} accent={c.accent}
                onClick={() => setFilter(filter === c.key ? 'all' : c.key)} />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)' }} />
            <input className="inp" placeholder="Telefon veya isim ara..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38, paddingRight: 36 }} />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)', background: 'none', border: 'none' }}><X size={14} /></button>}
          </div>
          {filter !== 'all' && <button className="btn-ghost" onClick={() => setFilter('all')}>Filtreyi kaldır</button>}
        </div>

        <div className="card">
          {loading ? (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="anim-pulse" style={{ height: 52, background: 'var(--s2)', borderRadius: 8 }} />)}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Müşteri', 'Telefon', 'Segment', 'Siparişler', 'Harcama', 'Abonelik', 'Son Aktif', ''].map(h => (
                      <th key={h} className="kpi-label" style={{ padding: '12px 18px', textAlign: 'left', marginBottom: 0, borderBottom: '1px solid var(--bdr)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.phone} className="row" style={{ display: 'table-row', cursor: 'pointer' }} onClick={() => setSelected(c)}>
                      <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--bdr)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="sb-av" style={{ width: 30, height: 30 }}>{(c.name || c.phone).slice(0, 1).toUpperCase()}</div>
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx)' }}>{c.name || '—'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 18px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: 'var(--tx2)', borderBottom: '1px solid var(--bdr)' }}>{c.phone}</td>
                      <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--bdr)' }}><span className={`badge ${SEG_BADGE[c.segment]}`}>{SEG_LABEL[c.segment]}</span></td>
                      <td style={{ padding: '12px 18px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, borderBottom: '1px solid var(--bdr)' }}>{c.orderCount || '—'}</td>
                      <td style={{ padding: '12px 18px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, borderBottom: '1px solid var(--bdr)' }}>{c.totalSpent > 0 ? `${c.totalSpent.toLocaleString('tr')} TL` : '—'}</td>
                      <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--bdr)' }}>
                        {c.abonelik
                          ? <span className={`badge ${c.abonelik.durum === 'abone' ? 'badge-green' : 'badge-muted'}`}>{c.abonelik.durum === 'abone' ? `✓ ${c.abonelik.haftalik_adet} adet` : 'Bekliyor'}</span>
                          : <span style={{ color: 'var(--tx3)', fontSize: 12 }}>—</span>}
                      </td>
                      <td style={{ padding: '12px 18px', fontSize: 11.5, color: 'var(--tx3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--bdr)' }}>
                        {c.session ? formatDistanceToNow(new Date(c.session.updated_at), { addSuffix: true, locale: tr }) : '—'}
                      </td>
                      <td style={{ padding: '12px 18px', color: 'var(--tx3)', borderBottom: '1px solid var(--bdr)' }}><ChevronRight size={14} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!loading && filtered.length === 0 && <div style={{ padding: 48, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>müşteri bulunamadı</div>}
        </div>
      </div>

      {/* Müşteri 360° profil */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9990, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelected(null)}>
          <div className="anim-fade" style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }} />
          <div className="anim-slide-r" style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100vh', overflowY: 'auto', background: 'var(--s1)', borderLeft: '1px solid var(--bdr2)' }} onClick={e => e.stopPropagation()}>

            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--topbar-bg)', backdropFilter: 'blur(12px)', padding: '16px 20px', borderBottom: '1px solid var(--bdr)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="sb-av" style={{ width: 44, height: 44, borderRadius: 12, fontSize: 16 }}>{(selected.name || selected.phone).slice(0, 1).toUpperCase()}</div>
                <div>
                  <div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--tx)' }}>{selected.name || '—'}</div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: 'var(--tx3)', marginTop: 1 }}>{selected.phone}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className={`badge ${SEG_BADGE[selected.segment]}`}>{SEG_LABEL[selected.segment]}</span>
                    {profilEtiketler.map(e => <span key={e.id} className="badge" style={{ background: e.renk, color: '#fff' }}>{e.etiket}</span>)}
                  </div>
                </div>
              </div>
              <button className="btn-ghost" onClick={() => setSelected(null)} style={{ padding: 7 }}><X size={14} /></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[
                  { v: selected.orderCount, l: 'Sipariş' },
                  { v: selected.totalSpent > 0 ? selected.totalSpent.toLocaleString('tr') : '—', l: 'TL Harcama' },
                  { v: selected.abonelik ? selected.abonelik.haftalik_adet : '—', l: 'Haftalık' },
                ].map(x => (
                  <div key={x.l} className="card" style={{ background: 'var(--s2)', padding: '12px 8px', textAlign: 'center' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 18, fontWeight: 700, color: 'var(--tx)' }}>{x.v}</div>
                    <div className="kpi-label" style={{ marginTop: 5, marginBottom: 0 }}>{x.l}</div>
                  </div>
                ))}
              </div>

              {selected.session && (
                <div className="card" style={{ background: 'var(--s2)' }}>
                  <div className="card-h" style={{ padding: '11px 16px' }}>
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}><MessageSquare size={13} style={{ color: 'var(--tx3)' }} /> WhatsApp</span>
                  </div>
                  {[
                    { l: 'Son mesaj', v: selected.session.musteri_yazdigi ? `“${selected.session.musteri_yazdigi}”` : '—' },
                    { l: 'Son niyet', v: selected.session.last_intent || '—' },
                    { l: 'KVKK', v: selected.session.kvkk_onay ? '✓ Onaylı' : '✗ Yok' },
                    { l: 'Son aktif', v: formatDistanceToNow(new Date(selected.session.updated_at), { addSuffix: true, locale: tr }) },
                  ].map(x => (
                    <div key={x.l} className="row" style={{ justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--tx3)' }}>{x.l}</span>
                      <span style={{ fontSize: 12.5, color: 'var(--tx)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{x.v}</span>
                    </div>
                  ))}
                </div>
              )}

              {selected.abonelik && (
                <div className="card" style={{ background: 'var(--green2)', borderColor: 'rgba(34,211,160,.25)' }}>
                  <div className="card-h" style={{ padding: '11px 16px' }}>
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, color: 'var(--green)' }}><Repeat size={13} /> Abonelik</span>
                  </div>
                  {[
                    { l: 'Durum', v: selected.abonelik.durum === 'abone' ? '✓ Aktif' : 'Bekliyor' },
                    { l: 'Haftalık adet', v: selected.abonelik.haftalik_adet },
                    { l: 'Aylık gelir', v: `${(selected.abonelik.haftalik_adet * (selected.abonelik.fiyat_tekil || 130) * 4).toLocaleString('tr')} TL` },
                  ].map(x => (
                    <div key={x.l} className="row" style={{ justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{x.l}</span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)' }}>{x.v}</span>
                    </div>
                  ))}
                </div>
              )}

              {selected.orders.length > 0 && (
                <div className="card" style={{ background: 'var(--s2)' }}>
                  <div className="card-h" style={{ padding: '11px 16px' }}>
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}><ShoppingBag size={13} style={{ color: 'var(--tx3)' }} /> Sipariş Geçmişi</span>
                  </div>
                  {selected.orders.map(o => (
                    <div key={o.id} className="row" style={{ justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, fontWeight: 600 }}>{o.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{format(new Date(o.created_at), 'd MMM yyyy', { locale: tr })}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5 }}>{parseFloat(o.total_price).toLocaleString('tr')} TL</div>
                        <span className={`badge ${o.financial_status === 'paid' ? 'badge-green' : 'badge-muted'}`}>{o.financial_status === 'paid' ? 'Ödendi' : o.financial_status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.session?.slack_thread_ts && (
                  <a href="/canli-destek" className="btn-danger" style={{ justifyContent: 'center', padding: '10px 0' }}>Canlı Destek'te Aç</a>
                )}
                <a href={`https://wa.me/${selected.phone}`} target="_blank" rel="noreferrer" className="btn-ghost" style={{ justifyContent: 'center', padding: '10px 0' }}>WhatsApp'ta Aç</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
