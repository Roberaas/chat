'use client'

import { useEffect, useState } from 'react'
import { supabase, Session } from '@/lib/supabase'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, LineChart, Line } from 'recharts'
import { RefreshCw, Bot, Headphones, AlertTriangle, Clock, Tag, TrendingUp, TrendingDown, Plus, X, Trash2, DollarSign } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

const INTENT_LABEL: Record<string, string> = {
  greeting: 'Selamlama', products: 'Ürün Listesi', product_detail: 'Ürün Detay',
  order_status: 'Sipariş Durumu', order_create: 'Sipariş Oluştur', subscription: 'Abonelik',
  human_handover: 'Canlı Destek', complaint: 'Şikayet', brand_info: 'Marka Bilgi',
  usage_question: 'Kullanım Sorusu', menu: 'Menü', smalltalk: 'Sohbet', other: 'Diğer',
}
const COLORS = ['#7c9059','#a8b885','#d9c07a','#c4a154','#d97757','#c4633f','#a64d2e','#928c79']
const ETIKET_RENKLER = ['#7c9059','#c4633f','#d9c07a','#928c79','#a8b885','#d97757','#3d3a30','#cfd9b4']
const tooltipStyle = { background: '#fdfcf7', border: '1px solid #e8d9a8', borderRadius: '8px', fontSize: '11px' }

const MILGO_FIYAT = 130 // TL per 2L

