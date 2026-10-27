'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { IMPORT_KINDS, type ImportKind } from '@/lib/crm/import-config'

type Parsed = { headers: string[]; mapping: Record<string, number>; rows: { row: number; cells: string[] }[] }
type Job = { id: string; kind: string; file_name: string | null; mode: string; status: string; total: number; created_count: number; updated_count: number; skipped_count: number; error_count: number; errors: { row: string; msg: string }[]; created_at: string }
const CHUNK = 300
const KIND_LABEL: Record<string, string> = { customers: 'Müşteri', products: 'Ürün', b2b_accounts: 'B2B firma' }

export default function IceAktarPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const kinds = (Object.keys(IMPORT_KINDS) as ImportKind[]).filter(k => crm.can(IMPORT_KINDS[k].perm))
  const [kind, setKind] = useState<ImportKind>(kinds[0] || 'customers')
  const [stores, setStores] = useState<{ id: string; name: string }[]>([])
  const [store, setStore] = useState('')
  const [mode, setMode] = useState<'skip' | 'update'>('skip')
  const [file, setFile] = useState<File | null>(null)
  const [parsed, setParsed] = useState<Parsed | null>(null)
  const [mapping, setMapping] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ c: number; u: number; s: number; errs: { row: string; msg: string }[] } | null>(null)
  const [err, setErr] = useState('')
  const [history, setHistory] = useState<Job[]>([])
  const cfg = IMPORT_KINDS[kind]

  const loadHistory = useCallback(async () => {
    const { data } = await supabase.from('import_jobs').select('*').order('created_at', { ascending: false }).limit(15)
    setHistory((data || []) as Job[])
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadHistory() }, [loadHistory])
  useEffect(() => {
    supabase.from('stores').select('id, name').eq('is_active', true).order('name').then(({ data }) => {
      const s = (data || []) as { id: string; name: string }[]
      setStores(s); if (s.length === 1) setStore(s[0].id)
    })
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  function reset() { setFile(null); setParsed(null); setMapping({}); setResult(null); setErr(''); setProgress(0); if (fileRef.current) fileRef.current.value = '' }

  async function pick(f: File | null) {
    reset(); if (!f) return
    setFile(f); setBusy(true)
    const fd = new FormData(); fd.append('file', f); fd.append('kind', kind)
    try {
      const res = await fetch('/api/crm/import/parse', { method: 'POST', body: fd })
      const j = await res.json()
      if (!j.ok) { setErr(j.error || 'Dosya okunamadı'); setFile(null); return }
      setParsed({ headers: j.headers, mapping: j.mapping, rows: j.rows }); setMapping(j.mapping)
    } catch { setErr('Dosya yüklenemedi'); setFile(null) } finally { setBusy(false) }
  }

  const missing = cfg.fields.filter(f => f.required && mapping[f.key] === undefined)
  const needContact = kind === 'customers' && mapping.phone === undefined && mapping.email === undefined
  const ready = !!parsed && missing.length === 0 && !needContact && (kind !== 'customers' || !!store) && !busy

  const preview = useMemo(() => !parsed ? [] : parsed.rows.slice(0, 5), [parsed])

  async function run() {
    if (!parsed || !ready) return
    setBusy(true); setErr(''); setProgress(0); setResult(null)
    const objs = parsed.rows.map(r => {
      const o: Record<string, string | number> = { row: r.row }
      for (const f of cfg.fields) { const i = mapping[f.key]; if (i !== undefined && r.cells[i]) o[f.key] = r.cells[i] }
      return o
    })
    let jobId = ''
    const tot = { c: 0, u: 0, s: 0, errs: [] as { row: string; msg: string }[] }
    try {
      const st = await supabase.rpc('import_start', { p_kind: kind, p_file: file?.name || kind, p_store: kind === 'customers' ? store : null, p_mode: mode, p_total: objs.length })
      if (st.error) throw new Error(st.error.message)
      jobId = st.data as string
      for (let i = 0; i < objs.length; i += CHUNK) {
        const { data, error } = await supabase.rpc(cfg.rpc, { p_job: jobId, p_rows: objs.slice(i, i + CHUNK) })
        if (error) throw new Error(error.message)
        tot.c += data.created; tot.u += data.updated; tot.s += data.skipped; tot.errs.push(...data.errors)
        setProgress(Math.min(100, Math.round(((i + CHUNK) / objs.length) * 100)))
      }
    } catch (e: any) { setErr(e.message || 'İçe aktarma kesildi') }
    if (jobId) await supabase.rpc('import_finish', { p_job: jobId })
    setResult(tot); setBusy(false); loadHistory()
  }

  function errorCsv(errs: { row: string; msg: string }[]) {
    const blob = new Blob(['﻿' + 'Satır;Hata\n' + errs.map(e => `${e.row};"${e.msg.replace(/"/g, '""')}"`).join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'hata-raporu.csv'; a.click(); URL.revokeObjectURL(a.href)
  }

  if (kinds.length === 0) return <div style={{ padding: 40, color: 'var(--tx3)' }}>İçe aktarma yetkiniz yok.</div>
  return (
    <>
      <CrmTopBar title="İçe / Dışa Aktar" subtitle="Excel (.xlsx)" />
      <div style={{ padding: 22, maxWidth: 1000, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card-title">1 · Ne aktarılacak?</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            {kinds.map(k => <button key={k} className={kind === k ? 'btn' : 'btn-ghost'} disabled={busy} onClick={() => { setKind(k); reset() }}>{IMPORT_KINDS[k].label}</button>)}
            <div style={{ flex: 1 }} />
            <a className="btn-ghost" style={{ textDecoration: 'none' }} href={`/api/crm/import/template?kind=${kind}`}><FileSpreadsheet size={14} /> Şablonu indir</a>
          </div>
          {kind === 'customers' && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <select className="inp" style={{ width: 240 }} value={store} onChange={e => setStore(e.target.value)} disabled={busy}><option value="">Hedef mağaza / bayi seçin…</option>{stores.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
              <span style={{ fontSize: 12, color: 'var(--tx3)' }}>Müşteriler bu mağaza/bayiye kaydedilir.</span>
            </div>)}
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: 'var(--tx2)' }}>
            <label><input type="radio" checked={mode === 'skip'} onChange={() => setMode('skip')} disabled={busy} /> Mevcut kayıtları atla</label>
            <label><input type="radio" checked={mode === 'update'} onChange={() => setMode('update')} disabled={busy} /> Mevcut kayıtları güncelle (boş olmayan alanlar)</label>
          </div>
        </div>

        <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="card-title">2 · Dosya</div>
          <input ref={fileRef} type="file" accept=".xlsx" style={{ display: 'none' }} onChange={e => pick(e.target.files?.[0] || null)} />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}><Upload size={14} /> {file ? 'Başka dosya seç' : 'Excel dosyası seç'}</button>
            {file && <span style={{ fontSize: 13, color: 'var(--tx2)' }}>{file.name} · {parsed ? `${parsed.rows.length} satır` : 'okunuyor…'}</span>}
          </div>
          {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
          {parsed && (<>
            <div className="card-title" style={{ marginTop: 6 }}>3 · Sütun eşleme</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 10 }}>
              {cfg.fields.map(f => (
                <div key={f.key}><label className="label">{f.label}{f.required && ' *'}</label>
                  <select className="inp" disabled={busy} value={mapping[f.key] ?? ''} onChange={e => setMapping(m => { const n = { ...m }; if (e.target.value === '') delete n[f.key]; else n[f.key] = parseInt(e.target.value); return n })}>
                    <option value="">— eşleme yok —</option>{parsed.headers.map((h, i) => <option key={i} value={i}>{h || `(Sütun ${i + 1})`}</option>)}
                  </select></div>))}
            </div>
            {missing.length > 0 && <div style={{ color: 'var(--amber)', fontSize: 12.5 }}>Zorunlu alanlar eşlenmeli: {missing.map(m => m.label).join(', ')}</div>}
            {needContact && <div style={{ color: 'var(--amber)', fontSize: 12.5 }}>Telefon veya e-posta sütunlarından en az biri eşlenmeli (mükerrer kontrolü için).</div>}
            <div className="card-title" style={{ marginTop: 6 }}>Önizleme (ilk 5 satır)</div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontSize: 12.5, width: '100%' }}>
                <thead><tr style={{ textAlign: 'left', color: 'var(--tx3)' }}><th style={{ padding: '6px 10px' }}>#</th>{cfg.fields.filter(f => mapping[f.key] !== undefined).map(f => <th key={f.key} style={{ padding: '6px 10px' }}>{f.label}</th>)}</tr></thead>
                <tbody>{preview.map(r => <tr key={r.row} style={{ borderTop: '1px solid var(--bdr)' }}><td style={{ padding: '6px 10px', color: 'var(--tx3)' }}>{r.row}</td>{cfg.fields.filter(f => mapping[f.key] !== undefined).map(f => <td key={f.key} style={{ padding: '6px 10px', color: 'var(--tx2)' }}>{r.cells[mapping[f.key]]}</td>)}</tr>)}</tbody>
              </table>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button className="btn" disabled={!ready} onClick={run}>{busy ? `Aktarılıyor… %${progress}` : `${parsed.rows.length} satırı aktar`}</button>
              {busy && <div style={{ flex: 1, height: 6, borderRadius: 3, background: 'var(--s2)', maxWidth: 300 }}><div style={{ width: `${progress}%`, height: '100%', borderRadius: 3, background: 'var(--ac)', transition: 'width .2s' }} /></div>}
            </div>
          </>)}
        </div>

        {result && (
          <div className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div className="card-title">Sonuç</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <span className="badge badge-green">{result.c} eklendi</span><span className="badge badge-amber">{result.u} güncellendi</span>
              <span className="badge badge-muted">{result.s} atlandı</span><span className={`badge ${result.errs.length ? 'badge-red' : 'badge-muted'}`}>{result.errs.length} hata</span>
            </div>
            {result.errs.length > 0 && (<>
              <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: 12.5, color: 'var(--tx2)' }}>{result.errs.slice(0, 50).map((e, i) => <div key={i}>Satır {e.row}: {e.msg}</div>)}{result.errs.length > 50 && <div style={{ color: 'var(--tx3)' }}>… ve {result.errs.length - 50} hata daha</div>}</div>
              <div><button className="btn-ghost" onClick={() => errorCsv(result.errs)}><Download size={14} /> Hata raporunu indir</button></div>
            </>)}
            <div><button className="btn-ghost" onClick={reset}>Yeni içe aktarma</button></div>
          </div>)}

        <div className="card" style={{ padding: 16 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Dışa aktar (Excel)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {crm.can('customers.export') && <a className="btn-ghost" style={{ textDecoration: 'none' }} href="/api/crm/export/customers"><Download size={14} /> Müşteriler</a>}
            {crm.can('reports.export') && <>
              <a className="btn-ghost" style={{ textDecoration: 'none' }} href="/api/crm/export/orders"><Download size={14} /> Siparişler</a>
              <a className="btn-ghost" style={{ textDecoration: 'none' }} href="/api/crm/export/opportunities"><Download size={14} /> Fırsatlar</a>
              <a className="btn-ghost" style={{ textDecoration: 'none' }} href="/api/crm/export/tasks"><Download size={14} /> Görevler</a></>}
            {crm.can('products.read') && <a className="btn-ghost" style={{ textDecoration: 'none' }} href="/api/crm/export/products"><Download size={14} /> Ürünler</a>}
            {crm.can('b2b.read') && crm.can('reports.export') && <a className="btn-ghost" style={{ textDecoration: 'none' }} href="/api/crm/export/b2b"><Download size={14} /> B2B firmalar</a>}
          </div>
          <div style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 8 }}>Dışa aktarma yalnızca yetkili olduğunuz kayıtları içerir ve denetim kaydına yazılır. Her dosyada en fazla 50.000 satır bulunur.</div>
        </div>

        <div className="card">
          <div className="card-title" style={{ padding: '14px 16px 6px' }}>Geçmiş içe aktarmalar</div>
          {history.length === 0 ? <div style={{ padding: 22, textAlign: 'center', color: 'var(--tx3)', fontSize: 12.5 }}>Henüz içe aktarma yok</div> : history.map(j => (
            <div key={j.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 16px', borderTop: '1px solid var(--bdr)', fontSize: 12.5, color: 'var(--tx2)', flexWrap: 'wrap' }}>
              <span className="badge badge-muted">{KIND_LABEL[j.kind] || j.kind}</span>
              <span style={{ flex: 1, minWidth: 140, color: 'var(--tx)' }}>{j.file_name}</span>
              <span>{j.created_count} eklendi · {j.updated_count} güncellendi · {j.skipped_count} atlandı · <span style={{ color: j.error_count ? 'var(--red)' : undefined }}>{j.error_count} hata</span></span>
              <span style={{ color: 'var(--tx3)' }}>{new Date(j.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              {j.status === 'running' && <span className="badge badge-amber">Yarım kaldı</span>}
            </div>))}
        </div>
      </div>
    </>
  )
}
