'use client'
import { useEffect, useState } from 'react'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

export type CField = { id: string; key: string; label: string; field_type: 'text' | 'number' | 'date' | 'select' | 'boolean'; options: string[]; is_required: boolean }

export default function CustomFieldsCard({ customerId, values, canWrite, onSaved }: { customerId: string; values: Record<string, any>; canWrite: boolean; onSaved: () => void }) {
  const supabase = createCrmBrowserClient()
  const [defs, setDefs] = useState<CField[]>([])
  const [form, setForm] = useState<Record<string, any>>(values || {})
  const [msg, setMsg] = useState('')
  useEffect(() => { supabase.from('custom_fields').select('id, key, label, field_type, options, is_required').eq('is_active', true).order('sort_order').order('label').then(r => setDefs((r.data || []) as CField[])) }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setForm(values || {}) }, [values])
  if (defs.length === 0) return null

  async function save() {
    const known = new Set(defs.map(d => d.key))
    const out: Record<string, any> = Object.fromEntries(Object.entries(values || {}).filter(([k]) => !known.has(k)))
    for (const d of defs) {
      const v = form[d.key]
      if (v === undefined || v === null || v === '') { if (d.is_required) { setMsg(`${d.label} zorunlu`); return } continue }
      out[d.key] = d.field_type === 'number' ? Number(v) : v
      if (d.field_type === 'number' && isNaN(out[d.key])) { setMsg(`${d.label} sayı olmalı`); return }
    }
    const { error } = await supabase.from('customers').update({ custom: out }).eq('id', customerId)
    if (error) { setMsg(error.message); return }
    setMsg('Kaydedildi'); onSaved()
  }

  return (
    <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--bdr)' }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--tx3)', textTransform: 'uppercase', letterSpacing: .4, marginBottom: 10 }}>Özel alanlar</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12 }}>
        {defs.map(d => (
          <div key={d.id}>
            <label className="label">{d.label}{d.is_required && ' *'}</label>
            {d.field_type === 'select' ? (
              <select className="inp" disabled={!canWrite} value={form[d.key] ?? ''} onChange={e => setForm({ ...form, [d.key]: e.target.value })}><option value="">—</option>{d.options.map(o => <option key={o} value={o}>{o}</option>)}</select>
            ) : d.field_type === 'boolean' ? (
              <select className="inp" disabled={!canWrite} value={form[d.key] === undefined ? '' : String(form[d.key])} onChange={e => setForm({ ...form, [d.key]: e.target.value === '' ? '' : e.target.value === 'true' })}><option value="">—</option><option value="true">Evet</option><option value="false">Hayır</option></select>
            ) : (
              <input className="inp" disabled={!canWrite} type={d.field_type === 'date' ? 'date' : 'text'} inputMode={d.field_type === 'number' ? 'decimal' : undefined} maxLength={500} value={form[d.key] ?? ''} onChange={e => setForm({ ...form, [d.key]: e.target.value })} />
            )}
          </div>))}
      </div>
      {canWrite && <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 12 }}><button className="btn" onClick={save}>Kaydet</button>{msg && <span style={{ fontSize: 12.5, color: msg === 'Kaydedildi' ? 'var(--green)' : 'var(--red)' }}>{msg}</span>}</div>}
    </div>
  )
}