export default function RaporlarPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [slaLoglar, setSlaLoglar] = useState<any[]>([])
  const [rakipler, setRakipler] = useState<any[]>([])
  const [etiketler, setEtiketler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'bot' | 'sla' | 'etiket' | 'rakip'>('bot')
  const [rakipForm, setRakipForm] = useState({ show: false, rakip_adi: '', urun: 'Çiğ Süt 2L', fiyat: '', birim: 'L', kaynak: 'manuel' })
  const [etiketForm, setEtiketForm] = useState({ show: false, telefon: '', etiket: '', renk: '#7c9059' })
  const [silinecekEtiket, setSilinecekEtiket] = useState<number | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [s, sla, rakip, etiket] = await Promise.all([
      supabase.from('wa_sessions_roberto').select('*').order('updated_at', { ascending: false }).limit(500),
      fetch('/api/sla').then(r => r.json()),
      fetch('/api/rakip').then(r => r.json()),
      fetch('/api/etiket').then(r => r.json()),
    ])
    setSessions((s.data || []) as Session[])
    setSlaLoglar(sla.loglar || [])
    setRakipler(rakip.rakipler || [])
    setEtiketler(etiket.etiketler || [])
    setLoading(false)
  }

  // 6. Bot metrikleri
  const toplamKonusma = sessions.length
  const botCozdu = sessions.filter(s => s.last_intent !== 'human_handover' && s.bulundugu_menu !== 'canli').length
  const canliDusdu = sessions.filter(s => s.last_intent === 'human_handover' || s.bulundugu_menu === 'canli').length
  const botBasariOrani = toplamKonusma > 0 ? Math.round((botCozdu / toplamKonusma) * 100) : 0
  const intentMap: Record<string, number> = {}
  sessions.forEach((s: any) => { const i = s.last_intent || 'other'; intentMap[i] = (intentMap[i] || 0) + 1 })
  const intentData = Object.entries(intentMap).sort((a,b) => b[1]-a[1]).map(([intent, count]) => ({ intent, name: INTENT_LABEL[intent] || intent, count }))
  const sorunluIntentler = intentData.filter(i => i.intent === 'human_handover' || i.intent === 'complaint')
  const saatMap: Record<string, number> = {}
  for (let i = 0; i < 24; i++) saatMap[String(i).padStart(2,'0')] = 0
  sessions.forEach(s => { const h = String(new Date(s.updated_at).getHours()).padStart(2,'0'); if (saatMap[h] !== undefined) saatMap[h]++ })
  const saatData = Object.entries(saatMap).map(([saat, sayi]) => ({ saat: `${saat}:00`, sayi }))
  const maxSaat = Math.max(...saatData.map(s => s.sayi))
  const enYogunSaat = saatData.find(s => s.sayi === maxSaat)

  // 10. SLA metrikleri
  const ortYanitSuresi = slaLoglar.filter(l => l.yanit_suresi_dk).reduce((s, l, _, a) => s + l.yanit_suresi_dk / a.length, 0)
  const ortCozumSuresi = slaLoglar.filter(l => l.cozum_suresi_dk).reduce((s, l, _, a) => s + l.cozum_suresi_dk / a.length, 0)
  const acikTalepler = slaLoglar.filter(l => l.durum === 'acik').length
  const slaIhlal = slaLoglar.filter(l => l.yanit_suresi_dk > 10).length

  // 9. Etiket analizi
  const etiketMap: Record<string, number> = {}
  etiketler.forEach(e => { etiketMap[e.etiket] = (etiketMap[e.etiket] || 0) + 1 })
  const etiketData = Object.entries(etiketMap).sort((a,b) => b[1]-a[1]).map(([etiket, count]) => ({ etiket, count }))

  // 14. Rakip analizi
  const rakipGruplar: Record<string, any[]> = {}
  rakipler.forEach(r => {
    if (!rakipGruplar[r.rakip_adi]) rakipGruplar[r.rakip_adi] = []
    rakipGruplar[r.rakip_adi].push(r)
  })
  const rakipKarsilastirma = Object.entries(rakipGruplar).map(([rakip, veriler]) => {
    const sonFiyat = veriler[0]?.fiyat || 0
    return { rakip, fiyat: sonFiyat, fark: sonFiyat - MILGO_FIYAT, farkYuzde: Math.round((sonFiyat - MILGO_FIYAT) / MILGO_FIYAT * 100) }
  })

  async function rakipEkle() {
    if (!rakipForm.rakip_adi || !rakipForm.fiyat) return
    await fetch('/api/rakip', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...rakipForm, fiyat: parseFloat(rakipForm.fiyat) })
    })
    setRakipForm({ show: false, rakip_adi: '', urun: 'Çiğ Süt 2L', fiyat: '', birim: 'L', kaynak: 'manuel' })
    load()
  }

  async function rakipSil(id: number) {
    await fetch(`/api/rakip?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function etiketEkle() {
    if (!etiketForm.telefon || !etiketForm.etiket) return
    await fetch('/api/etiket', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(etiketForm)
    })
    setEtiketForm({ show: false, telefon: '', etiket: '', renk: '#7c9059' })
    load()
  }

  async function etiketSil(id: number) {
    if (!confirm('Bu etiketi silmek istiyor musunuz?')) return
    await fetch(`/api/etiket?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto">
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-ink-300 mb-2">analiz & takip</p>
          <h1 className="font-display text-3xl md:text-5xl text-ink-900 tracking-tight">Raporlar</h1>
        </div>
        <button onClick={load} className="w-9 h-9 flex items-center justify-center bg-white border border-cream-200 rounded-xl text-ink-400 hover:text-ink-700">
          <RefreshCw className="w-4 h-4" />
        </button>
      </header>

      {/* Özet kartlar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-moss-50 border border-moss-200 rounded-2xl p-4 md:p-6">
          <div className="flex items-start justify-between mb-3"><span className="text-[10px] uppercase tracking-[0.2em] text-moss-600">Bot Başarı</span><Bot className="w-4 h-4 text-moss-500" strokeWidth={1.5} /></div>
          <div className="font-display text-3xl md:text-4xl text-moss-700">%{botBasariOrani}</div>
          <p className="text-xs text-moss-500 font-mono mt-1">{botCozdu} konuşma çözüldü</p>
        </div>
        <div className={`border rounded-2xl p-4 md:p-6 ${canliDusdu > 5 ? 'bg-ember-50 border-ember-200' : 'bg-white border-cream-200'}`}>
          <div className="flex items-start justify-between mb-3"><span className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Canlı Destek</span><Headphones className="w-4 h-4 text-ink-300" strokeWidth={1.5} /></div>
          <div className="font-display text-3xl md:text-4xl text-ink-900">{canliDusdu}</div>
          <p className="text-xs text-ink-300 font-mono mt-1">canlıya düştü</p>
        </div>
        <div className="bg-white border border-cream-200 rounded-2xl p-4 md:p-6">
          <div className="flex items-start justify-between mb-3"><span className="text-[10px] uppercase tracking-[0.2em] text-ink-400">Ort. Yanıt</span><Clock className="w-4 h-4 text-ink-300" strokeWidth={1.5} /></div>
          <div className="font-display text-3xl md:text-4xl text-ink-900">{ortYanitSuresi > 0 ? `${Math.round(ortYanitSuresi)}dk` : '—'}</div>
          <p className="text-xs text-ink-300 font-mono mt-1">canlı destek yanıt</p>
        </div>
        <div className="bg-white border border-cream-200 rounded-2xl p-4 md:p-6">
          <div className="flex items-start justify-between mb-3"><span className="text-[10px] uppercase tracking-[0.2em] text-ink-400">En Yoğun</span><Clock className="w-4 h-4 text-ink-300" strokeWidth={1.5} /></div>
          <div className="font-display text-2xl md:text-3xl text-ink-900">{enYogunSaat?.saat || '—'}</div>
          <p className="text-xs text-ink-300 font-mono mt-1">{maxSaat} mesaj</p>
        </div>
      </div>

      {/* Tablar */}
      <div className="flex overflow-x-auto gap-1 mb-6 bg-white border border-cream-200 rounded-xl p-1">
        {[
          { v: 'bot', l: '🤖 Bot Metrikleri' },
          { v: 'sla', l: '⏱️ SLA Takibi' },
          { v: 'etiket', l: '🏷️ Etiketler' },
          { v: 'rakip', l: '🔍 Rakip Analizi' },
        ].map(t => (
          <button key={t.v} onClick={() => setTab(t.v as any)}
            className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-all ${tab === t.v ? 'bg-ink-900 text-cream-50' : 'text-ink-500 hover:text-ink-700'}`}>
            {t.l}
          </button>
        ))}
      </div>

      {/* 6. BOT METRİKLERİ */}
      {tab === 'bot' && (
        <div className="space-y-4">
          {sorunluIntentler.length > 0 && (
            <div className="bg-ember-50 border border-ember-200 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-4 h-4 text-ember-500 shrink-0 mt-0.5" strokeWidth={1.5} />
              <div>
                <p className="text-sm font-medium text-ember-700 mb-1">Bot Sorun Noktaları</p>
                {sorunluIntentler.map(i => (
                  <p key={i.intent} className="text-xs text-ember-600">{i.name}: {i.count} kez → canlı desteğe düştü</p>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white border border-cream-200 rounded-2xl p-4 md:p-6">
              <h2 className="font-display text-xl text-ink-900 mb-4">Intent Dağılımı</h2>
              <div className="space-y-2">
                {intentData.slice(0,8).map((d, i) => {
                  const total = intentData.reduce((a,b) => a+b.count, 0)
                  const pct = total ? Math.round(d.count/total*100) : 0
                  const isProblematic = d.intent === 'human_handover' || d.intent === 'complaint'
                  return (
                    <div key={d.intent}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className={`font-medium flex items-center gap-1 ${isProblematic ? 'text-ember-600' : 'text-ink-700'}`}>
                          {isProblematic && <AlertTriangle className="w-3 h-3" />}{d.name}
                        </span>
                        <span className="text-ink-400 font-mono">{d.count} · %{pct}</span>
                      </div>
                      <div className="h-1.5 bg-cream-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: isProblematic ? '#c4633f' : COLORS[i % COLORS.length] }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <div className="bg-white border border-cream-200 rounded-2xl p-4 md:p-6">
              <h2 className="font-display text-xl text-ink-900 mb-4">Saatlik Yoğunluk</h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={saatData} margin={{ top: 4, right: 4, bottom: 4, left: -25 }}>
                  <XAxis dataKey="saat" tick={{ fontSize: 8, fill: '#928c79' }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fontSize: 9, fill: '#928c79' }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [`${v} mesaj`, '']} />
                  <Bar dataKey="sayi" radius={[3,3,0,0]}>
                    {saatData.map((e,i) => <Cell key={i} fill={e.sayi === maxSaat && maxSaat > 0 ? '#c4633f' : '#7c9059'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white border border-cream-200 rounded-2xl p-4 md:p-6">
              <h2 className="font-display text-lg text-ink-900 mb-3">Bot vs Canlı</h2>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={[{name:'Bot',value:botCozdu},{name:'Canlı',value:canliDusdu}]} cx="50%" cy="50%" outerRadius={55} dataKey="value">
                    <Cell fill="#7c9059" /><Cell fill="#c4633f" />
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex justify-center gap-4 text-xs">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-moss-500" />Bot %{botBasariOrani}</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-ember-500" />Canlı %{100-botBasariOrani}</span>
              </div>
            </div>
            <div className="md:col-span-2 bg-white border border-cream-200 rounded-2xl p-4 md:p-6">
              <h2 className="font-display text-lg text-ink-900 mb-3">Bot Performans Özeti</h2>
              <div className="space-y-3">
                {[
                  { label: 'Toplam Konuşma', value: toplamKonusma, icon: '💬' },
                  { label: 'Bot Çözdü', value: `${botCozdu} (%${botBasariOrani})`, icon: '✅' },
                  { label: 'Canlıya Düştü', value: `${canliDusdu} (%${100-botBasariOrani})`, icon: '🔴' },
                  { label: 'En Sorunlu Intent', value: sorunluIntentler[0] ? `${sorunluIntentler[0].name} (${sorunluIntentler[0].count}x)` : '—', icon: '⚠️' },
                  { label: 'En Yoğun Saat', value: enYogunSaat ? `${enYogunSaat.saat} (${maxSaat} mesaj)` : '—', icon: '⏰' },
                ].map(({ label, value, icon }) => (
                  <div key={label} className="flex items-center justify-between py-2 border-b border-cream-100 last:border-0">
                    <span className="text-sm text-ink-500 flex items-center gap-2"><span>{icon}</span>{label}</span>
                    <span className="text-sm font-medium text-ink-900 font-mono">{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 10. SLA TAKİBİ */}
      {tab === 'sla' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Ort. Yanıt', value: ortYanitSuresi > 0 ? `${Math.round(ortYanitSuresi)} dk` : '—', sub: 'hedef: <5 dk', color: ortYanitSuresi > 10 ? 'bg-ember-50 border-ember-200' : 'bg-moss-50 border-moss-200' },
              { label: 'Ort. Çözüm', value: ortCozumSuresi > 0 ? `${Math.round(ortCozumSuresi)} dk` : '—', sub: 'hedef: <30 dk', color: 'bg-white border-cream-200' },
              { label: 'Açık Talepler', value: acikTalepler, sub: 'henüz kapanmadı', color: acikTalepler > 3 ? 'bg-ember-50 border-ember-200' : 'bg-white border-cream-200' },
              { label: 'SLA İhlali', value: slaIhlal, sub: '>10 dk yanıt', color: slaIhlal > 0 ? 'bg-ember-50 border-ember-200' : 'bg-moss-50 border-moss-200' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className={`border rounded-2xl p-4 ${color}`}>
                <p className="text-[10px] uppercase tracking-[0.2em] text-ink-400 mb-2">{label}</p>
                <div className="font-display text-2xl md:text-3xl text-ink-900">{value}</div>
                <p className="text-[10px] text-ink-300 font-mono mt-1">{sub}</p>
              </div>
            ))}
          </div>

          <div className="bg-white border border-cream-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-cream-100 bg-cream-50">
              <h2 className="font-display text-xl text-ink-900">Canlı Destek Logları</h2>
              <p className="text-xs text-ink-400 font-mono mt-0.5">Her canlı destek görüşmesinin süresi</p>
            </div>
            {slaLoglar.length === 0 ? (
              <div className="p-12 text-center">
                <Clock className="w-10 h-10 mx-auto text-cream-300 mb-3" strokeWidth={1.5} />
                <p className="text-sm text-ink-500">Henüz SLA kaydı yok</p>
                <p className="text-xs text-ink-300 mt-1">Canlı destek görüşmeleri burada takip edilecek</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>{['Telefon','Başlangıç','İlk Yanıt','Çözüm','Yanıt Süresi','Durum'].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] uppercase tracking-[0.2em] text-ink-300">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {slaLoglar.map(l => (
                    <tr key={l.id} className="border-t border-cream-100 hover:bg-cream-50">
                      <td className="px-5 py-3 font-mono text-sm text-ink-700">{l.telefon}</td>
                      <td className="px-5 py-3 text-xs text-ink-500 font-mono">{format(new Date(l.baslangic), 'd MMM HH:mm', { locale: tr })}</td>
                      <td className="px-5 py-3 text-xs text-ink-500 font-mono">{l.ilk_yanit ? format(new Date(l.ilk_yanit), 'HH:mm') : '—'}</td>
                      <td className="px-5 py-3 text-xs text-ink-500 font-mono">{l.kapanis ? format(new Date(l.kapanis), 'HH:mm') : '—'}</td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-mono font-medium ${l.yanit_suresi_dk > 10 ? 'text-ember-600' : 'text-moss-600'}`}>
                          {l.yanit_suresi_dk ? `${l.yanit_suresi_dk} dk` : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${l.durum === 'kapali' ? 'bg-moss-100 text-moss-700' : 'bg-ember-100 text-ember-600'}`}>
                          {l.durum === 'kapali' ? '✓ Kapandı' : '● Açık'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* 9. ETİKET SİSTEMİ */}
      {tab === 'etiket' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl text-ink-900">Müşteri Etiketleri</h2>
              <p className="text-xs text-ink-400 font-mono mt-1">{etiketler.length} etiket · {Object.keys(etiketMap).length} farklı tür</p>
            </div>
            <button onClick={() => setEtiketForm(f => ({ ...f, show: true }))}
              className="flex items-center gap-2 px-4 py-2 bg-ink-900 text-cream-50 rounded-xl text-sm font-medium hover:bg-ink-700 transition-colors">
              <Plus className="w-4 h-4" />Etiket Ekle
            </button>
          </div>

          {etiketData.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              {etiketData.slice(0,8).map((e, i) => (
                <div key={e.etiket} className="bg-white border border-cream-200 rounded-2xl p-4">
                  <div className="w-8 h-8 rounded-lg mb-2 flex items-center justify-center" style={{ background: `${ETIKET_RENKLER[i % ETIKET_RENKLER.length]}20` }}>
                    <Tag className="w-4 h-4" style={{ color: ETIKET_RENKLER[i % ETIKET_RENKLER.length] }} strokeWidth={1.5} />
                  </div>
                  <div className="font-medium text-ink-900 text-sm">{e.etiket}</div>
                  <div className="text-xs text-ink-400 font-mono mt-0.5">{e.count} müşteri</div>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white border border-cream-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-cream-100 bg-cream-50">
              <h2 className="font-display text-lg text-ink-900">Tüm Etiketler</h2>
            </div>
            {etiketler.length === 0 ? (
              <div className="p-12 text-center">
                <Tag className="w-10 h-10 mx-auto text-cream-300 mb-3" strokeWidth={1.5} />
                <p className="text-sm text-ink-500">Henüz etiket yok</p>
                <p className="text-xs text-ink-300 mt-1">"VIP", "alerjisi var", "kapıda ödeme" gibi etiketler ekle</p>
              </div>
            ) : (
              <div className="divide-y divide-cream-100">
                {etiketler.map(e => (
                  <div key={e.id} className="px-5 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-3 h-3 rounded-full" style={{ background: e.renk }} />
                      <span className="text-sm font-medium text-ink-900">{e.etiket}</span>
                      <span className="font-mono text-xs text-ink-400">{e.telefon}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-ink-300 font-mono">{format(new Date(e.created_at), 'd MMM', { locale: tr })}</span>
                      <button onClick={() => etiketSil(e.id)} className="w-7 h-7 flex items-center justify-center text-ink-300 hover:text-ember-500 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 14. RAKİP ANALİZİ */}
      {tab === 'rakip' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-2xl text-ink-900">Rakip Fiyat Analizi</h2>
              <p className="text-xs text-ink-400 font-mono mt-1"></p>
            </div>
            <button onClick={() => setRakipForm(f => ({ ...f, show: true }))}
              className="flex items-center gap-2 px-4 py-2 bg-ink-900 text-cream-50 rounded-xl text-sm font-medium hover:bg-ink-700 transition-colors">
              <Plus className="w-4 h-4" />Rakip Ekle
            </button>
          </div>

          {/* Fiyat karşılaştırma */}
          <div className="bg-white border border-cream-200 rounded-2xl p-4 md:p-6">
            <h3 className="font-display text-xl text-ink-900 mb-5">Fiyat Karşılaştırması</h3>
            <div className="space-y-4">
              
              <div className="flex items-center gap-4">
                <div className="w-24 text-sm font-bold text-moss-700">roberto.</div>
                <div className="flex-1 h-8 bg-moss-100 rounded-lg relative flex items-center">
                  <div className="h-full bg-moss-500 rounded-lg" style={{ width: '100%' }} />
                  <span className="absolute right-3 text-xs font-bold text-white">{MILGO_FIYAT} TL</span>
                </div>
                <div className="w-20 text-right">
                  <span className="text-xs bg-moss-100 text-moss-700 px-2 py-0.5 rounded-full font-medium">bizim fiyat</span>
                </div>
              </div>
              {rakipKarsilastirma.map(r => {
                const maxFiyat = Math.max(...rakipKarsilastirma.map(x => x.fiyat), MILGO_FIYAT)
                const pct = (r.fiyat / maxFiyat) * 100
                const daha = r.fiyat > MILGO_FIYAT ? 'pahalı' : r.fiyat < MILGO_FIYAT ? 'ucuz' : 'aynı'
                return (
                  <div key={r.rakip} className="flex items-center gap-4">
                    <div className="w-24 text-sm text-ink-600 font-medium truncate">{r.rakip}</div>
                    <div className="flex-1 h-8 bg-cream-100 rounded-lg relative flex items-center">
                      <div className="h-full rounded-lg" style={{ width: `${pct}%`, background: r.fiyat > MILGO_FIYAT ? '#c4633f' : '#7c9059' }} />
                      <span className="absolute right-3 text-xs font-bold text-ink-700">{r.fiyat} TL</span>
                    </div>
                    <div className="w-20 text-right">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1 justify-end ${r.fiyat > MILGO_FIYAT ? 'text-ember-600' : r.fiyat < MILGO_FIYAT ? 'text-moss-600' : 'text-ink-500'}`}>
                        {r.fiyat > MILGO_FIYAT ? <TrendingUp className="w-3 h-3" /> : r.fiyat < MILGO_FIYAT ? <TrendingDown className="w-3 h-3" /> : null}
                        {daha}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Rakip detay tablosu */}
          <div className="bg-white border border-cream-200 rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-cream-100 bg-cream-50">
              <h3 className="font-display text-lg text-ink-900">Rakip Fiyat Geçmişi</h3>
            </div>
            {rakipler.length === 0 ? (
              <div className="p-12 text-center">
                <DollarSign className="w-10 h-10 mx-auto text-cream-300 mb-3" strokeWidth={1.5} />
                <p className="text-sm text-ink-500">Henüz rakip fiyatı girilmedi</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr>{['Rakip','Ürün','Fiyat','Fark','Kaynak','Tarih',''].map(h => (
                    <th key={h} className="px-5 py-3 text-left text-[10px] uppercase tracking-[0.2em] text-ink-300">{h}</th>
                  ))}</tr>
                </thead>
                <tbody>
                  {rakipler.map(r => (
                    <tr key={r.id} className="border-t border-cream-100 hover:bg-cream-50">
                      <td className="px-5 py-3 text-sm font-medium text-ink-900">{r.rakip_adi}</td>
                      <td className="px-5 py-3 text-sm text-ink-500">{r.urun}</td>
                      <td className="px-5 py-3 font-mono text-sm font-bold text-ink-900">{r.fiyat} TL</td>
                      <td className="px-5 py-3">
                        <span className={`text-sm font-mono font-medium flex items-center gap-1 ${r.fiyat > MILGO_FIYAT ? 'text-ember-600' : 'text-moss-600'}`}>
                          {r.fiyat > MILGO_FIYAT ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {r.fiyat > MILGO_FIYAT ? '+' : ''}{r.fiyat - MILGO_FIYAT} TL
                        </span>
                      </td>
                      <td className="px-5 py-3 text-xs text-ink-400 font-mono">{r.kaynak}</td>
                      <td className="px-5 py-3 text-xs text-ink-300 font-mono">{format(new Date(r.tarih || r.created_at), 'd MMM yyyy', { locale: tr })}</td>
                      <td className="px-5 py-3">
                        <button onClick={() => rakipSil(r.id)} className="w-7 h-7 flex items-center justify-center text-ink-300 hover:text-ember-500 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Rakip ekleme modal */}
      {rakipForm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setRakipForm(f => ({ ...f, show: false }))}>
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-2xl text-ink-900">Rakip Ekle</h2>
              <button onClick={() => setRakipForm(f => ({ ...f, show: false }))}><X className="w-5 h-5 text-ink-300" /></button>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Rakip Adı', key: 'rakip_adi', placeholder: 'Rakip A' },
                { label: 'Ürün', key: 'urun', placeholder: 'Çiğ Süt 2L' },
                { label: 'Fiyat (TL)', key: 'fiyat', placeholder: '120' },
                { label: 'Kaynak', key: 'kaynak', placeholder: 'website, instagram...' },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-ink-300 block mb-1">{label}</label>
                  <input value={(rakipForm as any)[key]} onChange={e => setRakipForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
                    className="w-full px-3 py-2.5 bg-cream-50 border border-cream-200 rounded-xl text-sm text-ink-700 focus:outline-none focus:border-moss-400" />
                </div>
              ))}
              <button onClick={rakipEkle} className="w-full py-3 bg-ink-900 text-cream-50 rounded-xl text-sm font-medium hover:bg-ink-700 transition-colors">Kaydet</button>
            </div>
          </div>
        </div>
      )}

      {/* Etiket ekleme modal */}
      {etiketForm.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setEtiketForm(f => ({ ...f, show: false }))}>
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-sm" />
          <div className="relative bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-display text-2xl text-ink-900">Etiket Ekle</h2>
              <button onClick={() => setEtiketForm(f => ({ ...f, show: false }))}><X className="w-5 h-5 text-ink-300" /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink-300 block mb-1">Telefon</label>
                <input value={etiketForm.telefon} onChange={e => setEtiketForm(f => ({ ...f, telefon: e.target.value }))} placeholder="905xx..."
                  className="w-full px-3 py-2.5 bg-cream-50 border border-cream-200 rounded-xl text-sm font-mono text-ink-700 focus:outline-none focus:border-moss-400" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink-300 block mb-1">Etiket</label>
                <input value={etiketForm.etiket} onChange={e => setEtiketForm(f => ({ ...f, etiket: e.target.value }))} placeholder="VIP, alerjisi var, kapıda ödeme..."
                  className="w-full px-3 py-2.5 bg-cream-50 border border-cream-200 rounded-xl text-sm text-ink-700 focus:outline-none focus:border-moss-400" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink-300 block mb-1">Hazır Etiketler</label>
                <div className="flex flex-wrap gap-2">
                  {['VIP', 'Alerjisi Var', 'Kapıda Ödeme', 'Düzenli Müşteri', 'Şikayetçi', 'Abonelik Riski'].map(t => (
                    <button key={t} onClick={() => setEtiketForm(f => ({ ...f, etiket: t }))}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${etiketForm.etiket === t ? 'bg-ink-900 text-cream-50 border-ink-900' : 'bg-white border-cream-200 text-ink-500'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-ink-300 block mb-1">Renk</label>
                <div className="flex gap-2">
                  {ETIKET_RENKLER.map(r => (
                    <button key={r} onClick={() => setEtiketForm(f => ({ ...f, renk: r }))}
                      className={`w-8 h-8 rounded-lg transition-all ${etiketForm.renk === r ? 'ring-2 ring-offset-2 ring-ink-900 scale-110' : ''}`}
                      style={{ background: r }} />
                  ))}
                </div>
              </div>
              <button onClick={etiketEkle} className="w-full py-3 bg-ink-900 text-cream-50 rounded-xl text-sm font-medium hover:bg-ink-700 transition-colors">Kaydet</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
