'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, X, Trash2, Pencil } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { TagChip, TAG_COLOR } from '@/components/crm/CustomerTags'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Field = { id: string; key: string; label: string; field_type: string; options: string[]; is_required: boolean; is_active: boolean; sort_order: number }
type Tag = { id: string; name: string; color: string }
const TYPE: Record<string, string> = { text: 'Metin', number: 'Sayı', date: 'Tarih', select: 'Seçenekli liste', boolean: 'Evet / Hayır' }
const EMPTY = { id: '', key: '', label: '', field_type: 'text', options: '', is_required: false, is_active: true }
const slug = (s: string) => s.toLocaleLowerCase('tr').replace(/ç/g, 'c').replace(/ğ/g, 'g').replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ş/g, 's').replace(/ü/g, 'u').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 38)

export default function AlanlarPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const canTags = crm.can('tags.manage')
  const [fields, setFields] = useState<Field[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [use, setUse] = useState<Record<string, number>>({})
  const [form, setForm] = useState<typeof EMPTY | null>(null)
  const [err, setErr] = useState('')

  const load = useCallback(async () => {
    const [f, t, u] = await Promise.all([
      supabase.from('custom_fields').select('*').order('sort_order').order('label'),
      supabase.from('tags').select('id, name, color').order('name'),
      supabase.from('customer_tags').select('tag_id').limit(20000),
    ])
    setFields((f.data || []) as Field[]); setTags((t.data || []) as Tag[])
    const c: Record<string, number> = {}; (u.data || []).forEach((x: any) => { c[x.tag_id] = (c[x.tag_id] || 0) + 1 }); setUse(c)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  async function saveField() {
    if (!form) return
    const label = form.label.trim()
    if (!label) { setErr('Etiket adı gerekli'); return }
    const opts = form.options.split('\n').map(x => x.trim()).filter(Boolean)
    if (form.field_type === 'select' && opts.length < 2) { setErr('Listede en az 2 seçenek olmalı (her satıra bir seçenek)'); return }
    const key = form.id ? form.key : slug(label)
    if (!/^[a-z][a-z0-9_]{1,39}$/.test(key)) { setErr('Ad harfle başlamalı'); return }
    const payload = { label, field_type: form.field_type, options: form.field_type === 'select' ? opts : [], is_required: form.is_required, is_active: form.is_active }
    const { error } = form.id ? await supabase.from('custom_fields').update(payload).eq('id', form.id) : await supabase.from('custom_fields').insert({ ...payload, key, sort_order: fields.length })
    if (error) { setErr(error.code === '23505' ? 'Bu isimde alan var' : error.message); return }
    setErr(''); setForm(null); load()
  }
  async function delField(f: Field) {
    if (!confirm(`"${f.label}" alanı silinsin mi? Müşterilerde girilmiş değerler gizlenir, silinmez.`)) return
    const { error } = await supabase.from('custom_fields').update({ is_active: false }).eq('id', f.id)
    if (error) setErr(error.message); else load()
  }
  async function renameTag(t: Tag) {
    const n = prompt('Yeni etiket adı', t.name)?.trim()
    if (!n || n === t.name) return
    const { error } = await supabase.from('tags').update({ name: n }).eq('id', t.id)
    if (error) setErr(error.code === '23505' ? 'Bu etiket zaten var' : error.message); else { setErr(''); load() }
  }
  async function colorTag(t: Tag, color: string) { await supabase.from('tags').update({ color }).eq('id', t.id); load() }
  async function delTag(t: Tag) {
    if (!confirm(`"${t.name}" etiketi ${use[t.id] || 0} müşteriden kaldırılıp silinsin mi?`)) return
    const { error } = await supabase.from('tags').delete().eq('id', t.id)
    if (error) setErr(error.message); else load()
  }

  return (
    <>
      <CrmTopBar title="Özel Alanlar ve Etiketler" subtitle="Müşteri kartına kendi alanlarınızı ekleyin"
        action={<button className="btn" onClick={() => { setForm({ ...EMPTY }); setErr('') }}><Plus size={14} /> Alan Ekle</button>} />
      <div style={{ padding: 22, maxWidth: 900, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {err && !form && <div className="toast toast-err" style={{ margin: 0 }}>{err}</div>}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-title" style={{ padding: '14px 16px 4px' }}>Özel alanlar</div>
          <div style={{ padding: '0 16px 10px', fontSize: 12.5, color: 'var(--tx3)' }}>Örn. yüzük ölçüsü, evlilik yıldönümü, tercih edilen maden. Müşteri kartının Genel sekmesinde görünür, segmentlerde filtrelenir.</div>
          {fields.filter(f => f.is_active).length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Henüz alan yok</div>}
          {fields.filter(f => f.is_active).map(f => (
            <div key={f.id} className="row" style={{ justifyContent: 'space-between' }}>
              <div><b style={{ color: 'var(--tx)', fontSize: 13.5 }}>{f.label}</b> {f.is_required && <span className="badge badge-amber">zorunlu</span>}
                <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{TYPE[f.field_type]}{f.field_type === 'select' ? `: ${f.options.join(', ')}` : ''} · <code style={{ fontSize: 11 }}>{f.key}</code></div></div>
              <span style={{ display: 'flex', gap: 4 }}>
                <button title="Düzenle" onClick={() => { setForm({ id: f.id, key: f.key, label: f.label, field_type: f.field_type, options: f.options.join('\n'), is_required: f.is_required, is_active: true }); setErr('') }} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6, cursor: 'pointer' }}><Pencil size={14} /></button>
                <button title="Sil" onClick={() => delField(f)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6, cursor: 'pointer' }}><Trash2 size={14} /></button>
              </span>
            </div>))}
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="card-title" style={{ padding: '14px 16px 4px' }}>Etiketler</div>
          <div style={{ padding: '0 16px 10px', fontSize: 12.5, color: 'var(--tx3)' }}>Etiketler müşteri kartından eklenir (yazıp Enter). Burada yeniden adlandırır, renklendirir veya silersiniz.</div>
          {tags.length === 0 && <div style={{ padding: 24, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Henüz etiket yok</div>}
          {tags.map(t => (
            <div key={t.id} className="row" style={{ justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', gap: 10, alignItems: 'center' }}><TagChip t={t} /><span style={{ fontSize: 12, color: 'var(--tx3)' }}>{use[t.id] || 0} müşteri</span></span>
              {canTags && (
                <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  {Object.keys(TAG_COLOR).map(c => <button key={c} title={c} onClick={() => colorTag(t, c)} style={{ width: 16, height: 16, borderRadius: 99, background: TAG_COLOR[c], border: t.color === c ? '2px solid var(--tx)' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />)}
                  <button onClick={() => renameTag(t)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6, cursor: 'pointer' }}><Pencil size={14} /></button>
                  <button onClick={() => delTag(t)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6, cursor: 'pointer' }}><Trash2 size={14} /></button>
                </span>)}
            </div>))}
        </div>
      </div>

      {form && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{form.id ? 'Alanı Düzenle' : 'Yeni Özel Alan'}</h2><button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Alan adı *</label><input className="inp" value={form.label} maxLength={60} onChange={e => setForm({ ...form, label: e.target.value })} placeholder="Yüzük ölçüsü" /></div>
              <div><label className="label">Tür</label>
                <select className="inp" disabled={!!form.id} value={form.field_type} onChange={e => setForm({ ...form, field_type: e.target.value })}>{Object.entries(TYPE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              {form.field_type === 'select' && <div><label className="label">Seçenekler (her satıra bir tane)</label><textarea className="inp" rows={4} value={form.options} onChange={e => setForm({ ...form, options: e.target.value })} /></div>}
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--tx2)' }}><input type="checkbox" checked={form.is_required} onChange={e => setForm({ ...form, is_required: e.target.checked })} /> Kaydederken zorunlu</label>
              {err && <div className="toast toast-err" style={{ margin: 0 }}>{err}</div>}
              <button className="btn" onClick={saveField} style={{ justifyContent: 'center', padding: '11px 0' }}>Kaydet</button>
            </div>
          </div>
        </div>)}
    </>
  )
}
