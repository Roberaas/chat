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
  abonelik?: any
  session?: any
  totalSpent: number
  orderCount: number
  segment: 'vip' | 'aktif' | 'yeni' | 'kayip'
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
    const [sessionRes, aboneRes, orderRes] = await Promise.all([
      supabase.from('wa_sessions_roberto').select('*').order('updated_at', { ascending: false }),
      fetch('/api/aboneliker').then(r => r.json()),
      fetch('/api/shopify/orders').then(r => r.json()),
    ])

    const sessions = (sessionRes.data || []) as any[]
    const aboneler = aboneRes.subs || []
    const orders = orderRes.orders || []

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
    vip: 'bg-ink-900 text-cream-50',
    aktif: 'bg-moss-100 text-moss-700',
    yeni: 'bg-cream-200 text-ink-600',
    kayip: 'bg-ember-100 text-ember-600',
  }
  const SEGMENT_LABEL: Record<string, string> = { vip: '👑 VIP', aktif: '✓ Aktif', yeni: '🆕 Yeni', kayip: '⚠ Kayıp' }

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto">
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300 mb-2">{customers.length} müşteri</p>
        <h1 className="font-display text-3xl md:text-5xl text-ink-900 tracking-tight">Müşteriler</h1>
      </header>

      {/* Segment kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { key: 'vip', label: 'VIP', value: segmentStats.vip, icon: Crown, color: 'bg-ink-900 border-ink-700 text-cream-50', sub: '3+ sipariş veya abone' },
          { key: 'aktif', label: 'Aktif', value: segmentStats.aktif, icon: TrendingUp, color: 'bg-moss-50 border-moss-200 text-moss-700', sub: 'Son 30 günde aktif' },
          { key: 'yeni', label: 'Yeni', value: segmentStats.yeni, icon: Users, color: 'bg-white border-cream-200 text-ink-900', sub: '30-90 gün' },
          { key: 'kayip', label: 'Kayıp', value: segmentStats.kayip, icon: Users, color: 'bg-ember-50 border-ember-200 text-ember-700', sub: '90+ gün önce aktif' },
        ].map(({ key, label, value, icon: Icon, color, sub }) => (
          <div key={key} onClick={() => setFilter(filter === key as any ? 'all' : key as any)}
            className={`border rounded-2xl p-4 md:p-6 cursor-pointer transition-all hover:opacity-80 ${color} ${filter === key ? 'ring-2 ring-offset-2 ring-ink-900' : ''}`}>
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
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
          <input type="text" placeholder="Telefon veya isim ara..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-cream-200 rounded-xl text-sm text-ink-700 placeholder-ink-300 focus:outline-none focus:border-moss-400" />
          {search && <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-300"><X className="w-3.5 h-3.5" /></button>}
        </div>
        {filter !== 'all' && (
          <button onClick={() => setFilter('all')} className="px-4 py-2 bg-white border border-cream-200 rounded-xl text-sm text-ink-500 hover:text-ink-700">
            Filtreyi Kaldır
          </button>
        )}
      </div>

      {/* Müşteri listesi */}
      <div className="bg-white border border-cream-200 rounded-2xl overflow-hidden">
        {loading ? <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="animate-pulse h-16 bg-cream-100 rounded-xl" />)}</div> : (
          <table className="w-full">
            <thead className="bg-cream-50">
              <tr>{['Müşteri','Telefon','Segment','Siparişler','Harcama','Abonelik','Son Aktif',''].map(h => (
                <th key={h} className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.2em] text-ink-300">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map(c => (
                <tr key={c.phone} onClick={() => setSelected(c)} className="border-t border-cream-100 hover:bg-cream-50 cursor-pointer transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${SEGMENT_COLOR[c.segment]}`}>
                        {c.segment === 'vip' ? '👑' : (c.name || c.phone).slice(0,1).toUpperCase()}
                      </div>
                      <div>
                        <div className="text-sm font-medium text-ink-900">{c.name || '—'}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4 font-mono text-sm text-ink-500">{c.phone}</td>
                  <td className="px-5 py-4">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SEGMENT_COLOR[c.segment]}`}>
                      {SEGMENT_LABEL[c.segment]}
                    </span>
                  </td>
                  <td className="px-5 py-4 font-mono text-sm text-ink-700">{c.orderCount || '—'}</td>
                  <td className="px-5 py-4 font-mono text-sm text-ink-700">{c.totalSpent > 0 ? `${c.totalSpent.toLocaleString('tr')} TL` : '—'}</td>
                  <td className="px-5 py-4">
                    {c.abonelik ? (
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${c.abonelik.durum === 'abone' ? 'bg-moss-100 text-moss-700' : 'bg-cream-200 text-ink-600'}`}>
                        {c.abonelik.durum === 'abone' ? `✓ ${c.abonelik.haftalik_adet} adet` : 'Bekliyor'}
                      </span>
                    ) : <span className="text-ink-300 text-xs">—</span>}
                  </td>
                  <td className="px-5 py-4 text-xs text-ink-300 font-mono">
                    {c.session ? formatDistanceToNow(new Date(c.session.updated_at), { addSuffix: true, locale: tr }) : '—'}
                  </td>
                  <td className="px-5 py-4 text-ink-300">›</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && <div className="p-12 text-center text-ink-300 font-mono text-sm">müşteri bulunamadı</div>}
      </div>

      {/* Müşteri 360° Profil */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-cream-50 h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>

            <div className="sticky top-0 bg-white border-b border-cream-200 z-10 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold ${SEGMENT_COLOR[selected.segment]}`}>
                    {selected.segment === 'vip' ? '👑' : (selected.name || selected.phone).slice(0,1).toUpperCase()}
                  </div>
                  <div>
                    <div className="font-medium text-ink-900">{selected.name || '—'}</div>
                    <div className="font-mono text-sm text-ink-400">{selected.phone}</div>
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
                <button onClick={() => setSelected(null)} className="text-ink-300 hover:text-ink-700"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-5 space-y-4">

              {/* Özet */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-white border border-cream-200 rounded-xl p-3 text-center">
                  <div className="font-display text-2xl text-ink-900">{selected.orderCount}</div>
                  <div className="text-[10px] text-ink-300 uppercase tracking-wide mt-1">Sipariş</div>
                </div>
                <div className="bg-white border border-cream-200 rounded-xl p-3 text-center">
                  <div className="font-display text-xl text-moss-600">{selected.totalSpent > 0 ? `${selected.totalSpent.toLocaleString('tr')}` : '—'}</div>
                  <div className="text-[10px] text-ink-300 uppercase tracking-wide mt-1">TL Harcama</div>
                </div>
                <div className="bg-white border border-cream-200 rounded-xl p-3 text-center">
                  <div className="font-display text-2xl text-ink-900">{selected.abonelik ? selected.abonelik.haftalik_adet : '—'}</div>
                  <div className="text-[10px] text-ink-300 uppercase tracking-wide mt-1">Haftalık</div>
                </div>
              </div>

              {/* WhatsApp Konuşma */}
              {selected.session && (
                <div className="bg-white border border-cream-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <MessageSquare className="w-3.5 h-3.5 text-ink-300" strokeWidth={1.5} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-ink-300">WhatsApp</span>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-ink-400">Son mesaj</span>
                      <span className="text-ink-700 italic max-w-[180px] truncate">"{selected.session.musteri_yazdigi || '—'}"</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-400">Son niyet</span>
                      <span className="text-ink-700">{selected.session.last_intent || '—'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-400">KVKK</span>
                      <span className={selected.session.kvkk_onay ? 'text-moss-600' : 'text-ember-500'}>{selected.session.kvkk_onay ? '✓ Onaylı' : '✗ Yok'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-ink-400">Son aktif</span>
                      <span className="text-ink-400 font-mono text-xs">{formatDistanceToNow(new Date(selected.session.updated_at), { addSuffix: true, locale: tr })}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Abonelik */}
              {selected.abonelik && (
                <div className="bg-moss-50 border border-moss-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Repeat className="w-3.5 h-3.5 text-moss-600" strokeWidth={1.5} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-moss-600">Abonelik</span>
                  </div>
                  <div className="space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-moss-600">Durum</span>
                      <span className="font-medium text-moss-800">{selected.abonelik.durum === 'abone' ? '✓ Aktif' : 'Bekliyor'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-moss-600">Haftalık adet</span>
                      <span className="font-medium text-moss-800">{selected.abonelik.haftalik_adet}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-moss-600">Aylık gelir</span>
                      <span className="font-medium text-moss-800">{(selected.abonelik.haftalik_adet * (selected.abonelik.fiyat_tekil || 130) * 4).toLocaleString('tr')} TL</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sipariş geçmişi */}
              {selected.orders.length > 0 && (
                <div className="bg-white border border-cream-200 rounded-xl overflow-hidden">
                  <div className="px-4 py-3 border-b border-cream-100 flex items-center gap-2">
                    <ShoppingBag className="w-3.5 h-3.5 text-ink-300" strokeWidth={1.5} />
                    <span className="text-[10px] uppercase tracking-[0.2em] text-ink-300">Sipariş Geçmişi</span>
                  </div>
                  <div className="divide-y divide-cream-100">
                    {selected.orders.map(o => (
                      <div key={o.id} className="px-4 py-3 flex items-center justify-between">
                        <div>
                          <div className="font-mono text-sm font-medium text-ink-900">{o.name}</div>
                          <div className="text-xs text-ink-400 font-mono">{format(new Date(o.created_at), 'd MMM yyyy', { locale: tr })}</div>
                        </div>
                        <div className="text-right">
                          <div className="font-mono text-sm text-ink-700">{parseFloat(o.total_price).toLocaleString('tr')} TL</div>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${o.financial_status === 'paid' ? 'bg-moss-100 text-moss-700' : 'bg-cream-200 text-ink-600'}`}>
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
                  <a href="/canli-destek" className="w-full flex items-center justify-center gap-2 py-3 bg-ember-600 text-white rounded-xl text-sm font-medium hover:bg-ember-700 transition-colors">
                    💬 Canlı Destek'te Aç
                  </a>
                )}
                <a href={`https://wa.me/${selected.phone}`} target="_blank"
                  className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-cream-200 text-ink-700 rounded-xl text-sm font-medium hover:bg-cream-50 transition-colors">
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
