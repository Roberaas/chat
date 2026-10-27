'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { GitMerge, CheckCheck } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import Empty from '@/components/crm/Empty'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type P = { a_id: string; b_id: string; a_name: string; b_name: string; a_phone: string | null; b_phone: string | null; a_email: string | null; b_email: string | null; a_store: string | null; b_store: string | null; a_orders: number; b_orders: number }

export default function MukerrerlerPage() {
  const supabase = createCrmBrowserClient()
  const [rows, setRows] = useState<P[] | null>(null)
  const [ask, setAsk] = useState('')
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('find_duplicates', { p_limit: 200 })
    if (error) { setErr(error.message); return }
    setErr(''); setRows((data || []) as P[])
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  async function merge(primary: string, secondary: string) {
    const { error } = await supabase.rpc('merge_customers', { p_primary: primary, p_secondary: secondary, p_reason: 'Mükerrer kayıt ekranından birleştirildi' })
    if (error) { setErr(error.message); return }
    setAsk(''); setMsg('Kayıtlar birleştirildi. Sipariş, not ve görevler ana kayda taşındı.'); load()
  }
  const side = (id: string, name: string, phone: string | null, email: string | null, store: string | null, orders: number, other: string, label: string) => {
    const key = `${id}>${other}`
    return (
      <div style={{ flex: 1, minWidth: 240, padding: 16 }}>
        <Link href={`/crm/musteriler/${id}`} style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--tx)' }}>{name}</Link>
        <div style={{ fontSize: 12.5, color: 'var(--tx3)', lineHeight: 1.7, margin: '4px 0 12px' }}>{phone || 'Telefon yok'}<br />{email || 'E-posta yok'}<br />{store || '—'} · {orders} sipariş</div>
        {ask === key ? <button className="btn" onClick={() => merge(id, other)}><CheckCheck size={14} /> Onayla, birleştir</button> : <button className="btn-ghost" onClick={() => setAsk(key)}>{label}</button>}
      </div>)
  }
  return (
    <>
      <CrmTopBar title="Mükerrer Kayıtlar" subtitle={rows ? `${rows.length} aday` : undefined} />
      <div style={{ padding: '24px 28px 40px', maxWidth: 980, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 13, color: 'var(--tx3)', maxWidth: 640 }}>Aynı ad ve soyadla kayıtlı müşteriler listelenir. İki kayıt aynı kişiyse birini ana kayıt seçin; diğerinin siparişleri, notları ve görevleri ana kayda taşınır. Bu işlem geri alınamaz ve denetim kaydına yazılır.</div>
        {msg && <div className="toast toast-ok" style={{ margin: 0 }}>{msg}</div>}
        {err && <div className="toast toast-err" style={{ margin: 0 }}>{err}</div>}
        {rows && rows.length === 0 && <div className="card"><Empty Icon={GitMerge} title="Mükerrer aday yok" desc="Aynı ad ve soyada sahip birden fazla kayıt bulunmuyor." /></div>}
        {(rows || []).map(r => (
          <div key={r.a_id + r.b_id} className="card" style={{ display: 'flex', flexWrap: 'wrap' }}>
            {side(r.a_id, r.a_name, r.a_phone, r.a_email, r.a_store, r.a_orders, r.b_id, 'Bunu ana kayıt yap')}
            <div style={{ width: 1, background: 'var(--bdr)' }} />
            {side(r.b_id, r.b_name, r.b_phone, r.b_email, r.b_store, r.b_orders, r.a_id, 'Bunu ana kayıt yap')}
          </div>))}
      </div>
    </>
  )
}
