'use client'

import { useEffect, useState } from 'react'
import TopBar from '@/components/TopBar'
import { ChevronLeft, ChevronRight, Plus, X, Truck, CheckSquare, Phone, Package, Repeat, RefreshCw, CalendarDays } from 'lucide-react'
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
  teslimat: '#22d3a0',
  gorev: '#7c6af7',
  arama: '#f0a843',
  siparis: '#4ea8f0',
  abonelik: '#f25757',
}
const TUR_ICON: Record<string, any> = { teslimat: Truck, gorev: CheckSquare, arama: Phone, siparis: Package, abonelik: Repeat }
const TUR_LABEL: Record<string, string> = { teslimat: 'Teslimat', gorev: 'Görev', arama: 'Arama', siparis: 'Sipariş', abonelik: 'Abonelik' }

const EMPTY_FORM = { show: false, baslik: '', aciklama: '', tarih: '', sms_saati: '', sms_telefon: '', oncelik: 'normal' }

export default function TakvimPage() {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [etkinlikler, setEtkinlikler] = useState<Etkinlik[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)
  const [filter, setFilter] = useState<string[]>(['teslimat', 'gorev', 'arama', 'siparis', 'abonelik'])
  const [ekleForm, setEkleForm] = useState(EMPTY_FORM)
  const [kayitLoading, setKayitLoading] = useState(false)

  async function etkinlikEkle() {
    if (!ekleForm.baslik.trim() || !ekleForm.tarih) return
    setKayitLoading(true)
    await fetch('/api/gorev', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        baslik: ekleForm.baslik,
        aciklama: ekleForm.aciklama || null,
        bitis_tarihi: ekleForm.tarih || null,
        oncelik: ekleForm.oncelik,
        sms_saati: ekleForm.sms_saati || null,
        sms_telefon: ekleForm.sms_telefon || '',
        durum: 'bekliyor',
      })
    })
    setEkleForm(EMPTY_FORM)
    setKayitLoading(false)
    load()
  }

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

      ;(gorevRes.gorevler || []).forEach((g: any) => {
        const rawTarih = g.bitis_tarihi || g.created_at
        if (!rawTarih) return
        const tarih = new Date(rawTarih)
        if (isNaN(tarih.getTime())) return
        events.push({
          id: `gorev-${g.id}`, tarih, baslik: g.baslik, tur: 'gorev', detay: g.aciklama,
          renk: g.oncelik === 'acil' ? '#f25757' : g.oncelik === 'yuksek' ? '#f0a843' : '#7c6af7',
          oncelik: g.oncelik,
        })
      })

      ;(aramaRes.aramalar || []).forEach((a: any) => {
        const aramaTarih = new Date(a.created_at)
        if (isNaN(aramaTarih.getTime())) return
        events.push({ id: `arama-${a.id}`, tarih: aramaTarih, baslik: a.musteri_adi || a.telefon, tur: 'arama', detay: a.notlar, renk: TUR_RENK.arama })
      })

      const aktifAboneler = (aboneRes.subs || []).filter((a: any) => a.durum === 'abone')
      const bugun = startOfDay(new Date())
      const ilkCuma = bugun.getDay() === 5 ? bugun : nextFriday(bugun)
      Array.from({ length: 8 }, (_, i) => addWeeks(ilkCuma, i)).forEach(cuma => {
        aktifAboneler.forEach((a: any) => {
          const haftalar = differenceInWeeks(cuma, startOfDay(new Date(a.created_at)))
          if (haftalar >= 0 && haftalar < 4) {
            events.push({
              id: `teslimat-${a.id}-${cuma.toISOString()}`, tarih: cuma,
              baslik: `${(a.ad || '') + ' ' + (a.soyad || '')}`.trim() + ` (${a.haftalik_adet || 1} adet)`,
              tur: 'teslimat', detay: `${(a.haftalik_adet || 1) * 2}L · ${a.iletisim || ''}`, renk: TUR_RENK.teslimat,
            })
          }
        })
      })

      ;(sipRes.orders || []).filter((o: any) => !o.fulfillment_status || o.fulfillment_status === 'unfulfilled').forEach((o: any) => {
        const sipTarih = new Date(o.created_at)
        if (isNaN(sipTarih.getTime())) return
        events.push({ id: `siparis-${o.id}`, tarih: sipTarih, baslik: `${o.name} · ${o.customer_name || ''}`, tur: 'siparis', detay: `${parseFloat(o.total_price).toLocaleString('tr')} TL`, renk: TUR_RENK.siparis })
      })

      setEtkinlikler(events)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  const filteredEvents = etkinlikler.filter(e => filter.includes(e.tur) && e.tarih instanceof Date && !isNaN(e.tarih.getTime()))

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 })
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 })
  const days: Date[] = []
  for (let d = calStart; d <= calEnd; d = addDays(d, 1)) days.push(d)

  const getEventsForDay = (d: Date) => filteredEvents.filter(e => isSameDay(e.tarih, d))
  const selectedDayEvents = selectedDay ? getEventsForDay(selectedDay) : []
  const today = new Date()

  const DayPanel = () => (
    <div className="card">
      {selectedDay ? (
        <>
          <div className="card-h">
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', color: 'var(--tx)', lineHeight: 1 }}>{format(selectedDay, 'd')}</div>
              <div className="card-meta" style={{ marginTop: 4 }}>{format(selectedDay, 'MMMM yyyy, EEEE', { locale: tr })}</div>
            </div>
            <button onClick={() => setSelectedDay(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={16} /></button>
          </div>
          <div style={{ padding: 14 }}>
            {selectedDayEvents.length === 0 ? (
              <div style={{ padding: '28px 0', textAlign: 'center' }}>
                <CalendarDays size={28} style={{ color: 'var(--tx3)', opacity: .5, margin: '0 auto 8px', display: 'block' }} strokeWidth={1.4} />
                <p style={{ fontSize: 13, color: 'var(--tx3)' }}>Bu gün için etkinlik yok</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selectedDayEvents.map(e => {
                  const Icon = TUR_ICON[e.tur]
                  return (
                    <div key={e.id} style={{ padding: 11, borderRadius: 10, border: '1px solid var(--bdr)', display: 'flex', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: `${e.renk}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <Icon size={14} style={{ color: e.renk }} strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{TUR_LABEL[e.tur]}</div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx)', lineHeight: 1.35 }}>{e.baslik}</div>
                        {e.detay && <div style={{ fontSize: 12, color: 'var(--tx2)', marginTop: 2 }}>{e.detay}</div>}
                        {e.oncelik && e.oncelik !== 'normal' && <span className="badge" style={{ background: `${e.renk}22`, color: e.renk, marginTop: 5 }}>{e.oncelik}</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ padding: 20 }}>
          <div style={{ textAlign: 'center', padding: '8px 0 16px' }}>
            <CalendarDays size={30} style={{ color: 'var(--tx3)', opacity: .5, margin: '0 auto 8px', display: 'block' }} strokeWidth={1.4} />
            <p style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx2)' }}>Bir gün seçin</p>
            <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 3 }}>Detaylar burada görünür</p>
          </div>
          <div style={{ paddingTop: 14, borderTop: '1px solid var(--bdr)' }}>
            <p className="kpi-label">Bu Ay Özeti</p>
            {Object.entries(TUR_LABEL).map(([tur, label]) => {
              const count = filteredEvents.filter(e => isSameMonth(e.tarih, currentMonth) && e.tur === tur).length
              if (count === 0) return null
              const Icon = TUR_ICON[tur]
              return (
                <div key={tur} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 0' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--tx2)' }}>
                    <span style={{ width: 22, height: 22, borderRadius: 6, background: `${TUR_RENK[tur]}22`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={12} style={{ color: TUR_RENK[tur] }} strokeWidth={2} /></span>
                    {label}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace' }}>{count}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      <style>{`
        .cal-wrap{display:flex;gap:16px;align-items:flex-start}
        .cal-side{width:300px;flex-shrink:0;position:sticky;top:70px}
        .cal-cell{min-height:98px}
        @media(max-width:1024px){.cal-wrap{flex-direction:column}.cal-side{width:100%;position:static}.cal-cell{min-height:64px}}
      `}</style>

      <TopBar
        title="Takvim"
        subtitle="planlama & takip"
        action={
          <>
            <button className="btn-ghost" onClick={load} title="Yenile" style={{ padding: 8 }}><RefreshCw size={14} /></button>
            <button className="btn" onClick={() => setEkleForm(f => ({ ...f, show: true }))}><Plus size={14} /> Etkinlik Ekle</button>
          </>
        }
      />

      <div style={{ padding: 22, maxWidth: 1360, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button className="btn-ghost" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} style={{ padding: 8 }}><ChevronLeft size={15} /></button>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--tx)', minWidth: 150, textAlign: 'center', textTransform: 'capitalize' }}>{format(currentMonth, 'MMMM yyyy', { locale: tr })}</h2>
            <button className="btn-ghost" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} style={{ padding: 8 }}><ChevronRight size={15} /></button>
            <button className="btn-ghost" onClick={() => { setCurrentMonth(new Date()); setSelectedDay(new Date()) }}>Bugün</button>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(TUR_LABEL).map(([tur, label]) => {
              const Icon = TUR_ICON[tur]
              const aktif = filter.includes(tur)
              return (
                <button key={tur} onClick={() => setFilter(f => aktif ? f.filter(x => x !== tur) : [...f, tur])}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, border: `1px solid ${aktif ? TUR_RENK[tur] : 'var(--bdr)'}`, background: aktif ? `${TUR_RENK[tur]}22` : 'transparent', color: aktif ? TUR_RENK[tur] : 'var(--tx3)' }}>
                  <Icon size={12} strokeWidth={2} /> {label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="cal-wrap">
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', marginBottom: 6 }}>
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(g => (
                <div key={g} className="kpi-label" style={{ textAlign: 'center', padding: '6px 0', marginBottom: 0 }}>{g}</div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 1, background: 'var(--bdr)', borderRadius: 14, overflow: 'hidden', border: '1px solid var(--bdr)' }}>
              {days.map((d, i) => {
                const dayEvents = getEventsForDay(d)
                const inMonth = isSameMonth(d, currentMonth)
                const isSel = !!selectedDay && isSameDay(d, selectedDay)
                const isT = isToday(d)
                return (
                  <div key={i} className="cal-cell" onClick={() => setSelectedDay(d)}
                    style={{ padding: 7, cursor: 'pointer', background: isSel ? 'var(--ac2)' : inMonth ? 'var(--s1)' : 'var(--bg)', outline: isSel ? '1.5px solid var(--ac)' : 'none', outlineOffset: -1.5, transition: 'background .1s' }}>
                    <div style={{ marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isT ? 'var(--ac)' : 'transparent', color: isT ? '#fff' : inMonth ? 'var(--tx)' : 'var(--tx3)' }}>{format(d, 'd')}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dayEvents.slice(0, 3).map(e => (
                        <div key={e.id} style={{ padding: '1px 6px', borderRadius: 5, fontSize: 10.5, fontWeight: 600, color: e.renk, background: `${e.renk}22`, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: `2px solid ${e.renk}` }}>{e.baslik}</div>
                      ))}
                      {dayEvents.length > 3 && <div style={{ fontSize: 10.5, color: 'var(--tx3)', paddingLeft: 4 }}>+{dayEvents.length - 3} daha</div>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="cal-side"><DayPanel /></div>
        </div>

        <div className="card" style={{ marginTop: 18 }}>
          <div className="card-h"><span className="card-title">Yaklaşan Etkinlikler</span></div>
          {loading && <div style={{ padding: 24, textAlign: 'center', fontSize: 12.5, color: 'var(--tx3)' }}>Yükleniyor...</div>}
          {!loading && filteredEvents.filter(e => e.tarih >= startOfDay(today)).length === 0 && <div style={{ padding: 28, textAlign: 'center', fontSize: 12.5, color: 'var(--tx3)' }}>Yaklaşan etkinlik yok</div>}
          {filteredEvents
            .filter(e => e.tarih >= startOfDay(today))
            .sort((a, b) => a.tarih.getTime() - b.tarih.getTime())
            .slice(0, 8)
            .map(e => {
              const Icon = TUR_ICON[e.tur]
              const gunFarki = Math.ceil((startOfDay(e.tarih).getTime() - startOfDay(today).getTime()) / 86400000)
              return (
                <div key={e.id} className="row" style={{ cursor: 'pointer' }} onClick={() => { setSelectedDay(e.tarih); setCurrentMonth(e.tarih) }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: `${e.renk}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Icon size={15} style={{ color: e.renk }} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.baslik}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{format(e.tarih, 'd MMMM yyyy, EEEE', { locale: tr })}</div>
                  </div>
                  <span className={`badge ${gunFarki === 0 ? 'badge-red' : gunFarki <= 2 ? 'badge-amber' : 'badge-muted'}`}>
                    {gunFarki === 0 ? 'Bugün' : gunFarki === 1 ? 'Yarın' : `${gunFarki} gün`}
                  </span>
                </div>
              )
            })}
        </div>
      </div>

      {ekleForm.show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setEkleForm(f => ({ ...f, show: false })) }}>
          <div className="modal anim-pop">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>Etkinlik Ekle</h2>
              <button onClick={() => setEkleForm(f => ({ ...f, show: false }))} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 12 }}><label className="label">Başlık *</label><input className="inp" value={ekleForm.baslik} onChange={e => setEkleForm(f => ({ ...f, baslik: e.target.value }))} placeholder="Etkinliği tanımla..." /></div>
            <div style={{ marginBottom: 12 }}><label className="label">Açıklama</label><textarea className="inp" value={ekleForm.aciklama} onChange={e => setEkleForm(f => ({ ...f, aciklama: e.target.value }))} rows={2} placeholder="Detay..." /></div>
            <div className="modal-grid" style={{ marginBottom: 12 }}>
              <div><label className="label">Tarih *</label><input className="inp" type="date" value={ekleForm.tarih} onChange={e => setEkleForm(f => ({ ...f, tarih: e.target.value }))} /></div>
              <div><label className="label">Öncelik</label>
                <select className="inp" value={ekleForm.oncelik} onChange={e => setEkleForm(f => ({ ...f, oncelik: e.target.value }))}>
                  <option value="dusuk">Düşük</option><option value="normal">Normal</option><option value="yuksek">Yüksek</option><option value="acil">Acil</option>
                </select>
              </div>
            </div>
            <div className="modal-grid" style={{ marginBottom: 12 }}>
              <div><label className="label">SMS Saati</label><input className="inp" type="time" value={ekleForm.sms_saati} onChange={e => setEkleForm(f => ({ ...f, sms_saati: e.target.value }))} /></div>
              <div><label className="label">SMS Telefon</label><input className="inp" value={ekleForm.sms_telefon} onChange={e => setEkleForm(f => ({ ...f, sms_telefon: e.target.value }))} placeholder="905xx..." /></div>
            </div>
            {ekleForm.sms_saati && <p style={{ fontSize: 11.5, color: 'var(--ac)', marginBottom: 12 }}>Görev kaydedildiğinde SMS gönderilecek → {ekleForm.sms_telefon}</p>}
            <button className="btn" onClick={etkinlikEkle} disabled={kayitLoading} style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }}>{kayitLoading ? 'Kaydediliyor...' : 'Etkinlik Kaydet'}</button>
          </div>
        </div>
      )}
    </>
  )
}
