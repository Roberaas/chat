'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, Users, UserPlus, Target, TrendingUp, ShoppingBag, CheckSquare, Wrench, Wallet } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import StatCard from '@/components/StatCard'
import { LineChart, HBars } from '@/components/crm/Charts'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { ROLE_LABEL } from '@/lib/crm/types'
import { SOURCE_LABEL } from '@/lib/crm/labels'

type R = {
  kpi: Record<string, number | null>
  daily: { d: string; customers: number; opps: number; won: number; orders: number; revenue: number }[]
  by_store: { id: string; name: string; type: string; customers: number; new: number; opps_created: number; won: number; won_amount: number; orders: number; revenue: number; tasks_overdue: number }[]
  by_user: { id: string; name: string; roles: string; stores: string; last_seen_at: string | null; customers_created: number; interactions: number; opps_created: number; won: number; won_amount: number; tasks_done: number; tasks_overdue: number; appointments_completed: number; no_show: number }[]
  funnel: { code: string; label: string; kind: string; count: number; amount: number }[]
  sources: { source: string; count: number }[]
  lost_reasons: { reason: string; count: number }[]
}
const RANGES: [string, string][] = [['7', 'Son 7 gün'], ['30', 'Son 30 gün'], ['90', 'Son 90 gün'], ['365', 'Son 1 yıl'], ['month', 'Bu ay'], ['custom', 'Özel']]
const TYPE: Record<string, string> = { store: 'Mağaza', hq: 'Merkez', online: 'Online', dealer: 'Bayi', wholesale: 'Toptancı' }
const money = (n: number) => `${Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
const iso = (d: Date) => d.toISOString().slice(0, 10)
const th = { padding: '8px 14px', whiteSpace: 'nowrap' as const }
const td = { padding: '9px 14px', whiteSpace: 'nowrap' as const }

export default function RaporlarPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const [range, setRange] = useState('30')
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [store, setStore] = useState('')
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [r, setR] = useState<R | null>(null)
  const [err, setErr] = useState('')
  const [sort, setSort] = useState<'revenue' | 'won_amount' | 'new'>('won_amount')

  const { f, t } = useMemo(() => {
    const now = new Date()
    if (range === 'custom') return { f: from, t: to }
    if (range === 'month') return { f: iso(new Date(now.getFullYear(), now.getMonth(), 1)), t: iso(now) }
    return { f: iso(new Date(Date.now() - (parseInt(range) - 1) * 864e5)), t: iso(now) }
  }, [range, from, to])

  useEffect(() => { supabase.from('stores').select('id, name').eq('is_active', true).order('name').then(({ data }) => setStores((data || []) as any)) }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    if (!f || !t) return
    setR(null)
    const { data, error } = await supabase.rpc('report_overview', { p_from: `${f}T00:00:00+03:00`, p_to: `${t}T23:59:59+03:00`, p_store: store || null })
    if (error) { setErr(error.message); return }
    setErr(''); setR(data as R)
  }, [f, t, store])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const k = r?.kpi || {}
  const labels = (r?.daily || []).map(d => new Date(d.d).toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' }))
  const stRows = [...(r?.by_store || [])].sort((a, b) => Number(b[sort]) - Number(a[sort]))
  const qs = `from=${f}&to=${t}${store ? `&store=${store}` : ''}`
  const empty = (t: string) => <div style={{ padding: 22, textAlign: 'center', color: 'var(--tx3)', fontSize: 12.5 }}>{t}</div>

  return (
    <>
      <CrmTopBar title="Raporlar" subtitle="Mağaza, bayi ve ekip performansı" />
      <div style={{ padding: 22, maxWidth: 1250, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="inp" style={{ width: 150 }} value={range} onChange={e => setRange(e.target.value)}>{RANGES.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
          {range === 'custom' && <><input className="inp" style={{ width: 150 }} type="date" value={from} onChange={e => setFrom(e.target.value)} /><input className="inp" style={{ width: 150 }} type="date" value={to} onChange={e => setTo(e.target.value)} /></>}
          {stores.length > 1 && <select className="inp" style={{ width: 200 }} value={store} onChange={e => setStore(e.target.value)}><option value="">Tüm mağaza / bayiler</option>{stores.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
          <div style={{ flex: 1 }} />
          {crm.can('reports.export') && r && <a className="btn-ghost" style={{ textDecoration: 'none' }} href={`/api/crm/export/report?${qs}`}><Download size={14} /> Excel'e aktar</a>}
        </div>
        {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
        {!r && !err ? <div className="card anim-pulse" style={{ height: 180 }} /> : r && (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
            <StatCard label="Toplam Müşteri" value={Number(k.customers_total)} sub={`${k.vip} VIP`} Icon={Users} accent="var(--ac)" />
            <StatCard label="Yeni Müşteri" value={Number(k.customers_new)} sub="seçili dönem" Icon={UserPlus} accent="var(--green)" />
            <StatCard label="Ciro" value={money(Number(k.orders_total))} sub={`${k.orders} sipariş`} Icon={Wallet} accent="var(--green)" />
            <StatCard label="Kazanılan Fırsat" value={money(Number(k.opps_won_amount))} sub={`${k.opps_won} kazanıldı · ${k.opps_lost} kaybedildi`} Icon={TrendingUp} accent="var(--blue)" />
            <StatCard label="Açık Hat Değeri" value={money(Number(k.pipeline_amount))} sub={`${k.opps_created} yeni fırsat`} Icon={Target} accent="var(--ac)" />
            <StatCard label="Tamamlanan Görev" value={Number(k.tasks_done)} sub={`${k.tasks_overdue} gecikmiş`} Icon={CheckSquare} accent="var(--amber)" />
            <StatCard label="Randevu" value={Number(k.appointments_completed)} sub={`${k.appointments_no_show} gelmedi · ${k.interactions} etkileşim`} Icon={ShoppingBag} accent="var(--ac)" />
            <StatCard label="Servis" value={Number(k.service_resolved)} sub={`${k.service_opened} açıldı · ${k.service_overdue} SLA aşımı${k.service_avg_hours ? ` · ort. ${k.service_avg_hours} sa` : ''}`} Icon={Wrench} accent="var(--red)" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14 }}>
            <div className="card" style={{ padding: 14 }}>
              <div className="card-title" style={{ marginBottom: 6 }}>Günlük müşteri ve fırsat</div>
              <LineChart labels={labels} series={[{ name: 'Yeni müşteri', color: 'var(--ac)', values: r.daily.map(d => d.customers) }, { name: 'Yeni fırsat', color: 'var(--blue)', values: r.daily.map(d => d.opps) }, { name: 'Kazanılan', color: 'var(--green)', values: r.daily.map(d => d.won) }]} />
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="card-title" style={{ marginBottom: 6 }}>Günlük ciro</div>
              <LineChart labels={labels} series={[{ name: 'Ciro', color: 'var(--green)', values: r.daily.map(d => d.revenue), fmt: money }]} />
            </div>
          </div>
          <div className="card" style={{ overflowX: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px 6px', gap: 10 }}>
              <div className="card-title" style={{ flex: 1 }}>Mağaza / Bayi / Toptancı karşılaştırması</div>
              <select className="inp" style={{ width: 170 }} value={sort} onChange={e => setSort(e.target.value as any)}><option value="won_amount">Kazanılan tutara göre</option><option value="revenue">Ciroya göre</option><option value="new">Yeni müşteriye göre</option></select>
            </div>
            {stRows.length === 0 ? empty('Erişilebilir mağaza yok') : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 11.5 }}>{['Ad', 'Tür', 'Müşteri', 'Yeni', 'Fırsat', 'Kazanılan', 'Tutar', 'Sipariş', 'Ciro', 'Geciken görev'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{stRows.map(x => <tr key={x.id} style={{ borderTop: '1px solid var(--bdr)' }}>
                  <td style={{ ...td, color: 'var(--tx)', fontWeight: 600 }}>{x.name}</td><td style={td}><span className="badge badge-muted">{TYPE[x.type] || x.type}</span></td>
                  <td style={td}>{x.customers}</td><td style={td}>{x.new}</td><td style={td}>{x.opps_created}</td><td style={td}>{x.won}</td><td style={td}>{money(x.won_amount)}</td><td style={td}>{x.orders}</td><td style={td}>{money(x.revenue)}</td>
                  <td style={{ ...td, color: x.tasks_overdue ? 'var(--red)' : undefined }}>{x.tasks_overdue}</td></tr>)}</tbody>
              </table>)}
          </div>
          {crm.can('reports.read') && (
            <div className="card" style={{ overflowX: 'auto' }}>
              <div className="card-title" style={{ padding: '14px 16px 6px' }}>Ekip performansı</div>
              {r.by_user.length === 0 ? empty('Kullanıcı verisi yok') : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 11.5 }}>{['Kullanıcı', 'Rol', 'Mağaza / Bayi', 'Müşteri ekledi', 'Etkileşim', 'Fırsat', 'Kazanılan', 'Tutar', 'Görev ✓', 'Geciken', 'Randevu ✓', 'Gelmedi'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                  <tbody>{r.by_user.map(u => <tr key={u.id} style={{ borderTop: '1px solid var(--bdr)' }}>
                    <td style={{ ...td, color: 'var(--tx)', fontWeight: 600 }}>{u.name}</td>
                    <td style={td}>{u.roles.split(',').filter(Boolean).map(x => ROLE_LABEL[x] || x).join(', ') || '—'}</td>
                    <td style={{ ...td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.stores || '—'}</td>
                    <td style={td}>{u.customers_created}</td><td style={td}>{u.interactions}</td><td style={td}>{u.opps_created}</td><td style={td}>{u.won}</td><td style={td}>{money(u.won_amount)}</td>
                    <td style={td}>{u.tasks_done}</td><td style={{ ...td, color: u.tasks_overdue ? 'var(--red)' : undefined }}>{u.tasks_overdue}</td><td style={td}>{u.appointments_completed}</td><td style={td}>{u.no_show}</td></tr>)}</tbody>
                </table>)}
            </div>)}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>
            <div className="card"><div className="card-title" style={{ padding: '14px 16px 6px' }}>Satış hunisi</div>
              <HBars rows={r.funnel.map(x => ({ label: x.label, value: x.count, sub: money(x.amount) }))} /></div>
            <div className="card"><div className="card-title" style={{ padding: '14px 16px 6px' }}>Müşteri kaynakları</div>
              <HBars color="var(--blue)" rows={r.sources.map(x => ({ label: SOURCE_LABEL[x.source] || x.source, value: x.count }))} /></div>
            <div className="card"><div className="card-title" style={{ padding: '14px 16px 6px' }}>Kayıp nedenleri</div>
              <HBars color="var(--red)" rows={r.lost_reasons.map(x => ({ label: x.reason, value: x.count }))} /></div>
          </div>
        </>)}
      </div>
    </>
  )
}
