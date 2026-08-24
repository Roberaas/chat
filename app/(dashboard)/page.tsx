'use client'

function FiyatKart({ label, d, sym, color, small, usdRate }: { label: string; d: any; sym: string; color: string; small?: boolean; usdRate?: number }) {
  if (!d) return null
  const alis = d.alis ?? d
  const satis = d.satis
  const degisim = d.degisim
  const fmtTL = (n: number | null) => n != null ? n.toLocaleString('tr-TR', { maximumFractionDigits: n < 10 ? 4 : 0 }) + ' ₺' : '—'
  const fmtUSD = (n: number | null) => n != null && usdRate ? '$' + (n / usdRate).toLocaleString('en-US', { maximumFractionDigits: 2 }) : ''
  return (
    <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-gold)', borderRadius: 10, padding: small ? '10px 14px' : '14px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontSize: 9, letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>{label}</span>
        <span style={{ color, fontSize: small ? 12 : 14 }}>{sym}</span>
      </div>
      <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: small ? 20 : 26, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1 }}>
        {fmtTL(alis)}
      </div>
      {usdRate && alis != null && (
        <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: 3 }}>
          {fmtUSD(alis)}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
        <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
          {satis != null && !small ? `satış ${fmtTL(satis)}` : ''}
        </span>
        {degisim != null && !isNaN(degisim) && (
          <span style={{ fontSize: 9, fontFamily: 'JetBrains Mono, monospace', color: degisim >= 0 ? 'var(--gold)' : '#C4364A' }}>
            {degisim >= 0 ? '▲' : '▼'} %{Math.abs(degisim).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  )
}


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
  const [fiyatlar, setFiyatlar] = useState<any>(null)
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

  if (loading) return (
    <div style={{ padding: '40px 32px', maxWidth: 1280, margin: '0 auto' }}>
      <div style={{ marginBottom: 32 }}>
        <div style={{ height: 12, width: 160, background: 'var(--bg-card2)', borderRadius: 6, marginBottom: 12 }} />
        <div style={{ height: 40, width: 240, background: 'var(--bg-card)', borderRadius: 8 }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[1,2,3,4].map(i => <div key={i} style={{ height: 110, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid rgba(201,168,76,0.06)' }} />)}
      </div>
    </div>
  )

  const trendBugun = stats!.dun > 0 ? Math.round(((stats!.bugun - stats!.dun) / stats!.dun) * 100) : null
  const haftaTrend = stats!.gecenHafta > 0 ? Math.round(((stats!.buHafta - stats!.gecenHafta) / stats!.gecenHafta) * 100) : null

  const oneriler: { icon: string; mesaj: string; href: string; renk: string }[] = []
  if (stats!.canli > 0) oneriler.push({ icon: '⬤', mesaj: `${stats!.canli} müşteri canlı destek bekliyor`, href: '/canli-destek', renk: 'ruby' })
  if (stats!.kvkkOranı < 50) oneriler.push({ icon: '◆', mesaj: `KVKK onay oranı düşük (%${stats!.kvkkOranı}) — bot akışını kontrol et`, href: '/raporlar', renk: 'default' })
  if (haftaTrend !== null && haftaTrend < -20) oneriler.push({ icon: '▼', mesaj: `Bu hafta trafik %${Math.abs(haftaTrend)} düştü`, href: '/raporlar', renk: 'default' })
  if (stats!.yeniMusteri > 5) oneriler.push({ icon: '✦', mesaj: `Bu hafta ${stats!.yeniMusteri} yeni müşteri`, href: '/konusmalar', renk: 'gold' })

  return (
    <div style={{ padding: '32px 28px', maxWidth: 1280, margin: '0 auto' }} className="stagger">

      {/* Alert */}
      {stats!.canli > 0 && (
        <div style={{ marginBottom: 20, padding: '14px 20px', background: 'rgba(139,38,53,0.1)', border: '1px solid rgba(196,54,74,0.25)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#C4364A', display: 'inline-block', animation: 'urgentPulse 1.5s ease-in-out infinite' }} />
            <span style={{ color: '#C4364A', fontWeight: 500, fontSize: 13 }}>{stats!.canli} müşteri canlı destek bekliyor</span>
          </div>
          <a href="/canli-destek" style={{ padding: '6px 14px', background: '#8B2635', color: '#fff', borderRadius: 8, fontSize: 12, fontWeight: 500, textDecoration: 'none' }}>Görüntüle →</a>
        </div>
      )}

      {/* Header */}
      <header style={{ marginBottom: 32 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8, fontFamily: 'JetBrains Mono, monospace' }}>
          {format(new Date(), "d MMMM yyyy", { locale: tr })}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 44, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
            Genel Bakış
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A84C', display: 'inline-block', animation: 'pulse-gold 2s infinite' }} />
            canlı
          </div>
        </div>
        <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(201,168,76,0.3), transparent)', marginTop: 16 }} />
      </header>

      {/* Fiyat Kartları */}
      {fiyatlar && (
        <div style={{ marginBottom: 24 }}>
          {/* Altın */}
          <div style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Altın</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Gram Altın',  d: fiyatlar.altin?.gram,   sym: '✦', color: '#8B6914', usdRate: true },
              { label: '14 Ayar',     d: fiyatlar.altin?.ayar14, sym: '✦', color: '#8B6914', usdRate: true },
              { label: 'Çeyrek',      d: fiyatlar.altin?.ceyrek, sym: '✦', color: '#A07820', usdRate: true },
              { label: 'Yarım',       d: fiyatlar.altin?.yarim,  sym: '✦', color: '#A07820', usdRate: true },
              { label: 'Tam',         d: fiyatlar.altin?.tam,    sym: '✦', color: '#8B6810', usdRate: true },
            ].map(item => (
              <FiyatKart key={item.label} label={item.label} d={item.d} sym={item.sym} color={item.color} usdRate={(item as any).usdRate ? fiyatlar.doviz?.usd?.alis : undefined} />
            ))}
          </div>
          {/* Gümüş & Platin */}
          <div style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Diğer Madenler</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Gümüş (gr)', d: fiyatlar.gumus,  sym: '◆', color: 'var(--text-muted)', usdRate: true },
              { label: 'Platin (gr)', d: fiyatlar.platin, sym: '◈', color: '#5A6A7A', usdRate: true },
            ].map(item => (
              <FiyatKart key={item.label} label={item.label} d={item.d} sym={item.sym} color={item.color} usdRate={(item as any).usdRate ? fiyatlar.doviz?.usd?.alis : undefined} />
            ))}
          </div>
          {/* Döviz */}
          <div style={{ fontSize: 9, letterSpacing: '0.25em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 8 }}>Döviz</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 10 }}>
            {[
              { label: 'USD',  d: fiyatlar.doviz?.usd, sym: '$',  color: '#7A9A6A' },
              { label: 'EUR',  d: fiyatlar.doviz?.eur, sym: '€',  color: '#6A7A9A' },
              { label: 'GBP',  d: fiyatlar.doviz?.gbp, sym: '£',  color: '#8A7A9A' },
              { label: 'RUB',  d: fiyatlar.doviz?.rub, sym: '₽',  color: '#9A7A6A' },
              { label: 'SAR',  d: fiyatlar.doviz?.sar, sym: '﷼',  color: '#8A9A6A' },
              { label: 'AED',  d: fiyatlar.doviz?.aed, sym: 'د',  color: '#6A9A8A' },
            ].map(item => (
              <FiyatKart key={item.label} label={item.label} d={item.d} sym={item.sym} color={item.color} small />
            ))}
          </div>
        </div>
      )}

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }} className="lg:grid-cols-4">
        <StatCard label="Toplam Müşteri" value={stats!.toplam} delta={`${stats!.bugun} bugün`} icon={Users} />
        <StatCard label="Bugün Aktif" value={stats!.bugun} delta={trendBugun !== null ? `${trendBugun > 0 ? '+' : ''}${trendBugun}% dün` : '—'} icon={MessagesSquare} tone="gold" />
        <StatCard label="Canlı Destek" value={stats!.canli} delta={stats!.canli > 0 ? 'bekliyor' : 'boş'} icon={Headphones} tone={stats!.canli > 0 ? 'ruby' : 'default'} />
        <StatCard label="KVKK Onay" value={`%${stats!.kvkkOranı}`} delta={`${stats!.kvkkOnayli} onaylı`} icon={CheckCircle2} />
      </div>

      {/* Haftalık Özet */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }} className="grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Bu Hafta', value: stats!.buHafta, sub: haftaTrend !== null ? `${haftaTrend > 0 ? '+' : ''}${haftaTrend}% geçen hafta` : 'ilk hafta', trend: haftaTrend },
          { label: 'Geçen Hafta', value: stats!.gecenHafta, sub: 'karşılaştırma', trend: null },
          { label: 'Yeni Müşteri', value: stats!.yeniMusteri, sub: 'bu hafta ilk kez', trend: null },
          { label: 'Tekrar Yazan', value: stats!.tekrar, sub: 'geri dönen', trend: null },
        ].map(({ label, value, sub, trend }) => (
          <div key={label} style={{ background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.08)', borderRadius: 12, padding: '16px 18px' }}>
            <p style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>{label}</p>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
              <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 36, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</span>
              {trend !== null && (
                <span style={{ fontSize: 11, fontFamily: 'JetBrains Mono, monospace', marginBottom: 3, color: trend > 0 ? '#C9A84C' : trend < 0 ? '#C4364A' : 'var(--text-muted)' }}>
                  {trend > 0 ? '▲' : trend < 0 ? '▼' : '—'} %{Math.abs(trend)}
                </span>
              )}
            </div>
            <p style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: 6 }}>{sub}</p>
          </div>
        ))}
      </div>

      {/* Öneriler */}
      {oneriler.length > 0 && (
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, padding: '20px 24px', marginBottom: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Lightbulb size={14} color="#C9A84C" strokeWidth={1.5} />
            <span style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 20, color: 'var(--text-primary)' }}>Öneriler</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {oneriler.map((o, i) => (
              <a key={i} href={o.href} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8, border: `1px solid ${o.renk === 'ruby' ? 'rgba(139,38,53,0.3)' : o.renk === 'gold' ? 'rgba(201,168,76,0.2)' : 'rgba(58,55,48,0.3)'}`, background: o.renk === 'ruby' ? 'rgba(139,38,53,0.08)' : o.renk === 'gold' ? 'rgba(139,105,20,0.08)' : 'rgba(31,29,23,0.5)', textDecoration: 'none', transition: 'opacity 0.2s' }}>
                <span style={{ color: o.renk === 'ruby' ? '#C4364A' : o.renk === 'gold' ? '#C9A84C' : 'var(--text-muted)', fontSize: 12 }}>{o.icon}</span>
                <span style={{ fontSize: 13, color: o.renk === 'ruby' ? '#C4364A' : o.renk === 'gold' ? '#E8D5A3' : 'var(--text-muted)', flex: 1 }}>{o.mesaj}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Grafikler */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16, marginBottom: 20 }} className="lg:grid-cols-3">
        <div style={{ gridColumn: 'span 2', background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, padding: '24px 28px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 400, color: 'var(--text-primary)' }}>Son 24 Saat</h2>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', display: 'flex', alignItems: 'center', gap: 6 }}>
              <TrendingUp size={11} /> saatlik trafik
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={stats!.son24Saat} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
              <XAxis dataKey="saat" tick={{ fontSize: 9, fill: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }} axisLine={false} tickLine={false} interval={3} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
              <Tooltip cursor={{ fill: 'rgba(139,105,20,0.05)' }} contentStyle={{ background: 'var(--bg-card2)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 8, fontSize: 11, color: 'var(--text-body)' }} />
              <Bar dataKey="sayi" radius={[3,3,0,0]}>
                {stats!.son24Saat.map((e,i) => <Cell key={i} fill={e.sayi === Math.max(...stats!.son24Saat.map(h=>h.sayi)) && e.sayi > 0 ? '#C9A84C' : '#2E2B25'} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, padding: '24px 28px' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 400, color: 'var(--text-primary)', marginBottom: 24 }}>Niyet Dağılımı</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {stats!.intentDagilimi.slice(0,6).map(item => {
              const total = stats!.intentDagilimi.reduce((a,b) => a+b.count, 0)
              const pct = total ? Math.round((item.count/total)*100) : 0
              return (
                <div key={item.intent}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{INTENT_LABEL[item.intent] || item.intent}</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>{item.count}</span>
                  </div>
                  <div style={{ height: 2, background: 'var(--bg-card2)', borderRadius: 1 }}>
                    <div style={{ height: '100%', borderRadius: 1, background: 'linear-gradient(90deg, #C9A84C, #8B6914)', width: `${pct}%`, transition: 'width 0.8s ease' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Alt: Sadık müşteriler + Son konuşmalar */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }} className="lg:grid-cols-3">
        <div style={{ background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(201,168,76,0.08)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Star size={13} color="#C9A84C" strokeWidth={1.5} />
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: 'var(--text-primary)' }}>En Sadık Müşteriler</h2>
          </div>
          <div>
            {sadikMusteriler.map((s, i) => (
              <div key={s.phone} style={{ padding: '12px 20px', borderBottom: '1px solid rgba(201,168,76,0.05)', display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0, background: i === 0 ? 'linear-gradient(135deg, #C9A84C, #8B6914)' : 'var(--bg-card2)', color: i === 0 ? 'var(--bg-base)' : 'var(--text-muted)', border: i === 0 ? 'none' : '1px solid rgba(201,168,76,0.1)' }}>{i+1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-body)' }}>{s.phone}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', marginTop: 2 }}>
                    {formatDistanceToNow(new Date(s.ilkGorulme), { addSuffix: true, locale: tr })}
                  </div>
                </div>
                {s.kvkk && <span style={{ fontSize: 10, color: '#C9A84C', fontFamily: 'JetBrains Mono, monospace' }}>✓</span>}
              </div>
            ))}
            {sadikMusteriler.length === 0 && <div style={{ padding: '32px 20px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>henüz veri yok</div>}
          </div>
        </div>

        <div style={{ gridColumn: 'span 2', background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(201,168,76,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: 'var(--text-primary)' }}>Son Konuşmalar</h2>
            <a href="/konusmalar" style={{ fontSize: 11, color: '#C9A84C', textDecoration: 'none' }}>Hepsini Gör →</a>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', minWidth: 400, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'rgba(201,168,76,0.03)' }}>
                  {['Müşteri','Son Mesaj','Niyet','Durum','Zaman'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.phone} style={{ borderTop: '1px solid rgba(201,168,76,0.05)', cursor: 'pointer' }} onClick={() => router.push('/konusmalar')}>
                    <td style={{ padding: '12px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: 'var(--text-body)' }}>{s.phone}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--text-muted)', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.musteri_yazdigi || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 4, fontSize: 10, color: '#C9A84C', background: 'rgba(139,105,20,0.08)', border: '1px solid rgba(201,168,76,0.12)' }}>
                        {INTENT_LABEL[s.last_intent||'other'] || 'Diğer'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      {s.bulundugu_menu === 'canli'
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#C4364A' }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C4364A', display: 'inline-block' }} />Canlı</span>
                        : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Bot</span>}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 10, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace', whiteSpace: 'nowrap' }}>
                      {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true, locale: tr })}
                    </td>
                  </tr>
                ))}
                {sessions.length === 0 && <tr><td colSpan={5} style={{ padding: '32px', textAlign: 'center', fontSize: 11, color: 'var(--text-muted)', fontFamily: 'JetBrains Mono, monospace' }}>henüz konuşma yok</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
