'use client'
import { useCallback, useEffect, useState } from 'react'
import { X, Tag as TagIcon } from 'lucide-react'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

export type TagRow = { id: string; name: string; color: string }
export const TAG_COLOR: Record<string, string> = { violet: '#7c6af7', blue: '#3b82f6', green: '#22c55e', amber: '#f59e0b', red: '#ef4444', gray: '#8b8fa3' }

export function TagChip({ t, onRemove }: { t: TagRow; onRemove?: () => void }) {
  const c = TAG_COLOR[t.color] || TAG_COLOR.violet
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 99, fontSize: 12, fontWeight: 600, color: c, background: `${c}1f`, border: `1px solid ${c}40` }}>
      {t.name}{onRemove && <button onClick={onRemove} aria-label="Etiketi kaldır" style={{ background: 'none', border: 'none', color: c, padding: 0, cursor: 'pointer', display: 'flex' }}><X size={12} /></button>}
    </span>
  )
}

export default function CustomerTags({ customerId, canWrite }: { customerId: string; canWrite: boolean }) {
  const supabase = createCrmBrowserClient()
  const [all, setAll] = useState<TagRow[]>([])
  const [mine, setMine] = useState<string[]>([])
  const [val, setVal] = useState('')
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [t, m] = await Promise.all([
      supabase.from('tags').select('id, name, color').order('name'),
      supabase.from('customer_tags').select('tag_id').eq('customer_id', customerId),
    ])
    setAll((t.data || []) as TagRow[]); setMine((m.data || []).map((x: any) => x.tag_id))
  }, [customerId])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  async function add() {
    const name = val.trim()
    if (!name) return
    let tag = all.find(t => t.name.toLowerCase() === name.toLowerCase())
    if (!tag) {
      const { data, error } = await supabase.from('tags').insert({ name }).select('id, name, color').single()
      if (error) { setErr(error.code === '23505' ? 'Bu etiket zaten var' : error.message); return }
      tag = data as TagRow
    }
    if (mine.includes(tag.id)) { setVal(''); return }
    const { error } = await supabase.from('customer_tags').insert({ customer_id: customerId, tag_id: tag.id })
    if (error) { setErr(error.message); return }
    setErr(''); setVal(''); load()
  }
  async function remove(id: string) {
    await supabase.from('customer_tags').delete().eq('customer_id', customerId).eq('tag_id', id)
    load()
  }

  const mineTags = all.filter(t => mine.includes(t.id))
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      <TagIcon size={13} style={{ color: 'var(--tx3)' }} />
      {mineTags.length === 0 && !canWrite && <span style={{ fontSize: 12.5, color: 'var(--tx3)' }}>Etiket yok</span>}
      {mineTags.map(t => <TagChip key={t.id} t={t} onRemove={canWrite ? () => remove(t.id) : undefined} />)}
      {canWrite && (
        <>
          <input className="inp" list={`tags-${customerId}`} value={val} maxLength={40} placeholder="Etiket ekle…" onChange={e => setVal(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }} style={{ width: 150, padding: '4px 10px', fontSize: 12.5 }} />
          <datalist id={`tags-${customerId}`}>{all.filter(t => !mine.includes(t.id)).map(t => <option key={t.id} value={t.name} />)}</datalist>
        </>)}
      {err && <span style={{ fontSize: 12, color: 'var(--red)' }}>{err}</span>}
    </div>
  )
}
