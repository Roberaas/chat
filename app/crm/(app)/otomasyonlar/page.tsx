'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, X, RotateCw } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Rule = { id: string; name: string; event_type: string; conditions: Record<string, string>; action_type: string; action_config: Record<string, any>; is_active: boolean }
type Exec = { id: number; outbox_id: number; rule_id: string | null; status: string; error: string | null; created_at: string }
type Ev = { id: number; event_type: string; status: string; attempts: number; last_error: string | null; created_at: string }
const EVENTS: Record<string, string> = { customer_created: 'Yeni müşteri', opportunity_stage_changed: 'Fırsat aşaması değişti', order_created: 'Yeni sipariş', service_created: 'Yeni servis talebi', appointment_status_changed: 'Randevu durumu değişti' }
const COND: Record<string, { key: string; opts: [string, string][] } | undefined> = {
  opportunity_stage_changed: { key: 'stage', opts: [['won', 'Kazanıldı'], ['lost', 'Kaybedildi'], ['quote', 'Teklif'], ['appointment', 'Randevu'], ['follow_up', 'Takip']] },
  appointment_status_changed: { key: 'status', opts: [['completed', 'Tamamlandı'], ['no_show', 'Gelmedi'], ['cancelled', 'İptal']] },
  service_created: { key: 'priority', opts: [['high', 'Yüksek öncelik']] },
}
const EMPTY = { id: '', name: '', event_type: 'customer_created', cond: '', action_type: 'create_task', title: '', assignee: 'customer_advisor', due: '24' }

