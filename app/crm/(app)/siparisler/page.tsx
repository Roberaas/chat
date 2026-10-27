'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, ShoppingBag, Paperclip, X } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import Empty from '@/components/crm/Empty'
import { Kpi, KpiStrip } from '@/components/crm/Kpi'
import Attachments from '@/components/crm/Attachments'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type O = { id: string; order_no: string | null; status: string; total: number; currency: string; ordered_at: string; source_system: string; store_id: string | null; customer_id: string; customers: { first_name: string; last_name: string; phone: string | null } | null }
const ST: Record<string, [string, string]> = { pending: ['Beklemede', 'badge-muted'], paid: ['Ödendi', 'badge-green'], shipped: ['Kargoda', 'badge-blue'], delivered: ['Teslim edildi', 'badge-green'], cancelled: ['İptal', 'badge-red'], returned: ['İade', 'badge-amber'] }
const PAGE = 50
const money = (n: number) => `${Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
const dt = (s: string) => new Date(s).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })
const TH = { padding: '10px 18px', fontWeight: 500 as const, whiteSpace: 'nowrap' as const }
const TD = { padding: '11px 18px', whiteSpace: 'nowrap' as const }

export default function SiparislerPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const [files, setFiles] = useState<O | null>(null)
  const [rows, setRows] = useState<O[]>([])
  const [count, setCount] = useState(0)
  const [page, setPage] = useState(0)
  const [q, setQ] = useState(''); const [status, setStatus] = useState(''); const [store, setStore] = useState('')
  const [from, setFrom] = useState(''); const [to, setTo] = useState('')
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [sum, setSum] = useState<{ cnt: number; total: number; avg_total: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const sname = (id: string | null) => stores.find(s => s.id === id)?.name || '—'

  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get('q'); if (p) setQ(p)
    supabase.from('stores').select('id, name').order('name').then(({ data }) => setStores((data || []) as any))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const load = useCallback(async () => {
    setLoading(true)
    const f = from ? `${from}T00:00:00+03:00` : null, t = to ? `${to}T23:59:59+03:00` : null
    let qq = supabase.from('orders').select('id, order_no, status, total, currency, ordered_at, source_system, store_id, customer_id, customers(first_name, last_name, phone)', { count: 'exact' }).order('ordered_at', { ascending: false }).range(page * PAGE, page * PAGE + PAGE - 1)
    if (q.trim()) qq = qq.ilike('order_no', `%${q.trim().replace(/[%_]/g, '')}%`)
    if (status) qq = qq.eq('status', status)
    if (store) qq = qq.eq('store_id', store)
    if (f) qq = qq.gte('ordered_at', f)
    if (t) qq = qq.lte('ordered_at', t)
    const [r, s] = await Promise.all([qq, supabase.rpc('orders_summary', { p_q: q.trim() || null, p_status: status || null, p_store: store || null, p_from: f, p_to: t })])
    setLoading(false)
    if (r.error) { setErr(r.error.message); return }
    setErr(''); setRows((r.data || []) as any); setCount(r.count || 0)
    const row = Array.isArray(s.data) ? s.data[0] : s.data
    setSum(row ? { cnt: Number(row.cnt), total: Number(row.total), avg_total: Number(row.avg_total) } : null)
  }, [q, status, store, from, to, page])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) }, [load])
  useEffect(() => { setPage(0) }, [q, status, store, from, to])

  const pages = Math.max(1, Math.ceil(count / PAGE))
  const exportHref = `/api/crm/export/orders?${new URLSearchParams({ ...(store ? { store } : {}), ...(from ? { from } : {}), ...(to ? { to } : {}) }).toString()}`

  return (
    <>
      <CrmTopBar title="Siparişler" subtitle={`${count.toLocaleString('tr-TR')} kayıt`} action={crm.can('reports.export') ? <a className="btn-ghost" href={exportHref} style={{ textDecoration: 'none' }}><Download size={14} /> Excel</a> : undefined} />
      <div style={{ padding: '24px 28px 40px', maxWidth: 1280, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <KpiStrip>
          <Kpi label="Sipariş" value={sum?.cnt ?? 0} sub="filtreye uyan" tone="ac" />
          <Kpi label="Ciro" value={money(sum?.total ?? 0)} sub="iptal ve iade hariç" tone="green" />
          <Kpi label="Ortalama sepet" value={money(sum?.avg_total ?? 0)} tone="blue" />
          <Kpi label="Sayfa" value={`${page + 1} / ${pages}`} sub={`${PAGE} kayıt`} tone="gold" />
        </KpiStrip>
        <div className="card" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          <input className="inp" style={{ width: 200 }} placeholder="Sipariş no ara" value={q} onChange={e => setQ(e.target.value)} />
          <select className="inp" style={{ width: 150 }} value={status} onChange={e => setStatus(e.target.value)}><option value="">Tüm durumlar</option>{Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select>
          {stores.length > 1 && <select className="inp" style={{ width: 190 }} value={store} onChange={e => setStore(e.target.value)}><option value="">Tüm mağazalar</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
          <input className="inp" style={{ width: 150 }} type="date" value={from} onChange={e => setFrom(e.target.value)} aria-label="Başlangıç" />
          <input className="inp" style={{ width: 150 }} type="date" value={to} onChange={e => setTo(e.target.value)} aria-label="Bitiş" />
          {(q || status || store || from || to) && <button className="btn-ghost" onClick={() => { setQ(''); setStatus(''); setStore(''); setFrom(''); setTo('') }}>Temizle</button>}
        </div>
        {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
        <div className="card" style={{ overflowX: 'auto' }}>
          {!loading && rows.length === 0 ? <Empty Icon={ShoppingBag} title="Sipariş bulunamadı" desc="Siparişler Pusula, Crealive ve mağaza satışlarından entegrasyonla otomatik gelir. Filtreleri temizleyip tekrar deneyin." action={<Link className="btn-ghost" href="/crm/entegrasyonlar">Entegrasyonlar</Link>} /> : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 12.5 }}>{['Sipariş', 'Müşteri', 'Tarih', 'Mağaza / bayi', 'Kaynak', 'Durum', 'Tutar'].map((h, i) => <th key={h} style={{ ...TH, textAlign: i === 6 ? 'right' : 'left' }}>{h}</th>)}</tr></thead>
              <tbody>{rows.map(o => (
                <tr key={o.id} style={{ borderTop: '1px solid var(--bdr)' }}>
                  <td style={{ ...TD, color: 'var(--tx)', fontWeight: 600 }}>{o.order_no || o.id.slice(0, 8)} {crm.can('attachments.read') && <button className="btn-ghost" title="Dosyalar (fatura, irsaliye)" aria-label="Dosyalar" onClick={() => setFiles(o)} style={{ padding: '2px 6px', marginLeft: 4 }}><Paperclip size={12} /></button>}</td>
                  <td style={TD}><Link href={`/crm/musteriler/${o.customer_id}`} style={{ color: 'var(--tx)' }}>{o.customers ? `${o.customers.first_name} ${o.customers.last_name}`.trim() : '—'}</Link>{o.customers?.phone && <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{o.customers.phone}</div>}</td>
                  <td style={TD}>{dt(o.ordered_at)}</td><td style={TD}>{sname(o.store_id)}</td><td style={TD}>{o.source_system}</td>
                  <td style={TD}><span className={`badge ${(ST[o.status] || ['', 'badge-muted'])[1]}`}>{(ST[o.status] || [o.status])[0]}</span></td>
                  <td style={{ ...TD, textAlign: 'right', color: 'var(--tx)', fontWeight: 600 }}>{Number(o.total).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {o.currency === 'TRY' ? '₺' : o.currency}</td>
                </tr>))}</tbody>
            </table>)}
          {pages > 1 && <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 12, borderTop: '1px solid var(--bdr)' }}><button className="btn-ghost" disabled={page === 0} onClick={() => setPage(page - 1)}>Önceki</button><button className="btn-ghost" disabled={page + 1 >= pages} onClick={() => setPage(page + 1)}>Sonraki</button></div>}
        </div>
      </div>
      {files && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setFiles(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 520 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>Sipariş {files.order_no || files.id.slice(0, 8)} dosyaları</h2><button onClick={() => setFiles(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }} aria-label="Kapat"><X size={18} /></button></div>
            <Attachments entity="order" entityId={files.id} />
          </div>
        </div>)}
    </>
  )
}
