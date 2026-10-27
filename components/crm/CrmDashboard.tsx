'use client'
import { useCallback, useEffect, useState } from 'react'
import { Users, UserPlus, Crown, Target, CheckSquare, CalendarDays, Wrench, TrendingUp, Download } from 'lucide-react'
import StatCard from '@/components/StatCard'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Stats = {
  customers_total: number; customers_new: number; vip_count: number; opps_active: number; opps_pipeline_amount: number
  opps_won: number; opps_won_amount: number; opps_lost: number; conversion_rate: number | null
  tasks_open: number; tasks_overdue: number; appointments_upcoming: number; service_open: number; service_overdue: number
  per_store: { id: string; name: string; customers: number; new: number; vip: number; opps_active: number }[]
  advisors: { id: string; name: string; customers: number; won: number; won_amount: number; tasks_done: number; appointments_done: number }[]
  campaigns: { id: string; name: string; channel: string; status: string; total: number; eligible: number; sent: number; failed: number }[]
}
const RANGES = [['7', 'Son 7 gün'], ['30', 'Son 30 gün'], ['90', 'Son 90 gün'], ['365', 'Son 1 yıl'], ['custom', 'Özel']] as const
const money = (n: number) => `${Number(n).toLocaleString('tr-TR')} ₺`

export default function CrmDashboard() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const [range, setRange] = useState<string>('30')
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [store, setStore] = useState('')
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [s, setS] = useState<Stats | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => { supabase.from('stores').select('id, name').eq('is_active', true).order('name').then(({ data }) => setStores((data || []) as any)) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    let f: Date, t: Date
    if (range === 'custom') { if (!from || !to) return; f = new Date(from); t = new Date(to + 'T23:59:59') }
    else { t = new Date(); f = new Date(Date.now() - parseInt(range) * 86400000) }
    const { data, error } = await supabase.rpc('dashboard_stats', { p_from: f.toISOString(), p_to: t.toISOString(), p_store: store || null })
    if (error) { setErr(error.message); return }
    setErr(''); setS(data as Stats)
  }, [range, from, to, store])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const empty = (t: string) => <div style={{ padding: 22, textAlign: 'center', color: 'var(--tx3)', fontSize: 12.5 }}>{t}</div>
  return (
    <div style={{ padding: 22, maxWidth: 1250, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="inp" style={{ width: 150 }} value={range} onChange={e => setRange(e.target.value)}>{RANGES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        {range === 'custom' && <><input className="inp" style={{ width: 150 }} type="date" value={from} onChange={e => setFrom(e.target.value)} /><input className="inp" style={{ width: 150 }} type="date" value={to} onChange={e => setTo(e.target.value)} /></>}
        {stores.length > 1 && <select className="inp" style={{ width: 180 }} value={store} onChange={e => setStore(e.target.value)}><option value="">Tüm mağazalar</option>{stores.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
        <div style={{ flex: 1 }} />
        {crm.can('reports.export') && s && <a className="btn-ghost" href={`/api/crm/export/report?from=${new Date(range === 'custom' && from ? from : Date.now() - (parseInt(range) || 30) * 86400000).toISOString().slice(0, 10)}&to=${range === 'custom' && to ? to : new Date().toISOString().slice(0, 10)}${store ? `&store=${store}` : ''}`} style={{ textDecoration: 'none' }}><Download size={14} /> Raporu indir (Excel)</a>}
        {crm.can('customers.export') && <a className="btn-ghost" href={`/api/crm/export/customers${store ? `?store=${store}` : ''}`} style={{ textDecoration: 'none' }}><Download size={14} /> Müşteri listesi (Excel)</a>}
      </div>
      {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
      {!s ? <div className="card anim-pulse" style={{ height: 160 }} /> : (<>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 }}>
          <StatCard label="Toplam Müşteri" value={s.customers_total} sub="aktif kayıt" Icon={Users} accent="var(--ac)" />
          <StatCard label="Yeni Müşteri" value={s.customers_new} sub="seçili dönemde" Icon={UserPlus} accent="var(--green)" />
          <StatCard label="VIP Müşteri" value={s.vip_count} sub="toplam" Icon={Crown} accent="var(--amber)" />
          <StatCard label="Aktif Fırsat" value={s.opps_active} sub={money(s.opps_pipeline_amount)} Icon={Target} accent="var(--blue)" />
          <StatCard label="Dönüşüm Oranı" value={s.conversion_rate === null ? '—' : `%${s.conversion_rate}`} sub={`${s.opps_won} kazanılan / ${s.opps_lost} kaybedilen`} Icon={TrendingUp} accent="var(--green)" />
          <StatCard label="Bekleyen Görev" value={s.tasks_open} sub={`${s.tasks_overdue} gecikmiş`} Icon={CheckSquare} accent="var(--amber)" />
          <StatCard label="Yaklaşan Randevu" value={s.appointments_upcoming} sub="önümüzdeki 7 gün" Icon={CalendarDays} accent="var(--ac)" />
          <StatCard label="Açık Servis Talebi" value={s.service_open} sub={`${s.service_overdue} SLA aşımı`} Icon={Wrench} accent="var(--red)" />
        </div>
        <div className="card" style={{ overflowX: 'auto' }}>
          <div className="card-title" style={{ padding: '14px 16px 6px' }}>Mağaza Bazında</div>
          {s.per_store.length === 0 ? empty('Erişilebilir mağaza yok') : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 11.5 }}>{['Mağaza', 'Müşteri', 'Yeni', 'VIP', 'Aktif fırsat'].map(h => <th key={h} style={{ padding: '8px 16px' }}>{h}</th>)}</tr></thead>
              <tbody>{s.per_store.map(x => <tr key={x.id} style={{ borderTop: '1px solid var(--bdr)' }}><td style={{ padding: '9px 16px', color: 'var(--tx)', fontWeight: 600 }}>{x.name}</td><td style={{ padding: '9px 16px' }}>{x.customers}</td><td style={{ padding: '9px 16px' }}>{x.new}</td><td style={{ padding: '9px 16px' }}>{x.vip}</td><td style={{ padding: '9px 16px' }}>{x.opps_active}</td></tr>)}</tbody>
            </table>)}
        </div>
        {crm.can('reports.read') && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <div className="card-title" style={{ padding: '14px 16px 6px' }}>Satış Danışmanı Performansı</div>
            {s.advisors.length === 0 ? empty('Danışman verisi yok') : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 11.5 }}>{['Danışman', 'Müşteri', 'Kazanılan', 'Tutar', 'Görev', 'Randevu'].map(h => <th key={h} style={{ padding: '8px 16px' }}>{h}</th>)}</tr></thead>
                <tbody>{s.advisors.map(a => <tr key={a.id} style={{ borderTop: '1px solid var(--bdr)' }}><td style={{ padding: '9px 16px', color: 'var(--tx)', fontWeight: 600 }}>{a.name}</td><td style={{ padding: '9px 16px' }}>{a.customers}</td><td style={{ padding: '9px 16px' }}>{a.won}</td><td style={{ padding: '9px 16px' }}>{money(a.won_amount)}</td><td style={{ padding: '9px 16px' }}>{a.tasks_done}</td><td style={{ padding: '9px 16px' }}>{a.appointments_done}</td></tr>)}</tbody>
              </table>)}
          </div>)}
        {crm.can('campaigns.read') && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <div className="card-title" style={{ padding: '14px 16px 6px' }}>Kampanya Sonuçları</div>
            {s.campaigns.length === 0 ? empty('Seçili dönemde kampanya yok') : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 11.5 }}>{['Kampanya', 'Kanal', 'Hedef', 'İzinli', 'Gönderilen', 'Hatalı'].map(h => <th key={h} style={{ padding: '8px 16px' }}>{h}</th>)}</tr></thead>
                <tbody>{s.campaigns.map(c => <tr key={c.id} style={{ borderTop: '1px solid var(--bdr)' }}><td style={{ padding: '9px 16px', color: 'var(--tx)', fontWeight: 600 }}>{c.name}</td><td style={{ padding: '9px 16px' }}>{c.channel}</td><td style={{ padding: '9px 16px' }}>{c.total}</td><td style={{ padding: '9px 16px' }}>{c.eligible}</td><td style={{ padding: '9px 16px' }}>{c.sent}</td><td style={{ padding: '9px 16px' }}>{c.failed}</td></tr>)}</tbody>
              </table>)}
          </div>)}
      </>)}
    </div>
  )
}
