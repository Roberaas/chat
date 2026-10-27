'use client'
import { useCallback, useEffect, useState } from 'react'
import { Wallet, X } from 'lucide-react'
import { format } from 'date-fns'
import CrmTopBar from '@/components/crm/CrmTopBar'
import Empty from '@/components/crm/Empty'
import { Kpi, KpiStrip } from '@/components/crm/Kpi'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Row = { store_id: string; store_name: string; store_code: string; credit_limit: number; balance: number; available: number; used_pct: number | null; payment_term_days: number; overdue: number }
type Led = { id: number; entry_type: string; amount: number; note: string | null; created_at: string }
const money = (n: number) => n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const TYPE: Record<string, string> = { order: 'Sipariş', payment: 'Tahsilat', adjustment: 'Düzeltme' }

export default function CariPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const canManage = crm.can('credit.manage')
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [lim, setLim] = useState<{ row: Row; limit: string; term: string; notify: string } | null>(null)
  const [pay, setPay] = useState<{ row: Row; kind: 'payment' | 'adjustment'; amount: string; note: string } | null>(null)
  const [led, setLed] = useState<{ row: Row; items: Led[] } | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('credit_summary')
    setRows(((data || []) as any[]).map(r => ({ ...r, credit_limit: Number(r.credit_limit), balance: Number(r.balance), available: Number(r.available), used_pct: r.used_pct == null ? null : Number(r.used_pct), overdue: Number(r.overdue) })))
    setLoading(false)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const total = rows.reduce((a, r) => a + r.balance, 0)
  const over = rows.filter(r => r.credit_limit > 0 && r.balance > r.credit_limit).length
  const overdue = rows.reduce((a, r) => a + r.overdue, 0)

  async function saveLimit() {
    if (!lim) return
    const l = Number(lim.limit.replace(',', '.')), t = Number(lim.term), n = Number(lim.notify)
    if ([l, t, n].some(isNaN) || l < 0 || t < 0 || t > 365 || n < 1 || n > 100) { setErr('Değerleri kontrol edin'); return }
    const { error } = await supabase.from('store_credit').upsert({ store_id: lim.row.store_id, credit_limit: l, payment_term_days: t, notify_pct: n })
    if (error) { setErr(error.message); return }
    setErr(''); setLim(null); load()
  }
  async function savePay() {
    if (!pay) return
    const a = Number(pay.amount.replace(',', '.'))
    if (isNaN(a) || a === 0 || (pay.kind === 'payment' && a < 0)) { setErr('Geçerli bir tutar girin'); return }
    const { error } = await supabase.from('store_ledger').insert({ store_id: pay.row.store_id, entry_type: pay.kind, amount: a, note: pay.note.trim() || null })
    if (error) { setErr(error.message); return }
    setErr(''); setPay(null); load()
  }
  async function openLedger(row: Row) {
    const { data } = await supabase.from('store_ledger').select('id, entry_type, amount, note, created_at').eq('store_id', row.store_id).order('created_at', { ascending: false }).limit(100)
    setLed({ row, items: (data || []) as Led[] })
  }

  return (
    <>
      <CrmTopBar title="Cari ve Kredi Limiti" subtitle="Bayi / toptancı bakiyeleri" />
      <div style={{ padding: 22, maxWidth: 1200, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <KpiStrip>
          <Kpi label="Toplam açık bakiye" value={`₺${money(total)}`} tone="blue" />
          <Kpi label="Vadesi geçen" value={`₺${money(overdue)}`} tone={overdue > 0 ? 'red' : 'green'} sub="vade gününü aşan, tahsil edilmemiş" />
          <Kpi label="Limiti aşan bayi" value={over} tone={over > 0 ? 'red' : 'green'} />
          <Kpi label="Bayi sayısı" value={rows.length} tone="ac" />
        </KpiStrip>
        <div className="card" style={{ fontSize: 12.5, color: 'var(--tx3)', padding: 12 }}>Bayi/toptancı mağazasına düşen her sipariş bakiyeye yazılır; iptal/iade bakiyeyi geri alır. Tahsilatı buradan girin. Limit doluluğu eşiği geçince yöneticilere bildirim gider; sipariş engellenmez (ERP/e-ticaret akışı bozulmasın diye).</div>
        {loading ? <div className="card anim-pulse" style={{ height: 160 }} /> : rows.length === 0 ? (
          <div className="card"><Empty Icon={Wallet} title="Bayi / toptancı yok" desc="Mağazalar sayfasında türü Bayi veya Toptancı olan bir birim ekleyin." /></div>
        ) : (
          <div className="card" style={{ overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 760 }}>
              <thead><tr style={{ color: 'var(--tx3)', fontSize: 11.5, textAlign: 'left' }}>{['Bayi', 'Limit', 'Bakiye', 'Kullanılabilir', 'Doluluk', 'Vade', 'Vadesi geçen', ''].map(h => <th key={h} style={{ padding: '10px 14px' }}>{h}</th>)}</tr></thead>
              <tbody>{rows.map(r => {
                const pct = r.used_pct ?? 0, hot = r.credit_limit > 0 && pct >= 90
                return (
                  <tr key={r.store_id} style={{ borderTop: '1px solid var(--bdr)' }}>
                    <td style={{ padding: '10px 14px' }}><div style={{ fontWeight: 600, color: 'var(--tx)' }}>{r.store_name}</div><code style={{ fontSize: 11 }}>{r.store_code}</code></td>
                    <td style={{ padding: '10px 14px' }}>{r.credit_limit > 0 ? `₺${money(r.credit_limit)}` : <span style={{ color: 'var(--tx3)' }}>tanımsız</span>}</td>
                    <td style={{ padding: '10px 14px', fontWeight: 600 }}>₺{money(r.balance)}</td>
                    <td style={{ padding: '10px 14px', color: r.available < 0 ? 'var(--red)' : 'var(--tx2)' }}>{r.credit_limit > 0 ? `₺${money(r.available)}` : '—'}</td>
                    <td style={{ padding: '10px 14px', minWidth: 120 }}>{r.credit_limit > 0 ? <div><div style={{ height: 6, borderRadius: 3, background: 'var(--s3)', overflow: 'hidden' }}><div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: hot ? 'var(--red)' : pct >= 70 ? 'var(--amber)' : 'var(--green)' }} /></div><div style={{ fontSize: 11, color: 'var(--tx3)', marginTop: 3 }}>%{pct}</div></div> : '—'}</td>
                    <td style={{ padding: '10px 14px', color: 'var(--tx2)' }}>{r.payment_term_days} gün</td>
                    <td style={{ padding: '10px 14px', color: r.overdue > 0 ? 'var(--red)' : 'var(--tx3)' }}>{r.overdue > 0 ? `₺${money(r.overdue)}` : '—'}</td>
                    <td style={{ padding: '10px 14px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                      <button className="btn-ghost" onClick={() => openLedger(r)}>Hareketler</button>{' '}
                      {canManage && <><button className="btn-ghost" onClick={() => { setLim({ row: r, limit: String(r.credit_limit || ''), term: String(r.payment_term_days), notify: '90' }); setErr('') }}>Limit</button>{' '}
                        <button className="btn" onClick={() => { setPay({ row: r, kind: 'payment', amount: '', note: '' }); setErr('') }}>Tahsilat</button></>}
                    </td>
                  </tr>) })}</tbody>
            </table>
          </div>)}
      </div>

      {lim && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setLim(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{lim.row.store_name} · Limit</h2><button onClick={() => setLim(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Kredi limiti (₺, 0 = takip yok)</label><input className="inp" inputMode="decimal" value={lim.limit} onChange={e => setLim({ ...lim, limit: e.target.value })} /></div>
              <div className="modal-grid">
                <div><label className="label">Vade (gün)</label><input className="inp" inputMode="numeric" value={lim.term} onChange={e => setLim({ ...lim, term: e.target.value })} /></div>
                <div><label className="label">Bildirim eşiği %</label><input className="inp" inputMode="numeric" value={lim.notify} onChange={e => setLim({ ...lim, notify: e.target.value })} /></div>
              </div>
              {err && <div className="toast toast-err" style={{ margin: 0 }}>{err}</div>}
              <button className="btn" onClick={saveLimit} style={{ justifyContent: 'center', padding: '11px 0' }}>Kaydet</button>
            </div>
          </div>
        </div>)}
      {pay && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setPay(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 400 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{pay.row.store_name}</h2><button onClick={() => setPay(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="seg"><button className={pay.kind === 'payment' ? 'on' : ''} onClick={() => setPay({ ...pay, kind: 'payment' })}>Tahsilat</button><button className={pay.kind === 'adjustment' ? 'on' : ''} onClick={() => setPay({ ...pay, kind: 'adjustment' })}>Düzeltme</button></div>
              <div><label className="label">Tutar (₺){pay.kind === 'adjustment' ? ' — borç artırmak +, azaltmak −' : ''}</label><input className="inp" inputMode="decimal" value={pay.amount} onChange={e => setPay({ ...pay, amount: e.target.value })} /></div>
              <div><label className="label">Not</label><input className="inp" value={pay.note} onChange={e => setPay({ ...pay, note: e.target.value })} placeholder="Havale, çek no, açıklama…" /></div>
              {err && <div className="toast toast-err" style={{ margin: 0 }}>{err}</div>}
              <button className="btn" onClick={savePay} style={{ justifyContent: 'center', padding: '11px 0' }}>Kaydet</button>
            </div>
          </div>
        </div>)}
      {led && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setLed(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 560 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{led.row.store_name} · Hareketler</h2><button onClick={() => setLed(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ maxHeight: '60vh', overflow: 'auto', border: '1px solid var(--bdr)', borderRadius: 10 }}>
              {led.items.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Hareket yok</div>}
              {led.items.map(i => <div key={i.id} className="row" style={{ justifyContent: 'space-between', fontSize: 13 }}>
                <span><span className={`badge ${i.entry_type === 'payment' ? 'badge-green' : i.entry_type === 'order' ? 'badge-blue' : 'badge-amber'}`}>{TYPE[i.entry_type]}</span> <span style={{ color: 'var(--tx2)', marginLeft: 6 }}>{i.note || ''}</span><div style={{ fontSize: 11, color: 'var(--tx3)' }}>{format(new Date(i.created_at), 'dd.MM.yyyy HH:mm')}</div></span>
                <b style={{ color: i.amount < 0 ? 'var(--green)' : 'var(--tx)' }}>{i.amount < 0 ? '−' : '+'}₺{money(Math.abs(Number(i.amount)))}</b></div>)}
            </div>
          </div>
        </div>)}
    </>
  )
}
