'use client'

import { useEffect, useState } from 'react'
import { supabase, Session } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import StatCard from '@/components/StatCard'
import ConfirmModal from '@/components/ConfirmModal'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis } from 'recharts'
import { RefreshCw, Bot, Headphones, AlertTriangle, Clock, Tag, Plus, X, Trash2, Search } from 'lucide-react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

const INTENT_LABEL: Record<string, string> = {
  greeting: 'Selamlama', products: 'Ürün Listesi', product_detail: 'Ürün Detay',
  order_status: 'Sipariş Durumu', order_create: 'Sipariş Oluştur', subscription: 'Abonelik',
  human_handover: 'Canlı Destek', complaint: 'Şikayet', brand_info: 'Marka Bilgi',
  usage_question: 'Kullanım Sorusu', menu: 'Menü', smalltalk: 'Sohbet', other: 'Diğer',
}
const ETIKET_RENKLER = ['#7c6af7', '#22d3a0', '#f0a843', '#4ea8f0', '#f25757', '#e879f9', '#94a3b8', '#fb923c']
const tooltipStyle = { background: 'var(--s2)', border: '1px solid var(--bdr2)', borderRadius: 8, fontSize: 12, color: 'var(--tx)' }

const EMPTY_RAKIP = { show: false, rakip_adi: '', urun: '', fiyat: '', birim: 'TL', kaynak: 'manuel' }
const EMPTY_ETIKET = { show: false, telefon: '', etiket: '', renk: '#7c6af7' }

