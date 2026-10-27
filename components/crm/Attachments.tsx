'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Paperclip, Download, Trash2, Upload } from 'lucide-react'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { useCrm } from '@/components/crm/CrmProvider'

export type AttachEntity = 'customer' | 'order' | 'opportunity' | 'quotation' | 'business_account'
type Att = { id: string; file_name: string; size_bytes: number; content_type: string | null; uploaded_by: string; created_at: string }
const MAX = 10 * 1024 * 1024
const OK_EXT = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx']
const size = (n: number) => n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`

export default function Attachments({ entity, entityId, canWrite }: { entity: AttachEntity; entityId: string; canWrite?: boolean }) {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const write = (canWrite ?? true) && crm.can('attachments.write')
  const input = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Att[]>([])
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('attachments').select('id, file_name, size_bytes, content_type, uploaded_by, created_at').eq('entity_type', entity).eq('entity_id', entityId).order('created_at', { ascending: false })
    setItems((data || []) as Att[])
  }, [entity, entityId])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  async function upload(f: File) {
    setErr('')
    const ext = (f.name.split('.').pop() || '').toLowerCase()
    if (!OK_EXT.includes(ext)) { setErr('Desteklenen türler: PDF, resim, Word, Excel, TXT, CSV'); return }
    if (f.size > MAX) { setErr('Dosya en fazla 10 MB olabilir'); return }
    if (f.size === 0) { setErr('Dosya boş'); return }
    setBusy(true)
    const safe = f.name.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, '_').slice(-80) || `dosya.${ext}`
    const path = `${entity}/${entityId}/${crypto.randomUUID()}__${safe}`
    const up = await supabase.storage.from('crm-files').upload(path, f, { contentType: f.type || undefined })
    if (up.error) { setBusy(false); setErr(up.error.message.includes('mime') ? 'Bu dosya türüne izin verilmiyor' : up.error.message); return }
    const { error } = await supabase.from('attachments').insert({ entity_type: entity, entity_id: entityId, storage_path: path, file_name: f.name.slice(0, 200), content_type: f.type || null, size_bytes: f.size })
    if (error) { await supabase.storage.from('crm-files').remove([path]); setErr(error.message) }
    setBusy(false); if (input.current) input.current.value = ''; load()
  }
  async function download(a: Att) {
    const { data: row } = await supabase.from('attachments').select('storage_path').eq('id', a.id).single()
    if (!row) return
    const { data, error } = await supabase.storage.from('crm-files').createSignedUrl(row.storage_path, 60, { download: a.file_name })
    if (error || !data) { setErr('Dosya açılamadı'); return }
    window.open(data.signedUrl, '_blank', 'noopener')
  }
  async function remove(a: Att) {
    if (!confirm(`"${a.file_name}" silinsin mi?`)) return
    const { data: row } = await supabase.from('attachments').select('storage_path').eq('id', a.id).single()
    const { error } = await supabase.from('attachments').delete().eq('id', a.id)
    if (error) { setErr(error.message); return }
    if (row) await supabase.storage.from('crm-files').remove([row.storage_path])
    load()
  }

  return (
    <div>
      {write && (
        <div style={{ marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input ref={input} type="file" hidden accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.doc,.docx,.xls,.xlsx" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f) }} />
          <button className="btn" disabled={busy} onClick={() => input.current?.click()}><Upload size={14} /> {busy ? 'Yükleniyor…' : 'Dosya yükle'}</button>
          <span style={{ fontSize: 12, color: 'var(--tx3)' }}>PDF, resim, Word, Excel · en fazla 10 MB</span>
        </div>)}
      {err && <div className="toast toast-err" style={{ margin: '0 0 10px' }}>{err}</div>}
      {items.length === 0 ? <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: 'var(--tx3)' }}><Paperclip size={16} style={{ verticalAlign: -3 }} /> Ek dosya yok</div> : items.map(a => (
        <div key={a.id} className="row" style={{ justifyContent: 'space-between', gap: 10 }}>
          <span style={{ minWidth: 0 }}><b style={{ fontSize: 13, color: 'var(--tx)', wordBreak: 'break-all' }}>{a.file_name}</b>
            <div style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{size(a.size_bytes)} · {new Date(a.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</div></span>
          <span style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
            <button title="İndir" onClick={() => download(a)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6, cursor: 'pointer' }}><Download size={15} /></button>
            {write && (a.uploaded_by === crm.userId || crm.isSuperAdmin) && <button title="Sil" onClick={() => remove(a)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6, cursor: 'pointer' }}><Trash2 size={15} /></button>}
          </span>
        </div>))}
    </div>
  )
}
