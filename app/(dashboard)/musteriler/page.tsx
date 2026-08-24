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
    const matchSearch = !search ||
      c.phone.includes(search) ||
      (c.name || '').toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || c.segment === filter
    return matchSearch && matchFilter
  })

  const segmentStats = {
    vip: customers.filter(c => c.segment === 'vip').length,
    aktif: customers.filter(c => c.segment === 'aktif').length,
    yeni: customers.filter(c => c.segment === 'yeni').length,
    kayip: customers.filter(c => c.segment === 'kayip').length,
  }

  const SEGMENT_COLOR: Record<string, string> = {
    vip: 'bg-[var(--bg-card)] text-cream-50',
    aktif: 'bg-[rgba(201,168,76,0.1)] text-[#C9A84C]',
    yeni: 'bg-[var(--bg-card2)] text-[#7A7468]',
    kayip: 'bg-[rgba(139,38,53,0.1)] text-[#D04858]',
  }
  const SEGMENT_LABEL: Record<string, string> = { vip: '👑 VIP', aktif: '✓ Aktif', yeni: '🆕 Yeni', kayip: '⚠ Kayıp' }

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1280, margin: "0 auto" }}>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-[#5A5550] mb-2">{customers.length} müşteri</p>
        <h1 className="font-display text-3xl md:text-5xl text-[#EDE8DF] tracking-tight">Müşteriler</h1>
      </header>

      {/* Segment kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { key: 'vip', label: 'VIP', value: segmentStats.vip, icon: Crown, color: 'bg-[var(--bg-card)] border-ink-700 text-cream-50', sub: '3+ sipariş veya abone' },
          { key: 'aktif', label: 'Aktif', value: segmentStats.aktif, icon: TrendingUp, color: 'bg-[rgba(201,168,76,0.06)] border-[rgba(201,168,76,0.15)] text-[#C9A84C]', sub: 'Son 30 günde aktif' },
          { key: 'yeni', label: 'Yeni', value: segmentStats.yeni, icon: Users, color: 'bg-white border-[rgba(201,168,76,0.15)] text-[#EDE8DF]', sub: '30-90 gün' },
          { key: 'kayip', label: 'Kayıp', value: segmentStats.kayip, icon: Users, color: 'bg-[rgba(139,38,53,0.1)] border-[rgba(139,38,53,0.25)] text-ember-700', sub: '90+ gün önce aktif' },
        ].map(({ key, label, value, icon: Icon, color, sub }) => (
          <div key={key} onClick={() => setFilter(filter === key as any ? 'all' : key as any)}
            className={`border rounded-2xl p-4 md:p-6 cursor-pointer transition-all hover:opacity-75 ${color} ${filter === key ? 'ring-2 ring-offset-2 ring-ink-900' : ''}`}>
            <div className="flex items-start justify-between mb-3">
              <span className="text-[10px] uppercase tracking-[0.2em] opacity-60">{label}</span>
              <Icon className="w-4 h-4 opacity-40" strokeWidth={1.5} />
            </div>
            <div className="font-display text-3xl md:text-4xl mb-1">{value}</div>
            <div className="text-[10px] opacity-50 font-mono">{sub}</div>
          </div>
        ))}
      </div>

      {/* Arama */}
      <div className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#5A5550]" />
          <input type="text" placeholder="Telefon veya isim ara..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 card-premium rounded-xl text-sm text-[#B8B0A0] placeholder-ink-300 focus:outline-none focus:border-moss-400" />
          {search && <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-[#5A5550]"><X className="w-3.5 h-3.5" /></button>}
        </div>
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} className="px-4 py-2 card-premium rounded-xl text-sm text-[#9A928A] hover:text-[#B8B0A0]">
            Filtreyi Kaldır
          </button>
        )}
      </div>

      {/* Müşteri listesi */}
      <div className="card-premium overflow-hidden">
        {loading ? <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="animate-pulse h-16  rounded-xl" />)}</div> : (
          <table className="w-full">
            <thead className="">
              <tr>{['Müşteri','Telefon','Segment','Siparişler','Harcama','Abonelik','Son Aktif',''].map(h => (
                <th key={h} className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.2em] text-[#5A5550]">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.phone} onClick={() => setSelected(c)} className="border-t border-[rgba(201,168,76,0.08)] hover: cursor-pointer transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${SEGMENT_COLOR[c.segment]}`}>
                        {c.segment === 'vip' ? '👑' : (c.name || c.phone).slice(0,1).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-[#EDE8DF]">{c.name || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-sm text-[#9A928A]">{c.phone}</td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SEGMENT_COLOR[c.segment]}`}>
                      {SEGMENT_LABEL[c.segment]}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-sm text-[#B8B0A0]">{c.orderCount || '—'}</td>
                  <td className="px-5 py-4 font-mono text-sm text-[#B8B0A0]">{c.totalSpent > 0 ? `${c.totalSpent.toLocaleString('tr')} TL` : '—'}</td>
                  <td className="px-5 py-4">
                    {c.abonelik ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.abonelik.durum === 'abone' ? 'bg-[rgba(201,168,76,0.1)] text-[#C9A84C]' : 'bg-[var(--bg-card2)] text-[#7A7468]'}`}>
                        {c.abonelik.durum === 'abone' ? `✓ ${c.abonelik.haftalik_adet} adet` : 'Bekliyor'}
                      </span>
                    ) : <span className="text-[#5A5550] text-xs">—</span>}
                  </td>
                  <td className="px-5 py-4 text-xs text-[#5A5550] font-mono">
                    {c.session ? formatDistanceToNow(new Date(c.session.updated_at), { addSuffix: true, locale: tr }) : '—'}
                  </td>
                  <td className="px-5 py-4 text-[#5A5550]">›</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && <div className="p-12 text-center text-[#5A5550] font-mono text-sm">müşteri bulunamadı</div>}
      </div>

      {/* Müşteri 360° Profil */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-[var(--bg-card)]/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md  h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>

            <div className="sticky top-0 bg-white border-b border-[rgba(201,168,76,0.15)] z-10 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold ${SEGMENT_COLOR[selected.segment]}`}>
                    {selected.segment === 'vip' ? '👑' : (selected.name || selected.phone).slice(0,1).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-[#EDE8DF]">{selected.name || '—'}</div>
                    <div className="font-mono text-sm text-[#7A7468]">{selected.phone}</div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium mt-1 inline-block ${SEGMENT_COLOR[selected.segment]}`}>
                      {SEGMENT_LABEL[selected.segment]}
                    </span>
                    {profilEtiketler.map(e => (
                      <span key={e.id} className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white mt-1 inline-block" style={{ background: e.renk }}>
                        {e.etiket}
                      </span>
                    ))}
                  </div>
                </div>
                <button onClick={() => setSelected(null)} className="text-[#5A5550] hover:text-[#B8B0A0]"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-5 space-y-4">

              {/* Özet */}
              <div className="grid grid-cols-3 gap-3">
                <div className="card-premium rounded-xl p-3 text-center">
                  <div className="font-display text-2xl text-[#EDE8DF]">{selected.orderCount}</div>
                  <div className="text-[10px] text-[#5A5550] uppercase tracking-wide mt-1">Sipariş</div>
                </div>
                <div className="card-premium rounded-xl p-3 text-center">
                  <div className="font-display text-xl text-[#C9A84C]">{selected.totalSpent > 0 ? `${selected.totalSpent.toLocaleString('tr')}` : '—'}</div>
                  <div className="text-[10px] text-[#5A5550] uppercase tracking-wide mt-1">TL Harcama</div>
                </div>
                <div className="card-premium rounded-xl p-3 text-center">
                  <div className="font-display text-2xl text-[#EDE8DF]">{selected.abonelik ? selected.abonelik.haftalik_adet : '—'}</div>
                  <div className="text-[10px] text-[#5A5550] uppercase tracking-wide mt-1">Haftalık</div>
                </div>
              </div>

              {/* WhatsApp Konuşma */}
              {selected.session && (
                <div className="card-premium rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-3.5 h-3.5 text-[#5A5550]" strokeWidth={1.5} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#5A5550]">WhatsApp</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#7A7468]">Son mesaj</span>
                      <span className="text-[#B8B0A0] italic max-w-[180px] truncate">"{selected.session.musteri_yazdigi || '—'}"</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7A7468]">Son niyet</span>
                      <span className="text-[#B8B0A0]">{selected.session.last_intent || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7A7468]">KVKK</span>
                      <span className={selected.session.kvkk_onay ? 'text-[#C9A84C]' : 'text-[#D04858]'}>{selected.session.kvkk_onay ? '✓ Onaylı' : '✗ Yok'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#7A7468]">Son aktif</span>
                      <span className="text-[#7A7468] font-mono text-xs">{formatDistanceToNow(new Date(selected.session.updated_at), { addSuffix: true, locale: tr })}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Abonelik */}
              {selected.abonelik && (
                <div className="bg-moss-50 border border-moss-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Repeat className="w-3.5 h-3.5 text-[#C9A84C]" strokeWidth={1.5} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#C9A84C]">Abonelik</span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[#C9A84C]">Durum</span>
                      <span className="font-medium text-moss-800">{selected.abonelik.durum === 'abone' ? '✓ Aktif' : 'Bekliyor'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#C9A84C]">Haftalık adet</span>
                      <span className="font-medium text-moss-800">{selected.abonelik.haftalik_adet}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#C9A84C]">Aylık gelir</span>
                      <span className="font-medium text-moss-800">{(selected.abonelik.haftalik_adet * (selected.abonelik.fiyat_tekil || 130) * 4).toLocaleString('tr')} TL</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sipariş geçmişi */}
              {selected.orders.length > 0 && (
                <div className="card-premium rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-[rgba(201,168,76,0.08)] flex items-center gap-2">
                    <ShoppingBag className="w-3.5 h-3.5 text-[#5A5550]" strokeWidth={1.5} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[#5A5550]">Sipariş Geçmişi</span>
                  </div>
                  <div className="divide-y divide-cream-100">
                    {selected.orders.map(o => (
                      <div key={o.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="font-mono text-sm font-medium text-[#EDE8DF]">{o.name}</div>
                          <div className="text-xs text-[#7A7468] font-mono">{format(new Date(o.created_at), 'd MMM yyyy', { locale: tr })}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm text-[#B8B0A0]">{parseFloat(o.total_price).toLocaleString('tr')} TL</div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${o.financial_status === 'paid' ? 'bg-[rgba(201,168,76,0.1)] text-[#C9A84C]' : 'bg-[var(--bg-card2)] text-[#7A7468]'}`}>
                            {o.financial_status === 'paid' ? 'Ödendi' : o.financial_status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Aksiyonlar */}
              <div className="space-y-2 pt-2">
                {selected.session?.slack_thread_ts && (
                  <a href="/canli-destek" className="w-full flex items-center justify-center gap-2 py-3 bg-[#A83040] text-white rounded-xl text-sm font-medium hover:bg-ember-700 transition-colors">
                    💬 Canlı Destek'te Aç
                  </a>
                )}
                <a href={`https://wa.me/${selected.phone}`} target="_blank"
                  className="w-full flex items-center justify-center gap-2 py-3 card-premium text-[#B8B0A0] rounded-xl text-sm font-medium hover: transition-colors">
                  📱 WhatsApp'ta Aç
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
