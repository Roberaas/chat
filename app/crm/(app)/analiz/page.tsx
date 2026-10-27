'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Download, PieChart } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import Empty from '@/components/crm/Empty'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type S = { segment: string; customers: number; total_spent: number; avg_spent: number }
type C = { id: string; name: string; phone: string | null; city: string | null; order_count: number; total_spent: number; last_purchase_at: string | null; segment: string }
const META: [string, string, string, string][] = [
  ['Şampiyon', 'var(--gold)', 'En yeni, en sık ve en çok harcayan müşteriler.', 'VIP programına alın, yeni koleksiyonu önce onlara gösterin.'],
  ['Sadık', 'var(--green)', 'Düzenli alışveriş yapıyor.', 'Sadakat teklifi sunun, tavsiye isteyin.'],
  ['Potansiyel sadık', 'var(--blue)', 'Yakın zamanda birden fazla kez aldı.', 'Bir sonraki alışverişe özel teklif verin.'],
  ['Yeni', 'var(--ac)', 'İlk alışverişini yakın zamanda yaptı.', 'Teşekkür edin, bakım rehberi gönderin.'],
  ['Aktif', 'var(--tx2)', 'Orta düzeyde alışveriş yapıyor.', 'Yeni gelenleri ve kampanyaları paylaşın.'],
  ['Risk altında', 'var(--amber)', 'Eskiden sık alıyordu, uzun süredir gelmedi.', 'Danışman kişisel olarak arasın.'],
  ['Uyuyan', 'var(--red)', 'Uzun süredir alışveriş yok.', 'Geri dönüş kampanyası ile yeniden ulaşın.'],
  ['Hiç alışveriş yok', 'var(--tx3)', 'Kayıtlı ama henüz satın almamış.', 'İlk alışveriş için davet edin.'],
]
const money = (n: number) => `${Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`

export default function AnalizPage() {
  const supabase = createCrmBrowserClient()
  const [store, setStore] = useState('')
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [sum, setSum] = useState<S[] | null>(null)
  const [sel, setSel] = useState('')
  const [list, setList] = useState<C[]>([])
  const [err, setErr] = useState('')

  useEffect(() => { supabase.from('stores').select('id, name').order('name').then(({ data }) => setStores((data || []) as any)) }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('rfm_summary', { p_store: store || null })
    if (error) { setErr(error.message); return }
    setErr(''); setSum(((data || []) as any[]).map(r => ({ ...r, customers: Number(r.customers), total_spent: Number(r.total_spent), avg_spent: Number(r.avg_spent) })))
  }, [store])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); setSel(''); setList([]) }, [load])
  useEffect(() => {
    if (!sel) return
    supabase.rpc('rfm_customers', { p_store: store || null, p_segment: sel, p_limit: 300 }).then(({ data }) => setList((data || []) as C[]))
  }, [sel, store])  // eslint-disable-line react-hooks/exhaustive-deps

  const by = new Map((sum || []).map(s => [s.segment, s]))
  const total = (sum || []).reduce((a, s) => a + s.customers, 0)
  const revenue = (sum || []).reduce((a, s) => a + s.total_spent, 0)
  const csv = () => {
    const rows = [['Ad', 'Telefon', 'Şehir', 'Sipariş', 'Toplam harcama', 'Son alışveriş'], ...list.map(c => [c.name, c.phone || '', c.city || '', String(c.order_count), String(c.total_spent), c.last_purchase_at ? c.last_purchase_at.slice(0, 10) : ''])]
    const text = '﻿' + rows.map(r => r.map(v => `"${(/^[=+\-@\t\r]/.test(v) ? "'" : '') + v.replace(/"/g, '""')}"`).join(';')).join('\n')
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' })); a.download = `${sel}-musteriler.csv`; a.click()
  }

  return (
    <>
      <CrmTopBar title="Müşteri Analizi" subtitle="RFM segmentleri" />
      <div style={{ padding: '24px 28px 40px', maxWidth: 1180, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: 'var(--tx3)', maxWidth: 620 }}>Müşteriler son alışveriş zamanına, alışveriş sıklığına ve toplam harcamaya göre gruplanır. Bir gruba tıklayıp müşterilerini görün; listeyi Excel'e uyumlu CSV olarak indirip kampanya hedefi yapın.</div>
          {stores.length > 1 && <select className="inp" style={{ width: 200 }} value={store} onChange={e => setStore(e.target.value)}><option value="">Tüm mağazalar</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>}
        </div>
        {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
        {sum && total === 0 ? <div className="card"><Empty Icon={PieChart} title="Analiz için veri yok" desc="Müşteriler ve siparişler yüklendiğinde segmentler otomatik hesaplanır." action={<Link className="btn" href="/crm/iceaktar">Excel ile yükle</Link>} /></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 14 }}>
            {META.map(([name, color, desc, tip]) => {
              const s = by.get(name); const n = s?.customers || 0
              return (
                <button key={name} onClick={() => n && setSel(sel === name ? '' : name)} className="card" style={{ textAlign: 'left', padding: 18, cursor: n ? 'pointer' : 'default', borderColor: sel === name ? 'var(--ac)' : undefined, background: 'var(--s1)', color: 'inherit', font: 'inherit' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}><i style={{ width: 9, height: 9, borderRadius: '50%', background: color }} />{name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 10 }}><span style={{ fontSize: 30, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-.04em', color: 'var(--tx)' }}>{n.toLocaleString('tr-TR')}</span><span style={{ fontSize: 12.5, color: 'var(--tx3)' }}>{total ? `%${Math.round((n / total) * 100)} müşteri` : ''}</span></div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--s3)', margin: '8px 0' }}><div style={{ width: `${revenue ? ((s?.total_spent || 0) / revenue) * 100 : 0}%`, height: '100%', borderRadius: 2, background: color }} /></div>
                  <div style={{ fontSize: 12.5, color: 'var(--tx2)' }}>{money(s?.total_spent || 0)} ciro{n ? ` · ort. ${money(s?.avg_spent || 0)}` : ''}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--tx3)', marginTop: 8 }}>{desc}</div>
                  <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginTop: 4 }}><b style={{ fontWeight: 600 }}>Öneri:</b> {tip}</div>
                </button>)
            })}
          </div>)}
        {sel && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}><div className="card-title">{sel} · ilk {list.length} müşteri</div><button className="btn-ghost" onClick={csv}><Download size={14} /> CSV indir</button></div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)', fontSize: 12.5 }}>{['Müşteri', 'Telefon', 'Şehir', 'Sipariş', 'Harcama', 'Son alışveriş'].map(h => <th key={h} style={{ padding: '8px 18px', fontWeight: 500 }}>{h}</th>)}</tr></thead>
              <tbody>{list.map(c => <tr key={c.id} style={{ borderTop: '1px solid var(--bdr)' }}><td style={{ padding: '10px 18px' }}><Link href={`/crm/musteriler/${c.id}`} style={{ color: 'var(--tx)', fontWeight: 600 }}>{c.name}</Link></td><td style={{ padding: '10px 18px' }}>{c.phone || '—'}</td><td style={{ padding: '10px 18px' }}>{c.city || '—'}</td><td style={{ padding: '10px 18px' }}>{c.order_count}</td><td style={{ padding: '10px 18px' }}>{money(c.total_spent)}</td><td style={{ padding: '10px 18px' }}>{c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('tr-TR') : '—'}</td></tr>)}</tbody>
            </table>
          </div>)}
      </div>
    </>
  )
}
