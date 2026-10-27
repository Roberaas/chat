'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Users, UserPlus, Wallet, Repeat, ShoppingBag, BellOff, Crown, Flag } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import StatCard from '@/components/StatCard'
import { HBars, LineChart } from '@/components/crm/Charts'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { useCrm } from '@/components/crm/CrmProvider'
import { SOURCE_LABEL } from '@/lib/crm/labels'

type R = {
  kpi: Record<string, number>
  top_customers: { id: string; name: string; orders: number; revenue: number; last_at: string }[]
  inactive: { id: string; name: string; phone: string | null; total_spent: number; last_at: string }[]
  by_advisor: { id: string; name: string; customers: number; new: number; orders: number; revenue: number }[]
  sources: { source: string; count: number }[]
  monthly: { m: string; new: number; revenue: number }[]
}
type T = { id: string; store_name: string | null; advisor_id: string | null; advisor_name: string | null; target: number; actual: number }
const RANGES: [string, string][] = [['30', 'Son 30 gün'], ['90', 'Son 90 gün'], ['180', 'Son 6 ay'], ['365', 'Son 1 yıl']]
const money = (n: number) => `${Number(n || 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
const iso = (d: Date) => d.toISOString().slice(0, 10)
const th = { padding: '8px 14px', whiteSpace: 'nowrap' as const }
const td = { padding: '9px 14px', whiteSpace: 'nowrap' as const }
const date = (s: string | null) => s ? new Date(s).toLocaleDateString('tr-TR') : '-'

export default function BayiRaporuPage() {
  const supabase = createCrmBrowserClient()
  const crm = useCrm()
  const [range, setRange] = useState('90')
  const [store, setStore] = useState('')
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [r, setR] = useState<R | null>(null)
  const [targets, setTargets] = useState<T[]>([])
  const [err, setErr] = useState('')

  useEffect(() => { supabase.from('stores').select('id, name').eq('is_active', true).order('name').then(({ data }) => setStores((data || []) as any)) }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const { f, t } = useMemo(() => ({ f: iso(new Date(Date.now() - (parseInt(range) - 1) * 864e5)), t: iso(new Date()) }), [range])

  const load = useCallback(async () => {
    setR(null)
    const { data, error } = await supabase.rpc('dealer_report', { p_from: `${f}T00:00:00+03:00`, p_to: `${t}T23:59:59+03:00`, p_store: store || null })
    if (error) { setErr(error.message); return }
    setErr(''); setR(data as R)
    if (crm.can('targets.read')) {
      const tp = await supabase.rpc('target_progress', { p_period: null })
      setTargets(((tp.data || []) as any[]).filter(x => !store || x.store_id === store).map(x => ({ ...x, target: Number(x.target), actual: Number(x.actual) })))
    }
  }, [f, t, store])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const k = r?.kpi || {}
  const repeatPct = k.buyers ? Math.round((k.repeat_buyers / k.buyers) * 100) : 0
  const now = new Date(); const dim = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate(); const pace = now.getDate() / dim
  const empty = (s: string) => <div style={{ padding: 22, textAlign: 'center', color: 'var(--tx3)', fontSize: 12.5 }}>{s}</div>

  return (
    <>
      <CrmTopBar title="Müşteri Raporum" subtitle="Müşterileriniz, satışlarınız ve hedefiniz" />
      <div style={{ padding: 22, maxWidth: 1200, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div className="card" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <select className="inp" style={{ width: 150 }} value={range} onChange={e => setRange(e.target.value)}>{RANGES.map(([a, b]) => <option key={a} value={a}>{b}</option>)}</select>
          {stores.length > 1 && <select className="inp" style={{ width: 220 }} value={store} onChange={e => setStore(e.target.value)}><option value="">Tüm mağazalarım / şubelerim</option>{stores.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
          <div style={{ flex: 1 }} /><span style={{ fontSize: 12, color: 'var(--tx3)' }}>Yalnızca erişiminiz olan müşteriler hesaplanır. Yalnızca ödenmiş, kargolanmış veya teslim edilmiş siparişler ciroya girer.</span>
        </div>
        {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
        {!r && !err ? <div className="card anim-pulse" style={{ height: 180 }} /> : r && (<>
          {targets.length > 0 && (
            <div className="card" style={{ padding: 16 }}>
              <div className="card-title" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><Flag size={14} /> Bu ayın hedefi <Link href="/crm/hedefler" style={{ marginLeft: 'auto', fontSize: 12, fontWeight: 400 }}>Hedefler</Link></div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 14 }}>
                {targets.map(x => {
                  const pct = x.target ? x.actual / x.target : 0, forecast = pace > 0 ? x.actual / pace : 0, behind = pct < pace - 0.1
                  return <div key={x.id}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><b style={{ color: 'var(--tx)' }}>{x.advisor_name || x.store_name}</b><span>%{Math.round(pct * 100)}</span></div>
                    <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--s3)', margin: '6px 0' }}>
                      <div style={{ width: `${Math.min(100, pct * 100)}%`, height: '100%', borderRadius: 4, background: pct >= 1 ? 'var(--green)' : behind ? 'var(--amber)' : 'var(--ac)' }} />
                      <i style={{ position: 'absolute', left: `${pace * 100}%`, top: -3, bottom: -3, width: 2, background: 'var(--tx3)' }} />
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{money(x.actual)} / {money(x.target)} · bu tempoyla ay sonu tahmini <b style={{ color: forecast >= x.target ? 'var(--green)' : 'var(--amber)' }}>{money(forecast)}</b></div>
                  </div>
                })}
              </div>
            </div>)}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14 }}>
            <StatCard label="Toplam Müşteri" value={Number(k.customers_total)} sub={`${k.vip} VIP`} Icon={Users} accent="var(--ac)" />
            <StatCard label="Yeni Müşteri" value={Number(k.customers_new)} sub="seçili dönem" Icon={UserPlus} accent="var(--green)" />
            <StatCard label="Ciro" value={money(k.revenue)} sub={`${k.orders} sipariş · ort. sepet ${money(k.avg_basket)}`} Icon={Wallet} accent="var(--green)" />
            <StatCard label="Alışveriş Yapan" value={Number(k.buyers)} sub="seçili dönemde" Icon={ShoppingBag} accent="var(--blue)" />
            <StatCard label="Tekrar Alan" value={`%${repeatPct}`} sub={`${k.repeat_buyers} müşteri birden fazla aldı`} Icon={Repeat} accent="var(--ac)" />
            <StatCard label="90+ Gündür Gelmeyen" value={Number(k.inactive_90)} sub="geri kazanılabilir" Icon={BellOff} accent="var(--amber)" />
            <StatCard label="Hiç Almamış" value={Number(k.never_bought)} sub="30 günden eski kayıt" Icon={Crown} accent="var(--red)" />
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="card-title" style={{ marginBottom: 6 }}>Son 6 ay: yeni müşteri ve ciro</div>
            <LineChart labels={r.monthly.map(m => m.m)} series={[{ name: 'Yeni müşteri', color: 'var(--ac)', values: r.monthly.map(m => m.new) }, { name: 'Ciro', color: 'var(--green)', values: r.monthly.map(m => m.revenue), fmt: money }]} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(420px,1fr))', gap: 14 }}>
            <div className="card" style={{ overflowX: 'auto' }}>
              <div className="card-title" style={{ padding: '14px 16px 6px' }}>En çok alışveriş yapan 10 müşteri</div>
              {r.top_customers.length === 0 ? empty('Bu dönemde alışveriş yok') : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 11.5 }}>{['Müşteri', 'Sipariş', 'Tutar', 'Son'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{r.top_customers.map(c => <tr key={c.id} style={{ borderTop: '1px solid var(--bdr)' }}><td style={td}><Link href={`/crm/musteriler/${c.id}`}>{c.name}</Link></td><td style={td}>{c.orders}</td><td style={td}>{money(c.revenue)}</td><td style={td}>{date(c.last_at)}</td></tr>)}</tbody></table>}
            </div>
            <div className="card" style={{ overflowX: 'auto' }}>
              <div className="card-title" style={{ padding: '14px 16px 2px' }}>Geri kazanılacak müşteriler</div>
              <div style={{ padding: '0 16px 6px', fontSize: 12, color: 'var(--tx3)' }}>90 günden uzun süredir almayan, geçmişte en çok harcayanlar. Arayın ya da kampanyaya alın.</div>
              {r.inactive.length === 0 ? empty('Uyuyan müşteri yok') : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 11.5 }}>{['Müşteri', 'Telefon', 'Toplam', 'Son alışveriş'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{r.inactive.map(c => <tr key={c.id} style={{ borderTop: '1px solid var(--bdr)' }}><td style={td}><Link href={`/crm/musteriler/${c.id}`}>{c.name}</Link></td><td style={td}>{c.phone || '-'}</td><td style={td}>{money(c.total_spent)}</td><td style={td}>{date(c.last_at)}</td></tr>)}</tbody></table>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(340px,1fr))', gap: 14 }}>
            <div className="card" style={{ overflowX: 'auto' }}>
              <div className="card-title" style={{ padding: '14px 16px 6px' }}>Danışman bazında</div>
              {r.by_advisor.length === 0 ? empty('Veri yok') : <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 11.5 }}>{['Danışman', 'Müşteri', 'Yeni', 'Sipariş', 'Ciro'].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
                <tbody>{r.by_advisor.map(a => <tr key={a.id} style={{ borderTop: '1px solid var(--bdr)' }}><td style={td}>{a.name}</td><td style={td}>{a.customers}</td><td style={td}>{a.new}</td><td style={td}>{a.orders}</td><td style={td}>{money(a.revenue)}</td></tr>)}</tbody></table>}
            </div>
            <div className="card" style={{ padding: 14 }}>
              <div className="card-title" style={{ marginBottom: 8 }}>Yeni müşteriler nereden geldi</div>
              {r.sources.length === 0 ? empty('Bu dönemde yeni müşteri yok') : <HBars rows={r.sources.map(s => ({ label: SOURCE_LABEL[s.source] || s.source, value: s.count }))} />}
            </div>
          </div>
        </>)}
      </div>
    </>
  )
}
