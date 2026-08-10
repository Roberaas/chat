'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase, Session } from '@/lib/supabase'
import StatCard from '@/components/StatCard'
import { MessagesSquare, Users, Headphones, CheckCircle2, TrendingUp, AlertTriangle, Star, Lightbulb, ArrowUp, ArrowDown, Minus } from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { formatDistanceToNow, format, startOfDay, subDays, startOfWeek } from 'date-fns'
import { tr } from 'date-fns/locale'
import { useRouter } from 'next/navigation'

type Stats = {
  toplam: number; bugun: number; dun: number; canli: number
  kvkkOnayli: number; kvkkOranı: number
  son24Saat: { saat: string; sayi: number }[]
  intentDagilimi: { intent: string; count: number }[]
  buHafta: number; gecenHafta: number
  yeniMusteri: number; tekrar: number
}

const INTENT_LABEL: Record<string, string> = {
  greeting: 'Selamlama', products: 'Ürün Listesi', product_detail: 'Ürün Detay',
  order_status: 'Sipariş Durumu', order_create: 'Sipariş Oluştur', subscription: 'Abonelik',
  human_handover: 'Canlı Destek', complaint: 'Şikayet', brand_info: 'Marka Bilgi',
  usage_question: 'Kullanım Sorusu', menu: 'Menü', smalltalk: 'Sohbet', other: 'Diğer',
}
const TONE: Record<string, string> = {
  greeting: '#7c9059', products: '#a8b885', product_detail: '#cfd9b4',
  order_status: '#d9c07a', order_create: '#c4a154', subscription: '#d97757',
  human_handover: '#c4633f', complaint: '#a64d2e', brand_info: '#928c79',
  usage_question: '#c8c4b7', menu: '#3d3a30', smalltalk: '#e8d9a8', other: '#5a7041',
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sadikMusteriler, setSadikMusteriler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fiyatlar, setFiyatlar] = useState<{ altin: any; gumus: any; guncelleme: string } | null>(null)
  const router = useRouter()

  useEffect(() => {
    const keys: string[] = []
    function handleKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      keys.push(e.key.toLowerCase())
      if (keys.length > 2) keys.shift()
      const combo = keys.join('')
      if (combo === 'gd') router.push('/')
      if (combo === 'gc') router.push('/canli-destek')
      if (combo === 'gk') router.push('/konusmalar')
      if (combo === 'gr') router.push('/raporlar')
      if (combo === 'gm') router.push('/musteriler')
      if (combo === 'gl') router.push('/calisma')
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [router])

  useEffect(() => {
    let timer: NodeJS.Timeout
    function reset() {
      clearTimeout(timer)
      timer = setTimeout(async () => {
        await fetch('/api/auth', { method: 'DELETE' })
        router.push('/login')
      }, 30 * 60 * 1000)
    }
    window.addEventListener('mousemove', reset)
    window.addEventListener('keydown', reset)
    reset()
    return () => { clearTimeout(timer); window.removeEventListener('mousemove', reset); window.removeEventListener('keydown', reset) }
  }, [router])

  const load = useCallback(async () => {
    const { data: all } = await supabase.from('wa_sessions_roberto').select('*').order('updated_at', { ascending: false }).limit(500)
    const list = (all || []) as Session[]
    const now = new Date()
    const today = startOfDay(now)
    const yesterday = startOfDay(subDays(now, 1))
    const buHaftaBaslangic = startOfWeek(now, { weekStartsOn: 1 })
    const gecenHaftaBaslangic = startOfWeek(subDays(now, 7), { weekStartsOn: 1 })
    const gecenHaftaBitis = buHaftaBaslangic

    const bugun = list.filter(s => new Date(s.updated_at) >= today).length
    const dun = list.filter(s => new Date(s.updated_at) >= yesterday && new Date(s.updated_at) < today).length
    const buHafta = list.filter(s => new Date(s.updated_at) >= buHaftaBaslangic).length
    const gecenHafta = list.filter(s => new Date(s.updated_at) >= gecenHaftaBaslangic && new Date(s.updated_at) < gecenHaftaBitis).length
    const canli = list.filter(s => s.last_intent === 'human_handover' || s.bulundugu_menu === 'canli').length
    const kvkkOnayli = list.filter(s => s.kvkk_onay === true).length
    const kvkkOranı = list.length ? Math.round((kvkkOnayli / list.length) * 100) : 0

    // Bu hafta yeni vs tekrar
    const buHaftaPhones = list.filter(s => new Date(s.updated_at) >= buHaftaBaslangic).map(s => s.phone)
    const eskiPhones = list.filter(s => new Date(s.updated_at) < buHaftaBaslangic).map(s => s.phone)
    const yeniMusteri = buHaftaPhones.filter(p => !eskiPhones.includes(p)).length
    const tekrar = buHaftaPhones.filter(p => eskiPhones.includes(p)).length

    const buckets: Record<string, number> = {}
    for (let i = 23; i >= 0; i--) { const h = new Date(now.getTime() - i * 3600000); buckets[format(h, 'HH:00')] = 0 }
    list.forEach(s => { const d = new Date(s.updated_at); if ((now.getTime() - d.getTime()) / 3600000 < 24) { const key = format(d, 'HH:00'); if (buckets[key] !== undefined) buckets[key]++ } })

    const intentMap: Record<string, number> = {}
    list.forEach(s => { const i = s.last_intent || 'other'; intentMap[i] = (intentMap[i] || 0) + 1 })
    const intentDagilimi = Object.entries(intentMap).sort((a, b) => b[1] - a[1]).map(([intent, count]) => ({ intent, count }))

    // 6. En sadık müşteriler — en uzun süredir sistemde olanlar
    const sadik = [...list]
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(0, 5)
      .map(s => ({
        phone: s.phone,
        ilkGorulme: s.updated_at,
        intent: s.last_intent,
        kvkk: s.kvkk_onay,
      }))
    setSadikMusteriler(sadik)

    setStats({ toplam: list.length, bugun, dun, canli, kvkkOnayli, kvkkOranı, son24Saat: Object.entries(buckets).map(([saat, sayi]) => ({ saat, sayi })), intentDagilimi, buHafta, gecenHafta, yeniMusteri, tekrar })
    setSessions(list.slice(0, 6))
    setLoading(false)

    // Altın/gümüş fiyatları
    try {
      const fRes = await fetch('/api/fiyat')
      const fData = await fRes.json()
      if (!fData.hata) setFiyatlar(fData)
    } catch {}

  }, [])

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

  if (loading) return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto">
      <div className="mb-8 space-y-3">
        <div className="h-4 w-48 bg-cream-200 rounded animate-pulse" />
        <div className="h-10 w-64 bg-cream-200 rounded animate-pulse" />
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        {[1,2,3,4].map(i => <div key={i} className="h-28 bg-cream-100 rounded-2xl animate-pulse" />)}
      </div>
    </div>
  )

  const trendBugun = stats!.dun > 0 ? Math.round(((stats!.bugun - stats!.dun) / stats!.dun) * 100) : null
  const haftaTrend = stats!.gecenHafta > 0 ? Math.round(((stats!.buHafta - stats!.gecenHafta) / stats!.gecenHafta) * 100) : null

  // 7. Akıllı öneriler
  const oneriler: { icon: string; mesaj: string; href: string; renk: string }[] = []
  if (stats!.canli > 0) oneriler.push({ icon: '🔴', mesaj: `${stats!.canli} müşteri canlı destek bekliyor`, href: '/canli-destek', renk: 'ember' })
  if (stats!.kvkkOranı < 50) oneriler.push({ icon: '📋', mesaj: `KVKK onay oranı düşük (%${stats!.kvkkOranı}) — bot akışını kontrol et`, href: '/raporlar', renk: 'cream' })
  if (haftaTrend !== null && haftaTrend < -20) oneriler.push({ icon: '📉', mesaj: `Bu hafta trafik %${Math.abs(haftaTrend)} düştü — geçen haftaya göre`, href: '/raporlar', renk: 'cream' })
  if (stats!.yeniMusteri > 5) oneriler.push({ icon: '🎉', mesaj: `Bu hafta ${stats!.yeniMusteri} yeni müşteri — harika!`, href: '/konusmalar', renk: 'moss' })

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto">

      {/* Alert */}
      {stats!.canli > 0 && (
        <div className="mb-4 md:mb-6 bg-ember-50 border border-ember-200 rounded-2xl px-4 py-3 md:px-6 md:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <AlertTriangle className="w-4 h-4 md:w-5 md:h-5 text-ember-500 shrink-0" strokeWidth={1.5} />
            <span className="text-ember-700 font-medium text-sm truncate">{stats!.canli} müşteri canlı destek bekliyor</span>
          </div>
          <a href="/canli-destek" className="shrink-0 px-3 py-1.5 bg-ember-600 text-white text-xs font-medium rounded-xl hover:bg-ember-700 transition-colors">Aç →</a>
        </div>
      )}

      <header className="mb-6 md:mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300 font-medium mb-2">{format(new Date(), "d MMMM yyyy", { locale: tr })}</p>
        <div className="flex items-center justify-between">
          <h1 className="font-display text-3xl md:text-5xl text-ink-900 tracking-tight">Genel Bakış</h1>
          <div className="flex items-center gap-2 text-xs text-ink-500">
            <span className="w-2 h-2 rounded-full bg-moss-400 animate-pulse" />
            <span className="font-mono hidden sm:block">canlı yayın</span>
          </div>
        </div>
      </header>


      {/* Altın & Gümüş Fiyatları */}
      {fiyatlar && (
        <div className="grid grid-cols-2 gap-3 md:gap-4 mb-6 md:mb-8">
          {[
            {
              label: '14 Ayar Altın',
              fiyat: fiyatlar.altin?.ayar14 || fiyatlar.altin?.alis,
              satis: fiyatlar.altin?.satis,
              degisim: fiyatlar.altin?.degisim,
              renk: '#c4a154',
              icon: '✦',
            },
            {
              label: '925 Gümüş (Gram)',
              fiyat: fiyatlar.gumus?.alis,
              satis: fiyatlar.gumus?.satis,
              degisim: fiyatlar.gumus?.degisim,
              renk: '#928c79',
              icon: '◆',
            },
          ].map((item) => (
            <div key={item.label} className="bg-white border border-cream-200 rounded-2xl p-4 md:p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] uppercase tracking-[0.2em] text-ink-300">{item.label}</span>
                <span className="text-lg" style={{ color: item.renk }}>{item.icon}</span>
              </div>
              <div className="font-display text-2xl md:text-3xl text-ink-900 mb-1">
                {item.fiyat ? `${Math.round(item.fiyat).toLocaleString('tr')} ₺` : '—'}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-ink-400 font-mono">
                  satış: {item.satis ? `${Math.round(item.satis).toLocaleString('tr')} ₺` : '—'}
                </span>
                {item.degisim != null && (
                  <span className={`text-[10px] font-mono font-medium flex items-center gap-0.5 ${Number(item.degisim) >= 0 ? 'text-moss-500' : 'text-ember-500'}`}>
                    {Number(item.degisim) >= 0 ? '▲' : '▼'} %{Math.abs(Number(item.degisim)).toFixed(2)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4 mb-6 md:mb-8">
        <StatCard label="Toplam Müşteri" value={stats!.toplam} delta={`${stats!.bugun} bugün`} icon={Users} />
        <StatCard label="Bugün Aktif" value={stats!.bugun} delta={trendBugun !== null ? `${trendBugun > 0 ? '+' : ''}${trendBugun}% dün` : '—'} icon={MessagesSquare} tone="moss" />
        <StatCard label="Canlı Destek" value={stats!.canli} delta={stats!.canli > 0 ? 'bekliyor' : 'boş'} icon={Headphones} tone={stats!.canli > 0 ? 'ember' : 'default'} />
        <StatCard label="KVKK" value={`%${stats!.kvkkOranı}`} delta={`${stats!.kvkkOnayli} onaylı`} icon={CheckCircle2} />
      </div>

      {/* 5. Bu haftanın özeti */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 md:mb-8">
        {[
          { label: 'Bu Hafta', value: stats!.buHafta, sub: haftaTrend !== null ? `${haftaTrend > 0 ? '+' : ''}${haftaTrend}% geçen hafta` : 'ilk hafta', trend: haftaTrend },
          { label: 'Geçen Hafta', value: stats!.gecenHafta, sub: 'karşılaştırma', trend: null },
          { label: 'Yeni Müşteri', value: stats!.yeniMusteri, sub: 'bu hafta ilk kez', trend: null },
          { label: 'Tekrar Yazan', value: stats!.tekrar, sub: 'bu hafta geri dönen', trend: null },
        ].map(({ label, value, sub, trend }) => (
          <div key={label} className="bg-white border border-cream-200 rounded-2xl p-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-ink-300 mb-2">{label}</p>
            <div className="flex items-end gap-2">
              <span className="font-display text-2xl md:text-3xl text-ink-900">{value}</span>
              {trend !== null && (
                <span className={`text-xs font-mono mb-0.5 flex items-center gap-0.5 ${trend > 0 ? 'text-moss-500' : trend < 0 ? 'text-ember-500' : 'text-ink-300'}`}>
                  {trend > 0 ? <ArrowUp className="w-3 h-3" /> : trend < 0 ? <ArrowDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                  %{Math.abs(trend)}
                </span>
              )}
            </div>
            <p className="text-[10px] text-ink-300 font-mono mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* 7. Akıllı öneriler */}
      {oneriler.length > 0 && (
        <div className="bg-white border border-cream-200 rounded-2xl p-4 md:p-6 mb-6 md:mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Lightbulb className="w-4 h-4 text-ink-400" strokeWidth={1.5} />
            <h2 className="font-display text-xl text-ink-900">Öneriler</h2>
          </div>
          <div className="space-y-2">
            {oneriler.map((o, i) => (
              <a key={i} href={o.href} className={`flex items-center gap-3 p-3 rounded-xl border transition-colors hover:opacity-80 ${
                o.renk === 'ember' ? 'bg-ember-50 border-ember-200' :
                o.renk === 'moss' ? 'bg-moss-50 border-moss-200' :
                'bg-cream-50 border-cream-200'
              }`}>
                <span className="text-lg shrink-0">{o.icon}</span>
                <span className={`text-sm font-medium flex-1 ${o.renk === 'ember' ? 'text-ember-700' : o.renk === 'moss' ? 'text-moss-700' : 'text-ink-600'}`}>{o.mesaj}</span>
                <span className="text-xs text-ink-300">→</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Grafikler */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="lg:col-span-2 bg-white border border-cream-200 rounded-2xl p-4 md:p-8">
          <div className="flex items-baseline justify-between mb-4 md:mb-8">
            <h2 className="font-display text-xl md:text-2xl text-ink-900">Son 24 Saat</h2>
            <span className="text-xs text-ink-300 hidden md:flex items-center gap-1">
              <TrendingUp className="w-3 h-3" strokeWidth={1.5} />saatlik trafik
            </span>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={stats!.son24Saat} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <XAxis dataKey="saat" tick={{ fontSize: 9, fill: '#928c79' }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: '#928c79' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(124,144,89,0.08)' }} contentStyle={{ background: '#fdfcf7', border: '1px solid #e8d9a8', borderRadius: '8px', fontSize: '11px' }} />
              <Bar dataKey="sayi" radius={[4,4,0,0]}>
                {stats!.son24Saat.map((e,i) => <Cell key={i} fill={e.sayi === Math.max(...stats!.son24Saat.map(h=>h.sayi)) && e.sayi > 0 ? '#c4633f' : '#7c9059'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-cream-200 rounded-2xl p-4 md:p-8">
          <h2 className="font-display text-xl md:text-2xl text-ink-900 mb-4 md:mb-8">Niyet Dağılımı</h2>
          <div className="space-y-2 md:space-y-3">
            {stats!.intentDagilimi.slice(0,6).map(item => {
              const total = stats!.intentDagilimi.reduce((a,b) => a+b.count, 0)
              const pct = total ? Math.round((item.count/total)*100) : 0
              return (
                <div key={item.intent}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ink-700 font-medium truncate mr-2">{INTENT_LABEL[item.intent] || item.intent}</span>
                    <span className="text-ink-300 font-mono shrink-0">{item.count}</span>
                  </div>
                  <div className="h-1.5 bg-cream-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: TONE[item.intent] || '#7c9059' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Alt: Sadık müşteriler + Son konuşmalar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 md:gap-4">

        {/* 6. En sadık müşteriler */}
        <div className="bg-white border border-cream-200 rounded-2xl overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-cream-100 flex items-center gap-2">
            <Star className="w-4 h-4 text-ink-400" strokeWidth={1.5} />
            <h2 className="font-display text-lg md:text-xl text-ink-900">En Sadık Müşteriler</h2>
          </div>
          <div className="divide-y divide-cream-100">
            {sadikMusteriler.map((s, i) => (
              <div key={s.phone} className="px-4 md:px-6 py-3 flex items-center gap-3">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${i === 0 ? 'bg-ink-900 text-cream-50' : i === 1 ? 'bg-moss-200 text-moss-800' : 'bg-cream-200 text-ink-600'}`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-xs text-ink-700 truncate">{s.phone}</div>
                  <div className="text-[10px] text-ink-300 font-mono">
                    {formatDistanceToNow(new Date(s.ilkGorulme), { addSuffix: true, locale: tr })}
                  </div>
                </div>
                {s.kvkk && <span className="text-[10px] text-moss-500 font-mono shrink-0">✓ KVKK</span>}
              </div>
            ))}
            {sadikMusteriler.length === 0 && <div className="px-6 py-8 text-center text-ink-300 font-mono text-xs">henüz veri yok</div>}
          </div>
        </div>

        {/* Son konuşmalar */}
        <div className="lg:col-span-2 bg-white border border-cream-200 rounded-2xl overflow-hidden">
          <div className="px-4 md:px-6 py-4 border-b border-cream-100 flex items-center justify-between">
            <h2 className="font-display text-lg md:text-xl text-ink-900">Son Konuşmalar</h2>
            <a href="/konusmalar" className="text-xs text-moss-600 hover:text-moss-700">Hepsini Gör →</a>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[400px]">
              <thead>
                <tr className="bg-cream-50">
                  {['Müşteri','Son Mesaj','Niyet','Durum','Zaman'].map(h => (
                    <th key={h} className="px-4 md:px-6 py-3 text-left text-[10px] uppercase tracking-[0.2em] text-ink-300">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.phone} className="border-t border-cream-100 hover:bg-cream-50 cursor-pointer" onClick={() => router.push('/konusmalar')}>
                    <td className="px-4 md:px-6 py-3 font-mono text-xs text-ink-700">{s.phone}</td>
                    <td className="px-4 md:px-6 py-3 text-xs text-ink-500 max-w-[120px] truncate">{s.musteri_yazdigi || '—'}</td>
                    <td className="px-4 md:px-6 py-3">
                      <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${TONE[s.last_intent||'other']}20`, color: TONE[s.last_intent||'other'] }}>
                        {INTENT_LABEL[s.last_intent||'other'] || 'Diğer'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3">
                      {s.bulundugu_menu === 'canli' ? <span className="flex items-center gap-1 text-xs text-ember-600"><span className="w-1.5 h-1.5 rounded-full bg-ember-500 animate-pulse" />Canlı</span> : <span className="text-xs text-moss-500">Bot</span>}
                    </td>
                    <td className="px-4 md:px-6 py-3 text-xs text-ink-300 font-mono whitespace-nowrap">
                      {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true, locale: tr })}
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && <tr><td colSpan={5} className="px-6 py-8 text-center text-ink-300 font-mono text-xs">henüz konuşma yok</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
