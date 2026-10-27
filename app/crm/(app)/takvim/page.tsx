'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronLeft, ChevronRight, CheckSquare, CalendarDays, Cake } from 'lucide-react'
import { addMonths, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek, eachDayOfInterval } from 'date-fns'
import { tr } from 'date-fns/locale'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Ev = { id: string; kind: 'task' | 'appt' | 'bday'; at: Date; title: string; sub: string; href: string; done?: boolean; late?: boolean }
const COLOR = { task: 'var(--blue)', appt: 'var(--ac)', bday: 'var(--amber)' }
const LABEL = { task: 'Görevler', appt: 'Randevular', bday: 'Özel günler' }
const ICON = { task: CheckSquare, appt: CalendarDays, bday: Cake }

export default function TakvimPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const can = { task: crm.can('tasks.read'), appt: crm.can('appointments.read'), bday: crm.can('customers.read') }
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [sel, setSel] = useState(() => new Date())
  const [evs, setEvs] = useState<Ev[]>([])
  const [on, setOn] = useState({ task: true, appt: true, bday: true })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const from = startOfWeek(month, { weekStartsOn: 1 }), to = endOfWeek(endOfMonth(month), { weekStartsOn: 1 })
    const out: Ev[] = []
    const jobs: PromiseLike<void>[] = []
    if (can.task) jobs.push(supabase.from('tasks').select('id, title, status, due_at, customers(first_name, last_name)').gte('due_at', from.toISOString()).lte('due_at', to.toISOString()).neq('status', 'cancelled').limit(1000)
      .then(r => { (r.data || []).forEach((t: any) => out.push({ id: t.id, kind: 'task', at: new Date(t.due_at), title: t.title, sub: t.customers ? `${t.customers.first_name} ${t.customers.last_name}` : '', href: '/crm/gorevler', done: t.status === 'done', late: t.status !== 'done' && new Date(t.due_at) < new Date() })) }))
    if (can.appt) jobs.push(supabase.from('appointments').select('id, starts_at, status, purpose, customers(first_name, last_name)').gte('starts_at', from.toISOString()).lte('starts_at', to.toISOString()).neq('status', 'cancelled').limit(1000)
      .then(r => { (r.data || []).forEach((a: any) => out.push({ id: a.id, kind: 'appt', at: new Date(a.starts_at), title: a.customers ? `${a.customers.first_name} ${a.customers.last_name}` : 'Randevu', sub: a.purpose || '', href: '/crm/randevular', done: a.status === 'completed' })) }))
    if (can.bday) jobs.push(supabase.rpc('special_days', { p_days: 366 }).then(r => {
      ;((r.data || []) as any[]).forEach(b => { const d = new Date(b.next_date + 'T09:00:00'); if (d >= from && d <= to) out.push({ id: b.customer_id, kind: 'bday', at: d, title: b.name, sub: `${b.turning} yaş`, href: `/crm/musteriler/${b.customer_id}` }) })
    }))
    await Promise.all(jobs)
    out.sort((a, b) => a.at.getTime() - b.at.getTime())
    setEvs(out); setLoading(false)
  }, [month])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(month, { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }), [month])
  const visible = evs.filter(e => on[e.kind])
  const dayEvs = (d: Date) => visible.filter(e => isSameDay(e.at, d))
  const selEvs = dayEvs(sel)
  const hhmm = (e: Ev) => e.kind === 'bday' ? '' : format(e.at, 'HH:mm')

  return (
    <>
      <CrmTopBar title="Takvim" subtitle={format(month, 'LLLL yyyy', { locale: tr })}
        action={<div style={{ display: 'flex', gap: 6 }}>
          <button className="btn-ghost" onClick={() => setMonth(addMonths(month, -1))} aria-label="Önceki ay"><ChevronLeft size={15} /></button>
          <button className="btn-ghost" onClick={() => { setMonth(startOfMonth(new Date())); setSel(new Date()) }}>Bugün</button>
          <button className="btn-ghost" onClick={() => setMonth(addMonths(month, 1))} aria-label="Sonraki ay"><ChevronRight size={15} /></button></div>} />
      <div style={{ padding: 22, maxWidth: 1200, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(['task', 'appt', 'bday'] as const).filter(k => can[k]).map(k => {
            const I = ICON[k]
            return <button key={k} onClick={() => setOn({ ...on, [k]: !on[k] })} className="badge" style={{ cursor: 'pointer', border: `1px solid ${COLOR[k]}`, background: on[k] ? COLOR[k] : 'transparent', color: on[k] ? '#fff' : COLOR[k], padding: '5px 12px', gap: 6 }}><I size={12} /> {LABEL[k]}</button>
          })}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 300px', gap: 14, alignItems: 'start' }} className="cal-grid">
          <div className="card" style={{ overflow: 'hidden', opacity: loading ? .6 : 1 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', background: 'var(--s2)' }}>
              {['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'].map(d => <div key={d} style={{ padding: '8px 10px', fontSize: 11.5, fontWeight: 600, color: 'var(--tx3)' }}>{d}</div>)}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)' }}>
              {days.map(d => {
                const list = dayEvs(d), today = isSameDay(d, new Date()), active = isSameDay(d, sel)
                return (
                  <button key={d.toISOString()} onClick={() => setSel(d)} style={{ minHeight: 92, textAlign: 'left', padding: 6, border: 'none', borderTop: '1px solid var(--bdr)', borderLeft: '1px solid var(--bdr)', background: active ? 'var(--ac2)' : 'transparent', opacity: isSameMonth(d, month) ? 1 : .45, cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                    <span style={{ fontSize: 12, fontWeight: today ? 700 : 500, color: today ? '#fff' : 'var(--tx2)', background: today ? 'var(--ac)' : 'transparent', borderRadius: 99, width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{format(d, 'd')}</span>
                    {list.slice(0, 3).map(e => <span key={e.kind + e.id} style={{ fontSize: 10.5, color: '#fff', background: e.done ? 'var(--tx3)' : e.late ? 'var(--red)' : COLOR[e.kind], borderRadius: 4, padding: '1px 5px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: e.done ? 'line-through' : 'none' }}>{hhmm(e)} {e.title}</span>)}
                    {list.length > 3 && <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>+{list.length - 3} daha</span>}
                  </button>)
              })}
            </div>
          </div>
          <div className="card" style={{ padding: 14 }}>
            <div className="card-title" style={{ marginBottom: 10 }}>{format(sel, 'd MMMM EEEE', { locale: tr })}</div>
            {selEvs.length === 0 ? <div style={{ fontSize: 13, color: 'var(--tx3)', padding: '14px 0' }}>Bu gün için kayıt yok</div> : selEvs.map(e => {
              const I = ICON[e.kind]
              return (
                <Link key={e.kind + e.id} href={e.href} style={{ display: 'flex', gap: 10, padding: '9px 0', borderTop: '1px solid var(--bdr)', textDecoration: 'none' }}>
                  <I size={15} style={{ color: COLOR[e.kind], marginTop: 2, flexShrink: 0 }} />
                  <span style={{ minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)', textDecoration: e.done ? 'line-through' : 'none' }}>{hhmm(e) && <span style={{ color: 'var(--tx3)', fontWeight: 500 }}>{hhmm(e)} · </span>}{e.title}</div>
                    {e.sub && <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{e.sub}</div>}</span>
                </Link>)
            })}
          </div>
        </div>
      </div>
      <style>{`@media(max-width:900px){.cal-grid{grid-template-columns:1fr!important}}`}</style>
    </>
  )
}
