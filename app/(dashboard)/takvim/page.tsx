'use client'

import { useEffect, useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Truck, CheckSquare, Phone, Package, Repeat, RefreshCw } from 'lucide-react'
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, nextFriday, addWeeks, startOfDay, differenceInWeeks } from 'date-fns'
import { tr } from 'date-fns/locale'

type Etkinlik = {
  id: string
  tarih: Date
  baslik: string
  tur: 'teslimat' | 'gorev' | 'arama' | 'siparis' | 'abonelik'
  detay?: string
  renk: string
  oncelik?: string
}

const TUR_RENK: Record<string, string> = {
  teslimat: '#7c9059',
  gorev: '#c4633f',
  arama: '#d9c07a',
  siparis: '#a8b885',
  abonelik: '#d97757',
}

const TUR_ICON: Record<string, any> = {
  teslimat: Truck,
  gorev: CheckSquare,
  arama: Phone,
  siparis: Package,
  abonelik: Repeat,
}

const TUR_LABEL: Record<string, string> = {
  teslimat: 'Teslimat',
  gorev: 'Görev',
  arama: 'Arama',
  siparis: 'Sipariş',
  abonelik: 'Abonelik',
}

export default function TakvimPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [etkinlikler, setEtkinlikler] = useState<Etkinlik[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [view, setView] = useState<'ay' | 'hafta'>('ay')
  const [filter, setFilter] = useState<string[]>(['teslimat', 'gorev', 'arama', 'siparis', 'abonelik'])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
     const [gorevRes, aramaRes] = await Promise.all([
        fetch('/api/gorev').then(r => r.json()),
        fetch('/api/arama-log').then(r => r.json()),
      ])
      const aboneRes: any = { subs: [] }
      const sipRes: any = { orders: [] }

      const events: Etkinlik[] = []

      // Görevler
      ;(gorevRes.gorevler || []).forEach((g: any) => {
        const rawTarih = g.bitis_tarihi || g.created_at
        if (!rawTarih) return
        const tarih = new Date(rawTarih)
        if (isNaN(tarih.getTime())) return
        events.push({
          id: `gorev-${g.id}`,
          tarih,
          baslik: g.baslik,
          tur: 'gorev',
          detay: g.aciklama,
          renk: g.oncelik === 'acil' ? '#c4633f' : g.oncelik === 'yuksek' ? '#d97757' : '#d9c07a',
          oncelik: g.oncelik,
        })
      })

      // Aramalar
      ;(aramaRes.aramalar || []).forEach((a: any) => {
        const aramaTarih = new Date(a.created_at)
        if (isNaN(aramaTarih.getTime())) return
        events.push({
          id: `arama-${a.id}`,
          tarih: aramaTarih,
          baslik: `📞 ${a.musteri_adi || a.telefon}`,
          tur: 'arama',
          detay: a.notlar,
          renk: TUR_RENK.arama,
        })
      })

      // Abonelik teslimatları - önümüzdeki 8 Cuma
      const aktifAboneler = (aboneRes.subs || []).filter((a: any) => a.durum === 'abone')
      const bugun = startOfDay(new Date())
      const bugunCuma = bugun.getDay() === 5
      const ilkCuma = bugunCuma ? bugun : nextFriday(bugun)

      Array.from({ length: 8 }, (_, i) => addWeeks(ilkCuma, i)).forEach(cuma => {
        aktifAboneler.forEach((a: any) => {
          const kayit = startOfDay(new Date(a.created_at))
          const haftalar = differenceInWeeks(cuma, kayit)
          if (haftalar >= 0 && haftalar < 4) {
            events.push({
              id: `teslimat-${a.id}-${cuma.toISOString()}`,
              tarih: cuma,
              baslik: `🚚 ${(a.ad || '') + ' ' + (a.soyad || '')}`.trim() + ` (${a.haftalik_adet || 1} adet)`,
              tur: 'teslimat',
              detay: `${(a.haftalik_adet || 1) * 2}L süt · ${a.iletisim || ''}`,
              renk: TUR_RENK.teslimat,
            })
          }
        })
      })

      // Shopify siparişleri
      ;(sipRes.orders || []).filter((o: any) => !o.fulfillment_status || o.fulfillment_status === 'unfulfilled').forEach((o: any) => {
        const sipTarih = new Date(o.created_at)
        if (isNaN(sipTarih.getTime())) return
        events.push({
          id: `siparis-${o.id}`,
          tarih: sipTarih,
          baslik: `📦 ${o.name} · ${o.customer_name || ''}`,
          tur: 'siparis',
          detay: `${parseFloat(o.total_price).toLocaleString('tr')} TL`,
          renk: TUR_RENK.siparis,
        })
      })

      setEtkinlikler(events)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const filteredEvents = etkinlikler.filter(e => filter.includes(e.tur) && e.tarih instanceof Date && !isNaN(e.tarih.getTime()))

  // Ay görünümü için günler
  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })

  const days: Date[] = []
  let day = calStart
  while (day <= calEnd) {
    days.push(day)
    day = addDays(day, 1)
  }

  const getEventsForDay = (d: Date) => filteredEvents.filter(e => isSameDay(e.tarih, d))
  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : []

  // Hafta görünümü
  const weekStart = startOfWeek(selectedDay || new Date(), { weekStartsOn: 1 })
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i))
  const hours = Array.from({ length: 14 }, (_, i) => i + 8) // 08:00 - 21:00

  const today = new Date()

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <header className="mb-6 flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300 mb-2">planlama & takip</p>
          <h1 className="font-display text-3xl md:text-5xl text-ink-900 tracking-tight">Takvim</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="w-9 h-9 flex items-center justify-center bg-white border border-cream-200 rounded-xl text-ink-400 hover:text-ink-700">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Kontroller */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        {/* Ay navigasyonu */}
        <div className="flex items-center gap-3">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            className="w-9 h-9 flex items-center justify-center bg-white border border-cream-200 rounded-xl text-ink-400 hover:text-ink-700 hover:border-ink-300 transition-all">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="font-display text-xl md:text-2xl text-ink-900 min-w-[160px] text-center">
            {format(currentMonth, 'MMMM yyyy', { locale: tr })}
          </h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            className="w-9 h-9 flex items-center justify-center bg-white border border-cream-200 rounded-xl text-ink-400 hover:text-ink-700 hover:border-ink-300 transition-all">
            <ChevronRight className="w-4 h-4" />
          </button>
          <button onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()) }}
            className="px-3 py-2 text-xs font-medium bg-ink-900 text-cream-50 rounded-xl hover:bg-ink-700 transition-colors">
            Bugün
          </button>
        </div>

        {/* Filtreler */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {Object.entries(TUR_LABEL).map(([tur, label]) => {
            const Icon = TUR_ICON[tur]
            const aktif = filter.includes(tur)
            return (
              <button key={tur} onClick={() => setFilter(f => aktif ? f.filter(x => x !== tur) : [...f, tur])}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${aktif ? 'text-white border-transparent' : 'bg-white border-cream-200 text-ink-400'}`}
                style={aktif ? { background: TUR_RENK[tur] } : {}}>
                <Icon className="w-3 h-3" strokeWidth={2} />
                {label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex gap-4">
        {/* Ana Takvim */}
        <div className="flex-1 min-w-0">
          {/* Gün başlıkları */}
          <div className="grid grid-cols-7 mb-2">
            {['Pzt','Sal','Çar','Per','Cum','Cmt','Paz'].map(g => (
              <div key={g} className="text-center text-[10px] uppercase tracking-[0.2em] text-ink-300 py-2 font-medium">{g}</div>
            ))}
          </div>

          {/* Günler */}
          <div className="grid grid-cols-7 gap-px bg-cream-200 rounded-2xl overflow-hidden border border-cream-200">
            {days.map((d, i) => {
              const dayEvents = getEventsForDay(d)
              const isCurrentMonth = isSameMonth(d, currentMonth)
              const isSelected = selectedDay && isSameDay(d, selectedDay)
              const isTodayDate = isToday(d)
              const isCuma = d.getDay() === 5

              return (
                <div key={i} onClick={() => setSelectedDay(d)}
                  className={`min-h-[80px] md:min-h-[100px] p-2 cursor-pointer transition-colors group relative
                    ${!isCurrentMonth ? 'bg-cream-50' : 'bg-white'}
                    ${isSelected ? 'bg-ink-900' : ''}
                    ${isCuma && isCurrentMonth && !isSelected ? 'bg-moss-50' : ''}
                    hover:bg-cream-100
                  `}>
                  {/* Gün numarası */}
                  <div className={`flex items-center justify-between mb-1`}>
                    <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full transition-colors
                      ${isTodayDate ? 'bg-ink-900 text-cream-50' : ''}
                      ${isSelected && !isTodayDate ? 'text-cream-50' : ''}
                      ${!isCurrentMonth ? 'text-ink-300' : isSelected ? 'text-cream-300' : 'text-ink-700'}
                    `}>
                      {format(d, 'd')}
                    </span>
                    {isCuma && isCurrentMonth && (
                      <span className={`text-[8px] font-mono uppercase tracking-wider ${isSelected ? 'text-moss-300' : 'text-moss-500'}`}>cuma</span>
                    )}
                  </div>

                  {/* Etkinlikler */}
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 3).map(e => (
                      <div key={e.id} className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-medium text-white truncate"
                        style={{ background: e.renk }}>
                        <span className="truncate">{e.baslik}</span>
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <div className={`text-[10px] font-mono px-1 ${isSelected ? 'text-cream-300' : 'text-ink-400'}`}>
                        +{dayEvents.length - 3} daha
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Yan panel - seçili gün detayı */}
        <div className={`w-72 shrink-0 hidden lg:block`}>
          {selectedDay ? (
            <div className="bg-white border border-cream-200 rounded-2xl overflow-hidden sticky top-24">
              {/* Başlık */}
              <div className="px-5 py-4 border-b border-cream-100 bg-cream-50 flex items-center justify-between">
                <div>
                  <div className="font-display text-2xl text-ink-900">{format(selectedDay, 'd', { locale: tr })}</div>
                  <div className="text-xs text-ink-400 font-mono">{format(selectedDay, 'MMMM yyyy, EEEE', { locale: tr })}</div>
                </div>
                <button onClick={() => setSelectedDay(null)} className="text-ink-300 hover:text-ink-700">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Etkinlikler */}
              <div className="p-4">
                {selectedDayEvents.length === 0 ? (
                  <div className="py-8 text-center">
                    <div className="text-3xl mb-2">📅</div>
                    <p className="text-sm text-ink-400">Bu gün için etkinlik yok</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {selectedDayEvents.map(e => {
                      const Icon = TUR_ICON[e.tur]
                      return (
                        <div key={e.id} className="p-3 rounded-xl border border-cream-100 hover:border-cream-300 transition-colors">
                          <div className="flex items-start gap-2">
                            <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${e.renk}20` }}>
                              <Icon className="w-3.5 h-3.5" style={{ color: e.renk }} strokeWidth={2} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium text-ink-400 mb-0.5">{TUR_LABEL[e.tur]}</div>
                              <div className="text-sm font-medium text-ink-900 leading-snug">{e.baslik}</div>
                              {e.detay && <div className="text-xs text-ink-400 mt-0.5 truncate">{e.detay}</div>}
                              {e.oncelik && e.oncelik !== 'normal' && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium mt-1 inline-block"
                                  style={{ background: `${e.renk}20`, color: e.renk }}>
                                  {e.oncelik}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Bu gün özeti */}
              {selectedDayEvents.length > 0 && (
                <div className="px-4 pb-4">
                  <div className="bg-cream-50 border border-cream-200 rounded-xl p-3">
                    <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-2">Özet</div>
                    {Object.entries(TUR_LABEL).map(([tur, label]) => {
                      const count = selectedDayEvents.filter(e => e.tur === tur).length
                      if (count === 0) return null
                      const Icon = TUR_ICON[tur]
                      return (
                        <div key={tur} className="flex items-center justify-between py-1">
                          <span className="flex items-center gap-1.5 text-xs text-ink-500">
                            <Icon className="w-3 h-3" style={{ color: TUR_RENK[tur] }} strokeWidth={2} />
                            {label}
                          </span>
                          <span className="text-xs font-mono font-medium text-ink-700">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white border border-cream-200 rounded-2xl p-6 sticky top-24">
              <div className="text-center py-4">
                <div className="text-4xl mb-3">📅</div>
                <p className="text-sm text-ink-500 font-medium">Bir gün seçin</p>
                <p className="text-xs text-ink-300 mt-1">Detayları görmek için takvimde bir güne tıklayın</p>
              </div>

              {/* Bu ay özeti */}
              <div className="mt-4 pt-4 border-t border-cream-100">
                <div className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-3">Bu Ay Özeti</div>
                {Object.entries(TUR_LABEL).map(([tur, label]) => {
                  const count = filteredEvents.filter(e => isSameMonth(e.tarih, currentMonth) && e.tur === tur).length
                  if (count === 0) return null
                  const Icon = TUR_ICON[tur]
                  return (
                    <div key={tur} className="flex items-center justify-between py-1.5">
                      <span className="flex items-center gap-2 text-xs text-ink-500">
                        <div className="w-5 h-5 rounded flex items-center justify-center" style={{ background: `${TUR_RENK[tur]}20` }}>
                          <Icon className="w-3 h-3" style={{ color: TUR_RENK[tur] }} strokeWidth={2} />
                        </div>
                        {label}
                      </span>
                      <span className="text-xs font-mono font-bold text-ink-700">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobil: seçili gün etkinlikleri */}
      {selectedDay && selectedDayEvents.length > 0 && (
        <div className="lg:hidden mt-4 bg-white border border-cream-200 rounded-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-cream-100 bg-cream-50 flex items-center justify-between">
            <div className="text-sm font-medium text-ink-900">{format(selectedDay, 'd MMMM EEEE', { locale: tr })}</div>
            <button onClick={() => setSelectedDay(null)} className="text-ink-300"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-3 space-y-2">
            {selectedDayEvents.map(e => {
              const Icon = TUR_ICON[e.tur]
              return (
                <div key={e.id} className="flex items-center gap-3 p-2.5 rounded-xl" style={{ background: `${e.renk}10` }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${e.renk}25` }}>
                    <Icon className="w-4 h-4" style={{ color: e.renk }} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate">{e.baslik}</div>
                    {e.detay && <div className="text-xs text-ink-400 truncate">{e.detay}</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Yaklaşan etkinlikler - alt bar */}
      <div className="mt-6 bg-white border border-cream-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-cream-100 bg-cream-50">
          <h2 className="font-display text-lg text-ink-900">Yaklaşan Etkinlikler</h2>
        </div>
        <div className="divide-y divide-cream-100">
          {filteredEvents
            .filter(e => e.tarih >= today)
            .sort((a, b) => a.tarih.getTime() - b.tarih.getTime())
            .slice(0, 8)
            .map(e => {
              const Icon = TUR_ICON[e.tur]
              const gunFarki = Math.ceil((e.tarih.getTime() - today.getTime()) / 86400000)
              return (
                <div key={e.id} className="px-5 py-3 flex items-center gap-4 hover:bg-cream-50 transition-colors cursor-pointer"
                  onClick={() => { setSelectedDay(e.tarih); setCurrentMonth(e.tarih) }}>
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ background: `${e.renk}20` }}>
                    <Icon className="w-4 h-4" style={{ color: e.renk }} strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-ink-900 truncate">{e.baslik}</div>
                    <div className="text-xs text-ink-400 font-mono">{format(e.tarih, 'd MMMM yyyy, EEEE', { locale: tr })}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-xs font-mono font-medium px-2 py-0.5 rounded-full ${
                      gunFarki === 0 ? 'bg-ember-100 text-ember-700' :
                      gunFarki <= 2 ? 'bg-cream-200 text-ink-600' :
                      'bg-cream-100 text-ink-400'
                    }`}>
                      {gunFarki === 0 ? 'Bugün' : gunFarki === 1 ? 'Yarın' : `${gunFarki} gün`}
                    </div>
                  </div>
                </div>
              )
            })}
        </div>
      </div>
    </div>
  )
}
