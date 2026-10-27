'use client'

import { getSessions } from '@/lib/sessionsApi'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Session } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import StatCard from '@/components/StatCard'
import { MessagesSquare, Users, Headphones, CheckCircle2, TrendingUp, Star, Lightbulb, ArrowRight } from 'lucide-react'
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, Cell } from 'recharts'
import { formatDistanceToNow, format, startOfDay, subDays, startOfWeek } from 'date-fns'
import { tr } from 'date-fns/locale'

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

function FiyatKart({ label, d, sym, small, usdRate }: { label: string; d: any; sym: string; small?: boolean; usdRate?: number }) {
  if (!d) return null
  const alis = d.alis ?? d
  const satis = d.satis
  const degisim = d.degisim
  const fmtUSD = (n: number | null, rate?: number) => {
    if (n == null) return '—'
    if (rate) return '$' + (n / rate).toLocaleString('en-US', { maximumFractionDigits: 2 })
    return '$' + n.toLocaleString('en-US', { maximumFractionDigits: n < 10 ? 4 : 2 })
  }
  return (
    <div className="card" style={{ padding: small ? '10px 14px' : '14px 18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span className="kpi-label" style={{ marginBottom: 0 }}>{label}</span>
        <span style={{ color: 'var(--ac)', fontSize: small ? 12 : 14 }}>{sym}</span>
      </div>
      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: small ? 17 : 22, fontWeight: 700, color: 'var(--tx)', lineHeight: 1 }}>
        {fmtUSD(alis, usdRate)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, minHeight: 14 }}>
        <span style={{ fontSize: 10.5, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace' }}>
          {satis != null && !small ? `satış ${fmtUSD(satis, usdRate)}` : ''}
        </span>
        {degisim != null && !isNaN(degisim) && (
          <span style={{ fontSize: 10.5, fontFamily: 'JetBrains Mono, monospace', color: degisim >= 0 ? 'var(--green)' : 'var(--red)' }}>
            {degisim >= 0 ? '▲' : '▼'} %{Math.abs(degisim).toFixed(2)}
          </span>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [sessions, setSessions] = useState<Session[]>([])
  const [sadikMusteriler, setSadikMusteriler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fiyatlar, setFiyatlar] = useState<any>(null)
  const router = useRouter()

  // Klavye kısayolları: g+d, g+c, g+k, g+r, g+m, g+l
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

  // 30 dk hareketsizlikte oturumu kapat
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
    const { data: all } = await getSessions('limit=500')
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
    const canli = list.filter(s => s.last_intent === 'human_handover' || (s as any).bulundugu_menu === 'canli').length
    const kvkkOnayli = list.filter(s => s.kvkk_onay === true).length
    const kvkkOranı = list.length ? Math.round((kvkkOnayli / list.length) * 100) : 0

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

    const sadik = [...list]
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(0, 5)
      .map(s => ({ phone: s.phone, ilkGorulme: s.updated_at, intent: s.last_intent, kvkk: s.kvkk_onay }))
    setSadikMusteriler(sadik)

    setStats({ toplam: list.length, bugun, dun, canli, kvkkOnayli, kvkkOranı, son24Saat: Object.entries(buckets).map(([saat, sayi]) => ({ saat, sayi })), intentDagilimi, buHafta, gecenHafta, yeniMusteri, tekrar })
    setSessions(list.slice(0, 6))
    setLoading(false)

    try {
      const fRes = await fetch('/api/fiyat')
      const fData = await fRes.json()
      if (!fData.hata) setFiyatlar(fData)
    } catch {}
  }, [])

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

  if (loading) return (
    <>
      <TopBar title="Genel Bakış" />
      <div style={{ padding: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
          {[1, 2, 3, 4].map(i => <div key={i} className="kpi anim-pulse" style={{ height: 110 }} />)}
        </div>
      </div>
    </>
  )

  const s = stats!
  const trendBugun = s.dun > 0 ? Math.round(((s.bugun - s.dun) / s.dun) * 100) : null
  const haftaTrend = s.gecenHafta > 0 ? Math.round(((s.buHafta - s.gecenHafta) / s.gecenHafta) * 100) : null
  const maxSaat = Math.max(...s.son24Saat.map(h => h.sayi))
  const intentTotal = s.intentDagilimi.reduce((a, b) => a + b.count, 0)

  const oneriler: { mesaj: string; href: string; tone: 'red' | 'amber' | 'green' }[] = []
  if (s.canli > 0) oneriler.push({ mesaj: `${s.canli} müşteri canlı destek bekliyor`, href: '/canli-destek', tone: 'red' })
  if (s.kvkkOranı < 50) oneriler.push({ mesaj: `KVKK onay oranı düşük (%${s.kvkkOranı}) — bot akışını kontrol et`, href: '/raporlar', tone: 'amber' })
  if (haftaTrend !== null && haftaTrend < -20) oneriler.push({ mesaj: `Bu hafta trafik %${Math.abs(haftaTrend)} düştü`, href: '/raporlar', tone: 'amber' })
  if (s.yeniMusteri > 5) oneriler.push({ mesaj: `Bu hafta ${s.yeniMusteri} yeni müşteri`, href: '/konusmalar', tone: 'green' })

  const usd = fiyatlar?.doviz?.usd?.alis

  return (
    <>
      <TopBar title="Genel Bakış" subtitle={format(new Date(), 'd MMMM yyyy, EEEE', { locale: tr })} />
      <div style={{ padding: 22, maxWidth: 1360, width: '100%', margin: '0 auto' }}>

        {s.canli > 0 && (
          <div className="anim-up" style={{ marginBottom: 18, padding: '12px 18px', background: 'var(--red2)', border: '1px solid rgba(242,87,87,.25)', borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="anim-pulse" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
              <span style={{ color: 'var(--red)', fontWeight: 600, fontSize: 13 }}>{s.canli} müşteri canlı destek bekliyor</span>
            </div>
            <a href="/canli-destek" className="btn" style={{ background: 'var(--red)', boxShadow: 'none', padding: '5px 12px', fontSize: 12 }}>Görüntüle <ArrowRight size={12} /></a>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: 14, marginBottom: 14 }}>
          <StatCard label="Toplam Müşteri" value={s.toplam} sub={`${s.bugun} bugün`} Icon={Users} accent="var(--ac)" />
          <StatCard label="Bugün Aktif" value={s.bugun} sub={trendBugun !== null ? `${trendBugun > 0 ? '+' : ''}${trendBugun}% dünden` : '—'} Icon={MessagesSquare} accent="var(--blue)" />
          <StatCard label="Canlı Destek" value={s.canli} sub={s.canli > 0 ? 'bekliyor' : 'kuyruk boş'} Icon={Headphones} accent={s.canli > 0 ? 'var(--red)' : 'var(--green)'} pulse={s.canli > 0} onClick={() => router.push('/canli-destek')} />
          <StatCard label="KVKK Onay" value={`%${s.kvkkOranı}`} sub={`${s.kvkkOnayli} onaylı`} Icon={CheckCircle2} accent="var(--green)" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 14 }}>
          {[
            { label: 'Bu Hafta', value: s.buHafta, sub: haftaTrend !== null ? `${haftaTrend > 0 ? '+' : ''}${haftaTrend}% geçen hafta` : 'ilk hafta', trend: haftaTrend },
            { label: 'Geçen Hafta', value: s.gecenHafta, sub: 'karşılaştırma', trend: null },
            { label: 'Yeni Müşteri', value: s.yeniMusteri, sub: 'bu hafta ilk kez', trend: null },
            { label: 'Tekrar Yazan', value: s.tekrar, sub: 'geri dönen', trend: null },
          ].map(({ label, value, sub, trend }) => (
            <div key={label} className="card" style={{ padding: '14px 18px' }}>
              <p className="kpi-label">{label}</p>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 26, fontWeight: 700, color: 'var(--tx)', lineHeight: 1 }}>{value}</span>
                {trend !== null && (
                  <span className={`badge ${trend >= 0 ? 'badge-green' : 'badge-red'}`}>{trend >= 0 ? '▲' : '▼'} %{Math.abs(trend)}</span>
                )}
              </div>
              <p className="kpi-sub">{sub}</p>
            </div>
          ))}
        </div>

        {oneriler.length > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-h">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Lightbulb size={14} style={{ color: 'var(--amber)' }} /> Öneriler</span>
            </div>
            {oneriler.map((o, i) => (
              <a key={i} href={o.href} className="row" style={{ cursor: 'pointer' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: `var(--${o.tone})`, flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: 13, color: 'var(--tx)' }}>{o.mesaj}</span>
                <ArrowRight size={13} style={{ color: 'var(--tx3)' }} />
              </a>
            ))}
          </div>
        )}

        {fiyatlar && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div className="card-h"><span className="card-title">Piyasa Fiyatları</span><span className="card-meta">USD karşılığı</span></div>
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
                <FiyatKart label="Gram Altın" d={fiyatlar.altin?.gram} sym="✦" usdRate={usd} />
                <FiyatKart label="14 Ayar" d={fiyatlar.altin?.ayar14} sym="✦" usdRate={usd} />
                <FiyatKart label="Çeyrek" d={fiyatlar.altin?.ceyrek} sym="✦" usdRate={usd} />
                <FiyatKart label="Yarım" d={fiyatlar.altin?.yarim} sym="✦" usdRate={usd} />
                <FiyatKart label="Tam" d={fiyatlar.altin?.tam} sym="✦" usdRate={usd} />
                <FiyatKart label="Gümüş (gr)" d={fiyatlar.gumus} sym="◆" usdRate={usd} />
                <FiyatKart label="Platin (gr)" d={fiyatlar.platin} sym="◈" usdRate={usd} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10 }}>
                <FiyatKart label="USD" d={fiyatlar.doviz?.usd} sym="$" small />
                <FiyatKart label="EUR" d={fiyatlar.doviz?.eur} sym="€" small />
                <FiyatKart label="GBP" d={fiyatlar.doviz?.gbp} sym="£" small />
                <FiyatKart label="RUB" d={fiyatlar.doviz?.rub} sym="₽" small />
                <FiyatKart label="SAR" d={fiyatlar.doviz?.sar} sym="﷼" small />
                <FiyatKart label="AED" d={fiyatlar.doviz?.aed} sym="د" small />
              </div>
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14, marginBottom: 14 }}>
          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-h">
              <span className="card-title">Son 24 Saat</span>
              <span className="card-meta" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><TrendingUp size={11} /> saatlik trafik</span>
            </div>
            <div style={{ padding: '18px 14px 10px' }}>
              <ResponsiveContainer width="100%" height={190}>
                <BarChart data={s.son24Saat} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                  <XAxis dataKey="saat" tick={{ fontSize: 9.5, fill: 'var(--tx3)' }} axisLine={false} tickLine={false} interval={3} />
                  <YAxis tick={{ fontSize: 9.5, fill: 'var(--tx3)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip cursor={{ fill: 'var(--ac3)' }} contentStyle={{ background: 'var(--s2)', border: '1px solid var(--bdr2)', borderRadius: 8, fontSize: 12, color: 'var(--tx)' }} />
                  <Bar dataKey="sayi" radius={[4, 4, 0, 0]}>
                    {s.son24Saat.map((e, i) => <Cell key={i} fill={e.sayi === maxSaat && e.sayi > 0 ? 'var(--ac)' : 'var(--s4)'} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-h"><span className="card-title">Niyet Dağılımı</span></div>
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 13 }}>
              {s.intentDagilimi.slice(0, 6).map(item => {
                const pct = intentTotal ? Math.round((item.count / intentTotal) * 100) : 0
                return (
                  <div key={item.intent}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 12.5, color: 'var(--tx2)' }}>{INTENT_LABEL[item.intent] || item.intent}</span>
                      <span style={{ fontSize: 12, color: 'var(--tx)', fontFamily: 'JetBrains Mono, monospace' }}>{item.count}</span>
                    </div>
                    <div className="prog"><div className="prog-fill" style={{ width: `${pct}%`, background: 'linear-gradient(90deg,var(--ac),#5b4de0)' }} /></div>
                  </div>
                )
              })}
              {s.intentDagilimi.length === 0 && <p style={{ fontSize: 12.5, color: 'var(--tx3)', textAlign: 'center' }}>henüz veri yok</p>}
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(320px,1fr))', gap: 14 }}>
          <div className="card">
            <div className="card-h">
              <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Star size={13} style={{ color: 'var(--amber)' }} /> En Sadık Müşteriler</span>
            </div>
            {sadikMusteriler.map((m, i) => (
              <div key={m.phone} className="row">
                <div style={{ width: 26, height: 26, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, background: i === 0 ? 'linear-gradient(135deg,var(--ac),#5b4de0)' : 'var(--s3)', color: i === 0 ? '#fff' : 'var(--tx2)' }}>{i + 1}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--tx)' }}>{m.phone}</div>
                  <div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 2 }}>{formatDistanceToNow(new Date(m.ilkGorulme), { addSuffix: true, locale: tr })}</div>
                </div>
                {m.kvkk && <span className="badge badge-green">KVKK</span>}
              </div>
            ))}
            {sadikMusteriler.length === 0 && <p style={{ padding: 28, textAlign: 'center', fontSize: 12.5, color: 'var(--tx3)' }}>henüz veri yok</p>}
          </div>

          <div className="card" style={{ gridColumn: 'span 2' }}>
            <div className="card-h">
              <span className="card-title">Son Konuşmalar</span>
              <a href="/konusmalar" style={{ fontSize: 12, color: 'var(--ac)', fontWeight: 600 }}>Hepsini gör →</a>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 460, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Müşteri', 'Son Mesaj', 'Niyet', 'Durum', 'Zaman'].map(h => (
                      <th key={h} className="kpi-label" style={{ padding: '10px 16px', textAlign: 'left', marginBottom: 0, borderBottom: '1px solid var(--bdr)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map(x => (
                    <tr key={x.phone} className="row" style={{ display: 'table-row', cursor: 'pointer' }} onClick={() => router.push('/konusmalar')}>
                      <td style={{ padding: '11px 16px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--tx)', borderBottom: '1px solid var(--bdr)' }}>{x.phone}</td>
                      <td style={{ padding: '11px 16px', fontSize: 12.5, color: 'var(--tx2)', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid var(--bdr)' }}>{x.musteri_yazdigi || '—'}</td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--bdr)' }}><span className="badge badge-ac">{INTENT_LABEL[x.last_intent || 'other'] || 'Diğer'}</span></td>
                      <td style={{ padding: '11px 16px', borderBottom: '1px solid var(--bdr)' }}>
                        {(x as any).bulundugu_menu === 'canli'
                          ? <span className="badge badge-red">Canlı</span>
                          : <span className="badge badge-muted">Bot</span>}
                      </td>
                      <td style={{ padding: '11px 16px', fontSize: 11.5, color: 'var(--tx3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--bdr)' }}>
                        {formatDistanceToNow(new Date(x.updated_at), { addSuffix: true, locale: tr })}
                      </td>
                    </tr>
                  ))}
                  {sessions.length === 0 && <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', fontSize: 12.5, color: 'var(--tx3)' }}>henüz konuşma yok</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