export default function RaporlarPage() {
  const [sessions, setSessions] = useState<any[]>([])
  const [slaLoglar, setSlaLoglar] = useState<any[]>([])
  const [rakipler, setRakipler] = useState<any[]>([])
  const [etiketler, setEtiketler] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'bot' | 'sla' | 'etiket' | 'rakip'>('bot')
  const [rakipForm, setRakipForm] = useState(EMPTY_RAKIP)
  const [etiketForm, setEtiketForm] = useState(EMPTY_ETIKET)
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

  // Bot metrikleri
  const toplamKonusma = sessions.length
  const botCozdu = sessions.filter(s => s.last_intent !== 'human_handover' && s.bulundugu_menu !== 'canli').length
  const canliDusdu = sessions.filter(s => s.last_intent === 'human_handover' || s.bulundugu_menu === 'canli').length
  const botBasariOrani = toplamKonusma > 0 ? Math.round((botCozdu / toplamKonusma) * 100) : 0
  const intentMap: Record<string, number> = {}
  sessions.forEach((s: any) => { const i = s.last_intent || 'other'; intentMap[i] = (intentMap[i] || 0) + 1 })
  const intentData = Object.entries(intentMap).sort((a, b) => b[1] - a[1]).map(([intent, count]) => ({ intent, name: INTENT_LABEL[intent] || intent, count }))
  const intentTotal = intentData.reduce((a, b) => a + b.count, 0)
  const sorunluIntentler = intentData.filter(i => i.intent === 'human_handover' || i.intent === 'complaint')
  const saatMap: Record<string, number> = {}
  for (let i = 0; i < 24; i++) saatMap[String(i).padStart(2, '0')] = 0
  sessions.forEach(s => { const h = String(new Date(s.updated_at).getHours()).padStart(2, '0'); if (saatMap[h] !== undefined) saatMap[h]++ })
  const saatData = Object.entries(saatMap).map(([saat, sayi]) => ({ saat: `${saat}:00`, sayi }))
  const maxSaat = Math.max(...saatData.map(s => s.sayi))
  const enYogunSaat = saatData.find(s => s.sayi === maxSaat)

  // SLA metrikleri
  const yanitli = slaLoglar.filter(l => l.yanit_suresi_dk)
  const cozumlu = slaLoglar.filter(l => l.cozum_suresi_dk)
  const ortYanitSuresi = yanitli.length ? yanitli.reduce((s, l) => s + l.yanit_suresi_dk, 0) / yanitli.length : 0
  const ortCozumSuresi = cozumlu.length ? cozumlu.reduce((s, l) => s + l.cozum_suresi_dk, 0) / cozumlu.length : 0
  const acikTalepler = slaLoglar.filter(l => l.durum === 'acik').length
  const slaIhlal = slaLoglar.filter(l => l.yanit_suresi_dk > 10).length

  // Etiket analizi
  const etiketMap: Record<string, number> = {}
  etiketler.forEach(e => { etiketMap[e.etiket] = (etiketMap[e.etiket] || 0) + 1 })
  const etiketData = Object.entries(etiketMap).sort((a, b) => b[1] - a[1]).map(([etiket, count]) => ({ etiket, count }))

  async function rakipEkle() {
    if (!rakipForm.rakip_adi || !rakipForm.fiyat) return
    const { show, ...data } = rakipForm
    await fetch('/api/rakip', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, fiyat: parseFloat(data.fiyat) }) })
    setRakipForm(EMPTY_RAKIP)
    load()
  }
  async function rakipSil(id: number) {
    await fetch(`/api/rakip?id=${id}`, { method: 'DELETE' })
    load()
  }
  async function etiketEkle() {
    if (!etiketForm.telefon || !etiketForm.etiket) return
    const { show, ...data } = etiketForm
    await fetch('/api/etiket', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    setEtiketForm(EMPTY_ETIKET)
    load()
  }
  async function etiketSil(id: number) {
    await fetch(`/api/etiket?id=${id}`, { method: 'DELETE' })
    setSilinecekEtiket(null)
    load()
  }

  const tabs = [
    { v: 'bot', l: 'Bot Metrikleri' }, { v: 'sla', l: 'SLA Takibi' },
    { v: 'etiket', l: 'Etiketler' }, { v: 'rakip', l: 'Rakip Analizi' },
  ] as const

  const empty = (Icon: any, title: string, sub?: string) => (
    <div style={{ padding: 48, textAlign: 'center' }}>
      <Icon size={30} style={{ color: 'var(--tx3)', opacity: .5, margin: '0 auto 10px', display: 'block' }} strokeWidth={1.4} />
      <p style={{ fontSize: 13, color: 'var(--tx2)' }}>{title}</p>
      {sub && <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 4 }}>{sub}</p>}
    </div>
  )

  const th = (h: string) => <th key={h} className="kpi-label" style={{ padding: '12px 18px', textAlign: 'left', marginBottom: 0, borderBottom: '1px solid var(--bdr)' }}>{h}</th>

  return (
    <>
      <TopBar title="Raporlar" subtitle="analiz & takip" action={<button className="btn-ghost" onClick={load} title="Yenile" style={{ padding: 8 }}><RefreshCw size={14} /></button>} />

      <div className="tabs" style={{ paddingLeft: 12, overflowX: 'auto' }}>
        {tabs.map(t => <button key={t.v} className={`tab${tab === t.v ? ' active' : ''}`} onClick={() => setTab(t.v)}>{t.l}</button>)}
      </div>

      <div style={{ padding: 22, maxWidth: 1360, width: '100%', margin: '0 auto' }}>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14, marginBottom: 16 }}>
          <StatCard label="Bot Başarı" value={`%${botBasariOrani}`} sub={`${botCozdu} konuşma çözüldü`} Icon={Bot} accent="var(--green)" />
          <StatCard label="Canlı Destek" value={canliDusdu} sub="canlıya düştü" Icon={Headphones} accent={canliDusdu > 5 ? 'var(--red)' : 'var(--ac)'} />
          <StatCard label="Ort. Yanıt" value={ortYanitSuresi > 0 ? `${Math.round(ortYanitSuresi)} dk` : '—'} sub="canlı destek yanıt" Icon={Clock} accent="var(--blue)" />
          <StatCard label="En Yoğun Saat" value={enYogunSaat?.saat || '—'} sub={`${maxSaat} mesaj`} Icon={Clock} accent="var(--amber)" />
        </div>

        {loading && <div className="card anim-pulse" style={{ height: 120 }} />}

        {/* BOT */}
        {!loading && tab === 'bot' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {sorunluIntentler.length > 0 && (
              <div style={{ background: 'var(--red2)', border: '1px solid rgba(242,87,87,.25)', borderRadius: 12, padding: '12px 16px', display: 'flex', gap: 12 }}>
                <AlertTriangle size={16} style={{ color: 'var(--red)', flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', marginBottom: 3 }}>Bot Sorun Noktaları</p>
                  {sorunluIntentler.map(i => <p key={i.intent} style={{ fontSize: 12.5, color: 'var(--tx2)' }}>{i.name}: {i.count} kez → canlı desteğe düştü</p>)}
                </div>
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14 }}>
              <div className="card">
                <div className="card-h"><span className="card-title">Niyet Dağılımı</span></div>
                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 13 }}>
                  {intentData.slice(0, 8).map(d => {
                    const pct = intentTotal ? Math.round(d.count / intentTotal * 100) : 0
                    const bad = d.intent === 'human_handover' || d.intent === 'complaint'
                    return (
                      <div key={d.intent}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <span style={{ fontSize: 12.5, color: bad ? 'var(--red)' : 'var(--tx2)', display: 'flex', alignItems: 'center', gap: 5 }}>{bad && <AlertTriangle size={11} />}{d.name}</span>
                          <span style={{ fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--tx)' }}>{d.count} · %{pct}</span>
                        </div>
                        <div className="prog"><div className="prog-fill" style={{ width: `${pct}%`, background: bad ? 'var(--red)' : 'linear-gradient(90deg,var(--ac),#5b4de0)' }} /></div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="card">
                <div className="card-h"><span className="card-title">Saatlik Yoğunluk</span></div>
                <div style={{ padding: '18px 14px 10px' }}>
                  <ResponsiveContainer width="100%" height={210}>
                    <BarChart data={saatData} margin={{ top: 4, right: 4, bottom: 4, left: -25 }}>
                      <XAxis dataKey="saat" tick={{ fontSize: 9.5, fill: 'var(--tx3)' }} axisLine={false} tickLine={false} interval={3} />
                      <YAxis tick={{ fontSize: 9.5, fill: 'var(--tx3)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'var(--ac3)' }} contentStyle={tooltipStyle} formatter={(v: any) => [`${v} mesaj`, '']} />
                      <Bar dataKey="sayi" radius={[4, 4, 0, 0]}>
                        {saatData.map((e, i) => <Cell key={i} fill={e.sayi === maxSaat && maxSaat > 0 ? 'var(--ac)' : 'var(--s4)'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
              <div className="card">
                <div className="card-h"><span className="card-title">Bot vs Canlı</span></div>
                <div style={{ padding: 14 }}>
                  <ResponsiveContainer width="100%" height={150}>
                    <PieChart>
                      <Pie data={[{ name: 'Bot', value: botCozdu }, { name: 'Canlı', value: canliDusdu }]} cx="50%" cy="50%" innerRadius={38} outerRadius={60} dataKey="value" stroke="none">
                        <Cell fill="#22d3a0" /><Cell fill="#f25757" />
                      </Pie>
                      <Tooltip contentStyle={tooltipStyle} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 18, fontSize: 12, color: 'var(--tx2)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#22d3a0' }} />Bot %{botBasariOrani}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: '#f25757' }} />Canlı %{100 - botBasariOrani}</span>
                  </div>
                </div>
              </div>

              <div className="card" style={{ gridColumn: 'span 1' }}>
                <div className="card-h"><span className="card-title">Bot Performans Özeti</span></div>
                {[
                  { label: 'Toplam Konuşma', value: toplamKonusma },
                  { label: 'Bot Çözdü', value: `${botCozdu} (%${botBasariOrani})` },
                  { label: 'Canlıya Düştü', value: `${canliDusdu} (%${100 - botBasariOrani})` },
                  { label: 'En Sorunlu Niyet', value: sorunluIntentler[0] ? `${sorunluIntentler[0].name} (${sorunluIntentler[0].count}x)` : '—' },
                  { label: 'En Yoğun Saat', value: enYogunSaat ? `${enYogunSaat.saat} (${maxSaat} mesaj)` : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="row" style={{ justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 12.5, color: 'var(--tx3)' }}>{label}</span>
                    <span style={{ fontSize: 12.5, fontWeight: 600, fontFamily: 'JetBrains Mono, monospace', color: 'var(--tx)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* SLA */}
        {!loading && tab === 'sla' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
              <StatCard label="Ort. Yanıt" value={ortYanitSuresi > 0 ? `${Math.round(ortYanitSuresi)} dk` : '—'} sub="hedef: <5 dk" accent={ortYanitSuresi > 10 ? 'var(--red)' : 'var(--green)'} />
              <StatCard label="Ort. Çözüm" value={ortCozumSuresi > 0 ? `${Math.round(ortCozumSuresi)} dk` : '—'} sub="hedef: <30 dk" accent="var(--blue)" />
              <StatCard label="Açık Talepler" value={acikTalepler} sub="henüz kapanmadı" accent={acikTalepler > 3 ? 'var(--red)' : 'var(--ac)'} />
              <StatCard label="SLA İhlali" value={slaIhlal} sub=">10 dk yanıt" accent={slaIhlal > 0 ? 'var(--red)' : 'var(--green)'} />
            </div>

            <div className="card">
              <div className="card-h"><div><span className="card-title">Canlı Destek Logları</span><p className="card-meta" style={{ marginTop: 2 }}>Her canlı destek görüşmesinin süresi</p></div></div>
              {slaLoglar.length === 0 ? empty(Clock, 'Henüz SLA kaydı yok', 'Canlı destek görüşmeleri burada takip edilecek') : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
                    <thead><tr>{['Telefon', 'Başlangıç', 'İlk Yanıt', 'Çözüm', 'Yanıt Süresi', 'Durum'].map(th)}</tr></thead>
                    <tbody>
                      {slaLoglar.map(l => (
                        <tr key={l.id} className="row" style={{ display: 'table-row' }}>
                          <td style={{ padding: '12px 18px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, borderBottom: '1px solid var(--bdr)' }}>{l.telefon}</td>
                          <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--tx3)', borderBottom: '1px solid var(--bdr)' }}>{format(new Date(l.baslangic), 'd MMM HH:mm', { locale: tr })}</td>
                          <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--tx3)', borderBottom: '1px solid var(--bdr)' }}>{l.ilk_yanit ? format(new Date(l.ilk_yanit), 'HH:mm') : '—'}</td>
                          <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--tx3)', borderBottom: '1px solid var(--bdr)' }}>{l.kapanis ? format(new Date(l.kapanis), 'HH:mm') : '—'}</td>
                          <td style={{ padding: '12px 18px', fontSize: 12.5, fontWeight: 600, color: l.yanit_suresi_dk > 10 ? 'var(--red)' : 'var(--green)', borderBottom: '1px solid var(--bdr)' }}>{l.yanit_suresi_dk ? `${l.yanit_suresi_dk} dk` : '—'}</td>
                          <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--bdr)' }}><span className={`badge ${l.durum === 'kapali' ? 'badge-green' : 'badge-red'}`}>{l.durum === 'kapali' ? '✓ Kapandı' : '● Açık'}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ETİKET */}
        {!loading && tab === 'etiket' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)' }}>Müşteri Etiketleri</h2>
                <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>{etiketler.length} etiket · {Object.keys(etiketMap).length} farklı tür</p>
              </div>
              <button className="btn" onClick={() => setEtiketForm(f => ({ ...f, show: true }))}><Plus size={14} /> Etiket Ekle</button>
            </div>

            {etiketData.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
                {etiketData.slice(0, 8).map((e, i) => {
                  const c = ETIKET_RENKLER[i % ETIKET_RENKLER.length]
                  return (
                    <div key={e.etiket} className="card" style={{ padding: 14 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: `${c}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 9 }}><Tag size={15} style={{ color: c }} /></div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{e.etiket}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 2 }}>{e.count} müşteri</div>
                    </div>
                  )
                })}
              </div>
            )}

            <div className="card">
              <div className="card-h"><span className="card-title">Tüm Etiketler</span></div>
              {etiketler.length === 0 ? empty(Tag, 'Henüz etiket yok', '“VIP”, “alerjisi var”, “kapıda ödeme” gibi etiketler ekle') :
                etiketler.map(e => (
                  <div key={e.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <span style={{ width: 10, height: 10, borderRadius: '50%', background: e.renk }} />
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{e.etiket}</span>
                      <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: 'var(--tx3)' }}>{e.telefon}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{format(new Date(e.created_at), 'd MMM', { locale: tr })}</span>
                      <button onClick={() => setSilinecekEtiket(e.id)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* RAKİP */}
        {!loading && tab === 'rakip' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--tx)' }}>Rakip Fiyat Takibi</h2>
                <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 2 }}>{rakipler.length} kayıt</p>
              </div>
              <button className="btn" onClick={() => setRakipForm(f => ({ ...f, show: true }))}><Plus size={14} /> Rakip Ekle</button>
            </div>

            <div className="card">
              {rakipler.length === 0 ? empty(Search, 'Henüz rakip fiyatı yok', 'Rakip fiyatlarını ekleyerek takip et') : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', minWidth: 560, borderCollapse: 'collapse' }}>
                    <thead><tr>{['Rakip', 'Ürün', 'Fiyat', 'Kaynak', 'Tarih', ''].map(th)}</tr></thead>
                    <tbody>
                      {rakipler.map(r => (
                        <tr key={r.id} className="row" style={{ display: 'table-row' }}>
                          <td style={{ padding: '12px 18px', fontSize: 13, fontWeight: 600, borderBottom: '1px solid var(--bdr)' }}>{r.rakip_adi}</td>
                          <td style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--tx2)', borderBottom: '1px solid var(--bdr)' }}>{r.urun || '—'}</td>
                          <td style={{ padding: '12px 18px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, borderBottom: '1px solid var(--bdr)' }}>{r.fiyat} {r.birim}</td>
                          <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--bdr)' }}><span className="badge badge-muted">{r.kaynak || 'manuel'}</span></td>
                          <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--tx3)', borderBottom: '1px solid var(--bdr)' }}>{r.tarih ? format(new Date(r.tarih), 'd MMM yyyy', { locale: tr }) : '—'}</td>
                          <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--bdr)' }}><button onClick={() => rakipSil(r.id)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><Trash2 size={14} /></button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Etiket modal */}
      {etiketForm.show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setEtiketForm(f => ({ ...f, show: false })) }}>
          <div className="modal anim-pop" style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>Etiket Ekle</h2>
              <button onClick={() => setEtiketForm(f => ({ ...f, show: false }))} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 12 }}><label className="label">Telefon</label><input className="inp" value={etiketForm.telefon} onChange={e => setEtiketForm(f => ({ ...f, telefon: e.target.value }))} placeholder="905xx..." style={{ fontFamily: 'JetBrains Mono, monospace' }} /></div>
            <div style={{ marginBottom: 12 }}><label className="label">Etiket</label><input className="inp" value={etiketForm.etiket} onChange={e => setEtiketForm(f => ({ ...f, etiket: e.target.value }))} placeholder="VIP, alerjisi var, kapıda ödeme..." /></div>
            <div style={{ marginBottom: 12 }}>
              <label className="label">Hazır Etiketler</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {['VIP', 'Alerjisi Var', 'Kapıda Ödeme', 'Düzenli Müşteri', 'Şikayetçi', 'Abonelik Riski'].map(t => (
                  <button key={t} onClick={() => setEtiketForm(f => ({ ...f, etiket: t }))} className={etiketForm.etiket === t ? 'badge badge-ac' : 'badge badge-muted'} style={{ border: 'none', cursor: 'pointer', padding: '4px 10px' }}>{t}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 18 }}>
              <label className="label">Renk</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {ETIKET_RENKLER.map(r => (
                  <button key={r} onClick={() => setEtiketForm(f => ({ ...f, renk: r }))} style={{ width: 28, height: 28, borderRadius: 8, background: r, border: 'none', outline: etiketForm.renk === r ? '2px solid var(--tx)' : 'none', outlineOffset: 2 }} />
                ))}
              </div>
            </div>
            <button className="btn" onClick={etiketEkle} style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }}>Kaydet</button>
          </div>
        </div>
      )}

      {/* Rakip modal */}
      {rakipForm.show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setRakipForm(f => ({ ...f, show: false })) }}>
          <div className="modal anim-pop" style={{ maxWidth: 420 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>Rakip Fiyatı Ekle</h2>
              <button onClick={() => setRakipForm(f => ({ ...f, show: false }))} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
            </div>
            <div style={{ marginBottom: 12 }}><label className="label">Rakip *</label><input className="inp" value={rakipForm.rakip_adi} onChange={e => setRakipForm(f => ({ ...f, rakip_adi: e.target.value }))} placeholder="Rakip marka" /></div>
            <div style={{ marginBottom: 12 }}><label className="label">Ürün</label><input className="inp" value={rakipForm.urun} onChange={e => setRakipForm(f => ({ ...f, urun: e.target.value }))} placeholder="Ürün adı" /></div>
            <div className="modal-grid" style={{ marginBottom: 18 }}>
              <div><label className="label">Fiyat *</label><input className="inp" type="number" value={rakipForm.fiyat} onChange={e => setRakipForm(f => ({ ...f, fiyat: e.target.value }))} placeholder="0" /></div>
              <div><label className="label">Birim</label><input className="inp" value={rakipForm.birim} onChange={e => setRakipForm(f => ({ ...f, birim: e.target.value }))} placeholder="TL" /></div>
            </div>
            <button className="btn" onClick={rakipEkle} style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }}>Kaydet</button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={silinecekEtiket !== null}
        title="Etiketi sil"
        message="Bu etiketi silmek istiyor musunuz?"
        onConfirm={() => silinecekEtiket !== null && etiketSil(silinecekEtiket)}
        onCancel={() => setSilinecekEtiket(null)}
      />
    </>
  )
}
