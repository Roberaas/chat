'use client'
import { useCallback, useEffect, useState } from 'react'
import { Flag, Plus, X } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import Empty from '@/components/crm/Empty'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type T = { id: string; period: string; store_id: string | null; store_name: string | null; advisor_id: string | null; advisor_name: string | null; target: number; actual: number }
const money = (n: number) => `${Number(n).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺`
const monthStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

export default function HedeflerPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const canManage = crm.can('targets.manage')
  const [month, setMonth] = useState(monthStr(new Date()))
  const [rows, setRows] = useState<T[]>([])
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [people, setPeople] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState<{ id: string; store_id: string; advisor_id: string; amount: string } | null>(null)
  const [err, setErr] = useState('')
  const [del, setDel] = useState('')

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('target_progress', { p_period: `${month}-01` })
    if (error) { setErr(error.message); return }
    setErr(''); setRows(((data || []) as any[]).map(r => ({ ...r, target: Number(r.target), actual: Number(r.actual) })))
  }, [month])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])
  useEffect(() => {
    supabase.from('stores').select('id, name').eq('is_active', true).order('name').then(({ data }) => setStores((data || []) as any))
    supabase.from('profiles').select('id, first_name, last_name').eq('is_active', true).order('first_name').then(({ data }) => setPeople(((data || []) as any[]).map(p => ({ id: p.id, name: `${p.first_name} ${p.last_name}`.trim() }))))
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!form) return
    const amount = Number(form.amount.replace(',', '.'))
    if (!form.store_id || !(amount >= 0) || !form.amount.trim()) { setErr('Mağaza ve tutar zorunlu'); return }
    const payload = { amount, advisor_id: form.advisor_id || null }
    const { error } = form.id ? await supabase.from('sales_targets').update({ amount }).eq('id', form.id)
      : await supabase.from('sales_targets').insert({ ...payload, store_id: form.store_id, period: `${month}-01`, created_by: crm.userId })
    if (error) { setErr(error.code === '23505' ? 'Bu dönem için aynı hedef zaten var' : error.message); return }
    setErr(''); setForm(null); load()
  }
  async function remove(id: string) { await supabase.from('sales_targets').delete().eq('id', id); setDel(''); load() }

  const [y, m] = month.split('-').map(Number)
  const dim = new Date(y, m, 0).getDate()
  const isCurrent = month === monthStr(new Date())
  const day = isCurrent ? new Date().getDate() : month < monthStr(new Date()) ? dim : 0
  const pace = day / dim
  const totalT = rows.filter(r => !r.advisor_id).reduce((a, r) => a + r.target, 0)
  const totalA = rows.filter(r => !r.advisor_id).reduce((a, r) => a + r.actual, 0)

  return (
    <>
      <CrmTopBar title="Hedefler" subtitle="Aylık satış hedefleri" action={canManage ? <button className="btn" onClick={() => { setErr(''); setForm({ id: '', store_id: stores.length === 1 ? stores[0].id : '', advisor_id: '', amount: '' }) }}><Plus size={14} /> Hedef ekle</button> : undefined} />
      <div style={{ padding: '24px 28px 40px', maxWidth: 1000, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <input className="inp" type="month" style={{ width: 170 }} value={month} onChange={e => e.target.value && setMonth(e.target.value)} />
          {rows.some(r => !r.advisor_id) && <div style={{ fontSize: 13.5, color: 'var(--tx2)' }}>Mağaza hedefleri toplamı: <b style={{ color: 'var(--tx)' }}>{money(totalA)}</b> / {money(totalT)} · %{totalT ? Math.round((totalA / totalT) * 100) : 0}</div>}
        </div>
        {err && !form && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
        {rows.length === 0 ? <div className="card"><Empty Icon={Flag} title="Bu ay için hedef yok" desc={canManage ? 'Mağaza veya danışman için aylık ciro hedefi ekleyin; ilerleme siparişlerden otomatik hesaplanır.' : 'Yöneticiniz hedef girdiğinde burada görünür.'} action={canManage ? <button className="btn" onClick={() => setForm({ id: '', store_id: stores.length === 1 ? stores[0].id : '', advisor_id: '', amount: '' })}><Plus size={14} /> Hedef ekle</button> : undefined} /></div> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 14 }}>
            {rows.map(r => {
              const pct = r.target ? r.actual / r.target : 0
              const behind = isCurrent && pct < pace - 0.1
              const color = pct >= 1 ? 'var(--green)' : behind ? 'var(--amber)' : 'var(--ac)'
              return (
                <div key={r.id} className="card" style={{ padding: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                    <div><div style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--tx)' }}>{r.advisor_name || r.store_name}</div><div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>{r.advisor_name ? `Danışman · ${r.store_name}` : 'Mağaza / bayi'}</div></div>
                    {canManage && <div style={{ display: 'flex', gap: 4 }}>
                      <button className="btn-ghost" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => { setErr(''); setForm({ id: r.id, store_id: r.store_id || '', advisor_id: r.advisor_id || '', amount: String(r.target) }) }}>Düzenle</button>
                      {del === r.id ? <button className="btn-danger" style={{ padding: '3px 9px', fontSize: 12 }} onClick={() => remove(r.id)}>Sil</button> : <button className="btn-ghost" style={{ padding: '3px 7px' }} onClick={() => setDel(r.id)} aria-label="Sil"><X size={13} /></button>}
                    </div>}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '14px 0 8px' }}><span style={{ fontSize: 28, fontWeight: 700, fontFamily: 'JetBrains Mono, monospace', letterSpacing: '-.04em', color: 'var(--tx)' }}>%{Math.round(pct * 100)}</span><span style={{ fontSize: 12.5, color: 'var(--tx3)' }}>{pct >= 1 ? 'Hedef aşıldı' : behind ? 'Hedefin gerisinde' : 'Yolunda'}</span></div>
                  <div style={{ position: 'relative', height: 8, borderRadius: 4, background: 'var(--s3)' }}>
                    <div style={{ width: `${Math.min(100, pct * 100)}%`, height: '100%', borderRadius: 4, background: color, transition: 'width .6s' }} />
                    {isCurrent && <i title="Bugünkü beklenen seviye" style={{ position: 'absolute', left: `${pace * 100}%`, top: -3, bottom: -3, width: 2, background: 'var(--tx3)' }} />}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--tx2)', marginTop: 8 }}><span>{money(r.actual)}</span><span>Hedef {money(r.target)}</span></div>
                  {isCurrent && r.target > r.actual && <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 4 }}>Kalan {money(r.target - r.actual)} · {dim - day} gün{day > 0 && <> · tempoyla ay sonu tahmini <b style={{ color: r.actual / pace >= r.target ? 'var(--green)' : 'var(--amber)' }}>{money(r.actual / pace)}</b></>}</div>}
                </div>)
            })}
          </div>)}
      </div>

      {form && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 440 }}>
            <h2 className="modal-title">{form.id ? 'Hedefi düzenle' : 'Hedef ekle'}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label className="label">Mağaza / bayi *</label><select className="inp" disabled={!!form.id} value={form.store_id} onChange={e => setForm({ ...form, store_id: e.target.value })}><option value="">Seçin</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="label">Danışman <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>boş bırakırsanız mağaza hedefi olur</span></label><select className="inp" disabled={!!form.id} value={form.advisor_id} onChange={e => setForm({ ...form, advisor_id: e.target.value })}><option value="">Mağaza hedefi</option>{people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="label">{month} ayı ciro hedefi (₺) *</label><input className="inp" inputMode="decimal" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="500000" /></div>
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setForm(null)}>Vazgeç</button><button className="btn" onClick={save}>Kaydet</button></div>
            </div>
          </div>
        </div>)}
    </>
  )
}
