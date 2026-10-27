'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, Check, Store, UserCog, FileSpreadsheet, Plug, Inbox, Activity as ActivityIcon, Plus } from 'lucide-react'
import { Kpi, KpiStrip } from '@/components/crm/Kpi'
import Empty from '@/components/crm/Empty'
import { FeedRow, ago, type FeedItem } from '@/components/crm/ActivityFeed'
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
  const [setup, setSetup] = useState<{ stores: number; users: number; customers: number; products: number; integrations: number } | null>(null)
  const [team, setTeam] = useState<{ id: string; name: string; last_seen_at: string | null; actions: number; active: boolean }[]>([])
  const [feed, setFeed] = useState<FeedItem[]>([])
  const canActivity = crm.can('activity.read')
  const canSetup = crm.can('integrations.manage')

  useEffect(() => { supabase.from('stores').select('id, name').eq('is_active', true).order('name').then(({ data }) => setStores((data || []) as any)) }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (canSetup) {
      const c = (t: string, f?: (q: any) => any) => { let q: any = supabase.from(t).select('id', { count: 'exact', head: true }); if (f) q = f(q); return q.then((r: any) => r.count || 0) }
      Promise.all([c('stores'), c('profiles'), c('customers'), c('products'), c('integrations', (q: any) => q.eq('status', 'active'))]).then(([stores, users, customers, products, integrations]) => setSetup({ stores, users, customers, products, integrations }))
    }
    if (canActivity) {
      const loadTeam = () => {
        supabase.rpc('activity_users', { p_from: new Date(Date.now() - 864e5).toISOString(), p_to: new Date().toISOString() }).then(({ data }) => setTeam((data || []) as any))
        supabase.rpc('activity_feed', { p_limit: 12 }).then(({ data }) => setFeed((data || []) as FeedItem[]))
      }
      loadTeam(); const t = setInterval(loadTeam, 45000); return () => clearInterval(t)
    }
  }, [canSetup, canActivity])  // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    let f: Date, t: Date
    if (range === 'custom') { if (!from || !to) return; f = new Date(from); t = new Date(to + 'T23:59:59') }
    else { t = new Date(); f = new Date(Date.now() - parseInt(range) * 86400000) }
    const { data, error } = await supabase.rpc('dashboard_stats', { p_from: f.toISOString(), p_to: t.toISOString(), p_store: store || null })
    if (error) { setErr(error.message); return }
    setErr(''); setS(data as Stats)
  }, [range, from, to, store])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const hour = new Date().getHours()
  const greet = hour < 6 ? 'İyi geceler' : hour < 12 ? 'Günaydın' : hour < 18 ? 'İyi günler' : 'İyi akşamlar'
  const today = new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })
  const online = (u: { last_seen_at: string | null }) => !!u.last_seen_at && Date.now() - new Date(u.last_seen_at).getTime() < 5 * 60000
  const steps = setup ? [
    { done: setup.stores > 1, Icon: Store, t: 'Mağaza ve bayileri ekleyin', d: `${setup.stores} kayıtlı`, href: '/crm/magazalar' },
    { done: setup.users > 1, Icon: UserCog, t: 'Ekibi davet edin', d: `${setup.users} kullanıcı`, href: '/crm/kullanicilar' },
    { done: setup.customers > 0 || setup.products > 0, Icon: FileSpreadsheet, t: 'Müşteri ve ürünleri yükleyin', d: `${setup.customers} müşteri · ${setup.products} ürün`, href: '/crm/iceaktar' },
    { done: setup.integrations > 0, Icon: Plug, t: 'Pusula ve Crealive\'i bağlayın', d: `${setup.integrations} aktif bağlantı`, href: '/crm/entegrasyonlar' },
  ] : []
  const allDone = steps.length > 0 && steps.every(x => x.done)
  const bar = (v: number, max: number) => <div style={{ height: 4, borderRadius: 2, background: 'var(--s3)', marginTop: 5, width: 120 }}><div style={{ width: `${max ? (v / max) * 100 : 0}%`, height: '100%', borderRadius: 2, background: 'var(--ac)' }} /></div>
  const maxCust = s ? Math.max(1, ...s.per_store.map(x => x.customers)) : 1
  const TH = { padding: '10px 18px', fontWeight: 500 as const }
  const TD = { padding: '12px 18px' }
  return (
    <div style={{ padding: '28px 28px 40px', maxWidth: 1280, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div className="hero">
        <div>
          <h1>{greet}, {crm.profile.first_name}</h1>
          <p>{today}{s ? ` · ${s.tasks_open} açık görev, ${s.appointments_upcoming} yaklaşan randevu` : ''}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {crm.can('customers.write') && <Link href="/crm/musteriler" className="btn"><Plus size={14} /> Yeni müşteri</Link>}
          {crm.can('data.import') && <Link href="/crm/iceaktar" className="btn-ghost"><FileSpreadsheet size={14} /> Excel yükle</Link>}
        </div>
      </div>

      {canSetup && setup && !allDone && (
        <div className="card">
          <div style={{ padding: '14px 18px 4px' }}><div className="card-title">Kurulumu tamamlayın</div><div style={{ fontSize: 12.5, color: 'var(--tx3)', marginTop: 2 }}>{steps.filter(x => x.done).length} / {steps.length} adım tamam. Her adım ilgili sayfayı açar; ayrıntılar Rehber'de.</div></div>
          <div className="steps" style={{ borderTop: '1px solid var(--bdr)', marginTop: 12 }}>
            {steps.map(x => <Link key={x.t} href={x.href} className={`step ${x.done ? 'done' : ''}`}><span className="s-ic">{x.done ? <Check size={14} strokeWidth={3} /> : <x.Icon size={13} />}</span><span><div className="s-t">{x.t}</div><div className="s-d">{x.d}</div></span></Link>)}
          </div>
        </div>)}

      <div className="card" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="seg">{RANGES.filter(([k]) => k !== 'custom').map(([k, l]) => <button key={k} className={range === k ? 'on' : ''} onClick={() => setRange(k)}>{l.replace('Son ', '')}</button>)}<button className={range === 'custom' ? 'on' : ''} onClick={() => setRange('custom')}>Özel</button></div>
        {range === 'custom' && <><input className="inp" style={{ width: 150 }} type="date" value={from} onChange={e => setFrom(e.target.value)} /><input className="inp" style={{ width: 150 }} type="date" value={to} onChange={e => setTo(e.target.value)} /></>}
        {stores.length > 1 && <select className="inp" style={{ width: 190 }} value={store} onChange={e => setStore(e.target.value)}><option value="">Tüm mağazalar</option>{stores.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>}
        <div style={{ flex: 1 }} />
        {crm.can('reports.export') && s && <a className="btn-ghost" href={`/api/crm/export/report?from=${new Date(range === 'custom' && from ? from : Date.now() - (parseInt(range) || 30) * 86400000).toISOString().slice(0, 10)}&to=${range === 'custom' && to ? to : new Date().toISOString().slice(0, 10)}${store ? `&store=${store}` : ''}`} style={{ textDecoration: 'none' }}><Download size={14} /> Rapor (Excel)</a>}
        {crm.can('customers.export') && <a className="btn-ghost" href={`/api/crm/export/customers${store ? `?store=${store}` : ''}`} style={{ textDecoration: 'none' }}><Download size={14} /> Müşteriler (Excel)</a>}
      </div>
      {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
      {!s ? <div className="card anim-pulse" style={{ height: 220 }} /> : (<>
        <KpiStrip>
          <Kpi label="Toplam müşteri" value={s.customers_total} sub="aktif kayıt" tone="ac" />
          <Kpi label="Yeni müşteri" value={s.customers_new} sub="seçili dönemde" tone="green" />
          <Kpi label="VIP müşteri" value={s.vip_count} sub="toplam" tone="gold" />
          <Kpi label="Aktif fırsat" value={s.opps_active} sub={money(s.opps_pipeline_amount)} tone="blue" />
          <Kpi label="Dönüşüm oranı" value={s.conversion_rate === null ? '—' : `%${s.conversion_rate}`} sub={`${s.opps_won} kazanılan · ${s.opps_lost} kaybedilen`} tone="green" />
          <Kpi label="Bekleyen görev" value={s.tasks_open} sub={`${s.tasks_overdue} gecikmiş`} tone={s.tasks_overdue ? 'amber' : 'ac'} />
          <Kpi label="Yaklaşan randevu" value={s.appointments_upcoming} sub="önümüzdeki 7 gün" tone="blue" />
          <Kpi label="Açık servis talebi" value={s.service_open} sub={`${s.service_overdue} SLA aşımı`} tone={s.service_overdue ? 'red' : 'ac'} />
        </KpiStrip>

        {canActivity && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.7fr) minmax(0,1fr)', gap: 22 }} className="dash-split">
            <style>{`@media(max-width:1000px){.dash-split{grid-template-columns:1fr!important}}`}</style>
            <div className="card">
              <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div><div className="card-title">Canlı akış</div><div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>Kim ne yaptı. Satıra tıklayınca eski ve yeni değerler açılır.</div></div>
                <Link href="/crm/aktivite" className="btn-ghost">Tümünü gör</Link>
              </div>
              {feed.length === 0 ? <Empty Icon={Inbox} title="Henüz işlem yok" desc="Ekip müşteri, fırsat veya görev oluşturduğunda burada anında görünür." /> : feed.map(a => <FeedRow key={a.id} a={a} />)}
            </div>
            <div className="card" style={{ alignSelf: 'start' }}>
              <div style={{ padding: '14px 18px' }}><div className="card-title">Ekip</div><div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>{team.filter(online).length} kişi çevrimiçi · son 24 saat</div></div>
              {team.length === 0 ? <Empty Icon={ActivityIcon} title="Kullanıcı yok" /> : team.map(u => (
                <Link key={u.id} href="/crm/aktivite" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', borderTop: '1px solid var(--bdr)', opacity: u.active ? 1 : .5 }}>
                  <span style={{ position: 'relative' }}><span className="sb-av" style={{ width: 32, height: 32, fontSize: 13 }}>{u.name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}</span>
                    <i style={{ position: 'absolute', right: -1, bottom: -1, width: 10, height: 10, borderRadius: '50%', border: '2px solid var(--s1)', background: online(u) ? 'var(--green)' : 'var(--s5)' }} /></span>
                  <span style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, color: 'var(--tx)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name}</div><div style={{ fontSize: 12, color: 'var(--tx3)' }}>{online(u) ? 'Çevrimiçi' : `Son görülme ${ago(u.last_seen_at)}`}</div></span>
                  <span style={{ textAlign: 'right' }}><div className="serif" style={{ fontSize: 22, lineHeight: 1 }}>{u.actions}</div><div style={{ fontSize: 11, color: 'var(--tx3)' }}>işlem</div></span>
                </Link>))}
            </div>
          </div>)}

        <div className="card" style={{ overflowX: 'auto' }}>
          <div style={{ padding: '14px 18px 8px' }}><div className="card-title">Mağaza ve bayi performansı</div></div>
          {s.per_store.length === 0 ? <Empty Icon={Store} title="Erişilebilir mağaza yok" desc="Yönetici sizi bir mağazaya veya bayiye bağladığında burada görünür." /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 12.5 }}>{['Mağaza', 'Müşteri', 'Yeni', 'VIP', 'Aktif fırsat'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
              <tbody>{s.per_store.map(x => <tr key={x.id} style={{ borderTop: '1px solid var(--bdr)' }}><td style={{ ...TD, color: 'var(--tx)', fontWeight: 600 }}>{x.name}</td><td style={TD}>{x.customers.toLocaleString('tr-TR')}{bar(x.customers, maxCust)}</td><td style={TD}>{x.new}</td><td style={TD}>{x.vip}</td><td style={TD}>{x.opps_active}</td></tr>)}</tbody>
            </table>)}
        </div>
        {crm.can('reports.read') && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <div style={{ padding: '14px 18px 8px' }}><div className="card-title">Satış danışmanı performansı</div></div>
            {s.advisors.length === 0 ? <Empty Icon={UserCog} title="Danışman verisi yok" desc="Müşteriler danışmanlara atandıkça burada sıralanır." /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 12.5 }}>{['Danışman', 'Müşteri', 'Kazanılan', 'Tutar', 'Görev', 'Randevu'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                <tbody>{s.advisors.map(a => <tr key={a.id} style={{ borderTop: '1px solid var(--bdr)' }}><td style={{ ...TD, color: 'var(--tx)', fontWeight: 600 }}>{a.name}</td><td style={TD}>{a.customers}</td><td style={TD}>{a.won}</td><td style={TD}>{money(a.won_amount)}</td><td style={TD}>{a.tasks_done}</td><td style={TD}>{a.appointments_done}</td></tr>)}</tbody>
              </table>)}
          </div>)}
        {crm.can('campaigns.read') && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <div style={{ padding: '14px 18px 8px' }}><div className="card-title">Kampanya sonuçları</div></div>
            {s.campaigns.length === 0 ? <Empty title="Seçili dönemde kampanya yok" desc="Pazarlama bölümünden segment oluşturup kampanya başlatın." /> : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 12.5 }}>{['Kampanya', 'Kanal', 'Hedef', 'İzinli', 'Gönderilen', 'Hatalı'].map(h => <th key={h} style={TH}>{h}</th>)}</tr></thead>
                <tbody>{s.campaigns.map(c => <tr key={c.id} style={{ borderTop: '1px solid var(--bdr)' }}><td style={{ ...TD, color: 'var(--tx)', fontWeight: 600 }}>{c.name}</td><td style={TD}>{c.channel}</td><td style={TD}>{c.total}</td><td style={TD}>{c.eligible}</td><td style={TD}>{c.sent}</td><td style={TD}>{c.failed}</td></tr>)}</tbody>
              </table>)}
          </div>)}
      </>)}
    </div>
  )
}