export default function OtomasyonlarPage() {
  const supabase = createCrmBrowserClient()
  const [rules, setRules] = useState<Rule[]>([])
  const [execs, setExecs] = useState<Exec[]>([])
  const [bad, setBad] = useState<Ev[]>([])
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [r, x, b] = await Promise.all([
      supabase.from('automation_rules').select('*').order('created_at'),
      supabase.from('job_executions').select('*').order('created_at', { ascending: false }).limit(30),
      supabase.from('event_outbox').select('id, event_type, status, attempts, last_error, created_at').in('status', ['failed', 'dead']).order('created_at', { ascending: false }).limit(30),
    ])
    setRules((r.data || []) as Rule[]); setExecs((x.data || []) as Exec[]); setBad((b.data || []) as Ev[])
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  async function save() {
    if (!form || !form.name.trim()) { setErr('Ad zorunlu'); return }
    const c = COND[form.event_type]
    const payload = {
      name: form.name.trim(), event_type: form.event_type, conditions: c && form.cond ? { [c.key]: form.cond } : {},
      action_type: form.action_type,
      action_config: { title: form.title.trim() || form.name.trim(), assignee: form.assignee, ...(form.action_type === 'create_task' ? { due_in_hours: Math.max(1, parseInt(form.due) || 24) } : {}) },
    }
    const { error } = form.id ? await supabase.from('automation_rules').update(payload).eq('id', form.id) : await supabase.from('automation_rules').insert(payload)
    if (error) { setErr(error.message); return }
    setErr(''); setForm(null); load()
  }
  async function toggle(r: Rule) { await supabase.from('automation_rules').update({ is_active: !r.is_active }).eq('id', r.id); load() }
  async function del(id: string) { await supabase.from('automation_rules').delete().eq('id', id); load() }
  async function retry(id: number) { const { error } = await supabase.rpc('retry_event', { p_id: id }); if (error) setErr(error.message); else load() }
  const ruleName = (id: string | null) => rules.find(r => r.id === id)?.name || '—'

  return (
    <>
      <CrmTopBar title="Otomasyonlar" subtitle={`${rules.length} kural`} action={<button className="btn" onClick={() => { setErr(''); setForm({ ...EMPTY }) }}><Plus size={14} /> Kural Ekle</button>} />
      <div style={{ padding: 22, maxWidth: 1000, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 12, fontSize: 12.5, color: 'var(--tx2)' }}>Olaylar bir kuyruğa yazılır ve her dakika arka planda işlenir. Başarısız işlemler üstel beklemeyle 5 kez yeniden denenir; sonra "ölü" olarak işaretlenir ve elle yeniden başlatılabilir. Tüm çalıştırmalar aşağıda kayıtlıdır.</div>
        {err && !form && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
        <div className="card">
          {rules.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Henüz kural yok</div> : rules.map(r => (
            <div key={r.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--bdr)' }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{r.name}</div>
                <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{EVENTS[r.event_type]}{Object.keys(r.conditions).length ? ` (${Object.values(r.conditions).join(', ')})` : ''} → {r.action_type === 'create_task' ? `Görev oluştur (${r.action_config.due_in_hours || 24} sa)` : 'Bildirim gönder'}</div></div>
              <span className={`badge ${r.is_active ? 'badge-green' : 'badge-muted'}`}>{r.is_active ? 'Aktif' : 'Pasif'}</span>
              <button className="btn-ghost" onClick={() => toggle(r)}>{r.is_active ? 'Durdur' : 'Başlat'}</button>
              <button className="btn-ghost" onClick={() => setForm({ id: r.id, name: r.name, event_type: r.event_type, cond: Object.values(r.conditions)[0] || '', action_type: r.action_type, title: r.action_config.title || '', assignee: r.action_config.assignee || 'customer_advisor', due: String(r.action_config.due_in_hours || 24) })}>Düzenle</button>
              <button className="btn-ghost" onClick={() => del(r.id)}>Sil</button>
            </div>))}
        </div>
        <div className="card">
          <div className="card-title" style={{ padding: '14px 16px 6px' }}>Başarısız olaylar</div>
          {bad.length === 0 ? <div style={{ padding: 18, textAlign: 'center', color: 'var(--tx3)', fontSize: 12.5 }}>Başarısız olay yok</div> : bad.map(e => (
            <div key={e.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 16px', borderTop: '1px solid var(--bdr)', fontSize: 12.5, color: 'var(--tx2)' }}>
              <span style={{ flex: 1 }}>#{e.id} {EVENTS[e.event_type] || e.event_type} · {e.attempts} deneme · <span style={{ color: 'var(--red)' }}>{e.last_error}</span></span>
              <span className={`badge ${e.status === 'dead' ? 'badge-red' : 'badge-amber'}`}>{e.status === 'dead' ? 'Ölü' : 'Yeniden denenecek'}</span>
              <button className="btn-ghost" onClick={() => retry(e.id)}><RotateCw size={13} /></button>
            </div>))}
        </div>
        <div className="card">
          <div className="card-title" style={{ padding: '14px 16px 6px' }}>Son çalıştırmalar</div>
          {execs.length === 0 ? <div style={{ padding: 18, textAlign: 'center', color: 'var(--tx3)', fontSize: 12.5 }}>Henüz çalıştırma yok</div> : execs.map(x => (
            <div key={x.id} style={{ display: 'flex', gap: 10, padding: '8px 16px', borderTop: '1px solid var(--bdr)', fontSize: 12.5, color: 'var(--tx2)' }}>
              <span style={{ flex: 1 }}>{ruleName(x.rule_id)}{x.error ? ` — ${x.error}` : ''}</span>
              <span className={`badge ${x.status === 'success' ? 'badge-green' : x.status === 'failed' ? 'badge-red' : 'badge-muted'}`}>{x.status === 'success' ? 'Başarılı' : x.status === 'failed' ? 'Hata' : 'Atlandı'}</span>
              <span style={{ color: 'var(--tx3)' }}>{new Date(x.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span>
            </div>))}
        </div>
      </div>

      {form && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{form.id ? 'Kuralı Düzenle' : 'Kural Ekle'}</h2><button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Ad *</label><input className="inp" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div className="modal-grid">
                <div><label className="label">Olay</label><select className="inp" value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value, cond: '' })}>{Object.entries(EVENTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                {COND[form.event_type] && <div><label className="label">Koşul</label><select className="inp" value={form.cond} onChange={e => setForm({ ...form, cond: e.target.value })}><option value="">Her durumda</option>{COND[form.event_type]!.opts.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>}
              </div>
              <div className="modal-grid">
                <div><label className="label">Eylem</label><select className="inp" value={form.action_type} onChange={e => setForm({ ...form, action_type: e.target.value })}><option value="create_task">Görev oluştur</option><option value="notify_owner">Bildirim gönder</option></select></div>
                <div><label className="label">Kime</label><select className="inp" value={form.assignee} onChange={e => setForm({ ...form, assignee: e.target.value })}><option value="customer_advisor">Müşterinin danışmanı</option>{form.event_type === 'opportunity_stage_changed' && <option value="opportunity_owner">Fırsat sahibi</option>}<option value="actor">İşlemi yapan</option></select></div>
              </div>
              <div><label className="label">Başlık / mesaj <span style={{ color: 'var(--tx3)' }}>({'{{musteri}}'} müşteri adı)</span></label><input className="inp" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
              {form.action_type === 'create_task' && <div><label className="label">Görev süresi (saat)</label><input className="inp" inputMode="numeric" value={form.due} onChange={e => setForm({ ...form, due: e.target.value })} /></div>}
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setForm(null)}>Vazgeç</button><button className="btn" onClick={save}>Kaydet</button></div>
            </div>
          </div>
        </div>)}
    </>
  )
}
