'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, X, Check, Trash2 } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Task = { id: string; title: string; description: string | null; status: string; priority: string; due_at: string | null; assignee_id: string | null; store_id: string | null; customer_id: string | null; created_by: string | null; customers: { first_name: string; last_name: string } | null }
type Person = { id: string; first_name: string; last_name: string }
const STATUS: Record<string, string> = { pending: 'Bekliyor', in_progress: 'Devam ediyor', done: 'Tamamlandı', cancelled: 'İptal edildi' }
const PRIO: Record<string, [string, string]> = { low: ['Düşük', 'badge-muted'], normal: ['Normal', 'badge-blue'], high: ['Yüksek', 'badge-red'] }
const isOverdue = (t: Task) => !!t.due_at && new Date(t.due_at) < new Date() && (t.status === 'pending' || t.status === 'in_progress')
const EMPTY = { title: '', description: '', priority: 'normal', due: '', assignee_id: '', store_id: '' }

export default function GorevlerPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const canWrite = crm.can('tasks.write')
  const team = crm.can('tasks.team')
  const [tasks, setTasks] = useState<Task[]>([])
  const [people, setPeople] = useState<Person[]>([])
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [scope, setScope] = useState<'mine' | 'all'>('mine')
  const [statusF, setStatusF] = useState<'open' | 'overdue' | 'done' | 'all'>('open')
  const [form, setForm] = useState<(typeof EMPTY & { show: boolean }) | null>(null)
  const [err, setErr] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const [t, p, s] = await Promise.all([
      supabase.from('tasks').select('*, customers(first_name, last_name)').order('due_at', { ascending: true, nullsFirst: false }).limit(500),
      supabase.from('profiles').select('id, first_name, last_name').eq('is_active', true),
      supabase.from('stores').select('id, name').eq('is_active', true),
    ])
    setTasks((t.data || []) as unknown as Task[]); setPeople((p.data || []) as Person[]); setStores((s.data || []) as any); setLoading(false)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  const pname = (id: string | null) => { const p = people.find(x => x.id === id); return p ? `${p.first_name} ${p.last_name}` : '—' }
  const shown = tasks.filter(t =>
    (scope === 'all' || t.assignee_id === crm.profile.id) &&
    (statusF === 'all' || (statusF === 'open' && (t.status === 'pending' || t.status === 'in_progress')) || (statusF === 'done' && (t.status === 'done' || t.status === 'cancelled')) || (statusF === 'overdue' && isOverdue(t))))

  async function setStatus(id: string, status: string) { const { error } = await supabase.from('tasks').update({ status }).eq('id', id); if (error) setErr(error.message); else { setErr(''); load() } }
  async function del(id: string) { const { error } = await supabase.from('tasks').delete().eq('id', id); if (error) setErr(error.message); else load() }
  async function create() {
    if (!form || !form.title.trim()) { setErr('Başlık zorunlu'); return }
    const { error } = await supabase.from('tasks').insert({
      title: form.title, description: form.description.trim() || null, priority: form.priority,
      due_at: form.due ? new Date(form.due).toISOString() : null, assignee_id: form.assignee_id || crm.profile.id, store_id: form.store_id || null,
    })
    if (error) { setErr(error.message); return }
    setErr(''); setForm(null); load()
  }

  return (
    <>
      <CrmTopBar title="Görevler" subtitle={`${shown.length} görev`} action={canWrite && <button className="btn" onClick={() => { setForm({ ...EMPTY, show: true }); setErr('') }}><Plus size={14} /> Görev Ekle</button>} />
      <div style={{ padding: 22, maxWidth: 1100, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 12, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
          {team && <><button className={scope === 'mine' ? 'btn' : 'btn-ghost'} onClick={() => setScope('mine')}>Benim</button><button className={scope === 'all' ? 'btn' : 'btn-ghost'} onClick={() => setScope('all')}>Ekip</button></>}
          <select className="inp" style={{ width: 160 }} value={statusF} onChange={e => setStatusF(e.target.value as any)}><option value="open">Açık</option><option value="overdue">Gecikti</option><option value="done">Kapalı</option><option value="all">Tümü</option></select>
          {err && <span style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</span>}
        </div>
        <div className="card">
          {loading ? <div className="anim-pulse" style={{ height: 100 }} /> : shown.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Görev yok</div> : shown.map(t => {
            const od = isOverdue(t)
            return (
              <div key={t.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--bdr)' }}>
                {canWrite && <button className="btn-ghost" disabled={t.status === 'done'} title="Tamamla" onClick={() => setStatus(t.id, 'done')} style={{ padding: '5px 7px' }}><Check size={14} /></button>}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: t.status === 'done' ? 'var(--tx3)' : 'var(--tx)', textDecoration: t.status === 'done' ? 'line-through' : 'none' }}>{t.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--tx3)' }}>
                    {pname(t.assignee_id)}{t.customers && <> · <Link href={`/crm/musteriler/${t.customer_id}`} style={{ color: 'var(--ac)' }}>{t.customers.first_name} {t.customers.last_name}</Link></>}
                    {t.due_at && <span style={{ color: od ? 'var(--red)' : 'var(--tx3)' }}> · {new Date(t.due_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span>}
                  </div>
                </div>
                {od && <span className="badge badge-red">Gecikti</span>}
                <span className={`badge ${PRIO[t.priority][1]}`}>{PRIO[t.priority][0]}</span>
                {canWrite ? <select className="inp" style={{ width: 140 }} value={t.status} onChange={e => setStatus(t.id, e.target.value)}>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select> : <span className="badge badge-muted">{STATUS[t.status]}</span>}
                {canWrite && (t.created_by === crm.profile.id || crm.isSuperAdmin) && <button onClick={() => del(t.id)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><Trash2 size={14} /></button>}
              </div>)
          })}
        </div>
      </div>
      {form?.show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>Görev Ekle</h2><button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Başlık *</label><input className="inp" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              <div><label className="label">Açıklama</label><textarea className="inp" rows={2} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
              <div className="modal-grid">
                <div><label className="label">Öncelik</label><select className="inp" value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{Object.entries(PRIO).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}</select></div>
                <div><label className="label">Son tarih</label><input className="inp" type="datetime-local" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} /></div>
              </div>
              <div className="modal-grid">
                <div><label className="label">Mağaza</label><select className="inp" value={form.store_id} onChange={e => setForm({ ...form, store_id: e.target.value })}><option value="">—</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
                {team && <div><label className="label">Atanan</label><select className="inp" value={form.assignee_id} onChange={e => setForm({ ...form, assignee_id: e.target.value })}><option value="">Ben</option>{people.map(p => <option key={p.id} value={p.id}>{p.first_name} {p.last_name}</option>)}</select></div>}
              </div>
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setForm(null)}>Vazgeç</button><button className="btn" onClick={create}>Kaydet</button></div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
