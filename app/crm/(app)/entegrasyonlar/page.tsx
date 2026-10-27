'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, X, RotateCw, Copy } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'
import { PRESETS, SAMPLE_ORDER, SAMPLE_PRODUCT, FIELDS } from '@/lib/crm/guide'

type Ig = { id: string; code: string; kind: string; name: string; status: string; base_url: string | null; secret_env: string | null; last_success_at: string | null; last_error: string | null }
type Inbox = { id: number; integration_id: string; external_event_id: string; event_type: string; status: string; attempts: number; error: string | null; received_at: string }
type Map = { id: string; integration_id: string; entity: string; source_field: string; target_field: string }
const KIND: Record<string, string> = { erp: 'ERP', pos: 'POS', ecommerce: 'E-ticaret', sms: 'SMS', whatsapp: 'WhatsApp', email: 'E-posta', iys: 'İYS', other: 'Diğer' }
const STATUS: Record<string, [string, string]> = { not_configured: ['Yapılandırılmadı', 'badge-muted'], active: ['Aktif', 'badge-green'], paused: ['Durduruldu', 'badge-amber'], error: ['Hata', 'badge-red'] }
const ST_IN: Record<string, [string, string]> = { pending: ['Bekliyor', 'badge-muted'], processed: ['İşlendi', 'badge-green'], failed: ['Hata (tekrar denenecek)', 'badge-amber'], dead: ['Ölü', 'badge-red'] }
const ORIGIN = typeof window !== 'undefined' ? window.location.origin : ''


function Setup({ ig, copy }: { ig: Ig; copy: (t: string) => void }) {
  const url = `${ORIGIN}/api/crm/webhooks/${ig.code}`
  const preset = PRESETS.find(p => p.code === ig.code)
  const secretName = ig.secret_env || 'CRM_WEBHOOK_SECRET_XXX'
  const code = `const crypto = require('crypto');
const body = JSON.stringify(payload);            // gönderilecek JSON
const ts = Math.floor(Date.now() / 1000).toString();
const sig = crypto.createHmac('sha256', process.env.${secretName}).update(ts + '.' + body).digest('hex');
// POST ${url}
// Başlıklar: content-type: application/json, x-crm-timestamp: ts, x-crm-signature: sig`
  const pre = { background: 'var(--bg2, rgba(127,127,127,.1))', padding: 10, borderRadius: 8, fontSize: 11.5, overflowX: 'auto' as const, whiteSpace: 'pre' as const, margin: '6px 0' }
  const Block = ({ title, text }: { title: string; text: string }) => (<div><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--tx3)' }}><span>{title}</span><button className="btn-ghost" onClick={() => copy(text)}><Copy size={11} /> Kopyala</button></div><pre style={pre}>{text}</pre></div>)
  return (
    <div style={{ width: '100%', borderTop: '1px solid var(--bdr)', paddingTop: 12, fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.7 }}>
      <b style={{ color: 'var(--tx)' }}>Kurulum adımları</b>
      <ol style={{ margin: '6px 0 10px 18px', padding: 0 }}>
        <li>Güçlü rastgele bir anahtar üretin (ör. <code>openssl rand -hex 32</code>).</li>
        <li>Vercel → <b>chat</b> projesi → Settings → Environment Variables: <code>{secretName}</code> adıyla bu anahtarı ekleyin, yeniden deploy edin.</li>
        <li>Aynı anahtarı kaynak sistemde/n8n'de imza için kullanın. Adres: <code>{url}</code></li>
        {(preset?.how || []).map((h, k) => <li key={k}>{h}</li>)}
        <li>Yukarıdan "Etkinleştir"e basın. İlk olay gelince "Senkron geçmişi"nde görünür.</li>
      </ol>
      <Block title="İmza kodu (Node / n8n Code düğümü)" text={code} />
      <Block title="Örnek sipariş olayı (order.upsert)" text={JSON.stringify(SAMPLE_ORDER, null, 2)} />
      <Block title="Örnek ürün olayı (product.upsert)" text={JSON.stringify(SAMPLE_PRODUCT, null, 2)} />
      <details><summary style={{ cursor: 'pointer' }}>Alan sözlüğü (hangi alan CRM'de neye gider)</summary>
        <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 6 }}><tbody>{FIELDS.map(f => <tr key={f.entity + f.field} style={{ borderTop: '1px solid var(--bdr)' }}><td style={{ padding: '4px 6px' }}>{f.entity}</td><td style={{ padding: '4px 6px', fontFamily: 'JetBrains Mono, monospace' }}>{f.field}</td><td style={{ padding: '4px 6px' }}>{f.req}</td><td style={{ padding: '4px 6px' }}>{f.desc}</td></tr>)}</tbody></table>
      </details>
    </div>
  )
}

export default function EntegrasyonlarPage() {
  const supabase = createCrmBrowserClient()
  const [igs, setIgs] = useState<Ig[]>([])
  const [inbox, setInbox] = useState<Inbox[]>([])
  const [maps, setMaps] = useState<Map[]>([])
  const [form, setForm] = useState<{ id: string; code: string; kind: string; name: string; base_url: string; secret_env: string } | null>(null)
  const [mapF, setMapF] = useState({ integration_id: '', entity: 'order', source_field: '', target_field: '' })
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState('')
  const [open, setOpen] = useState('')

  const load = useCallback(async () => {
    const [a, b, c] = await Promise.all([
      supabase.from('integrations').select('*').order('created_at'),
      supabase.from('webhook_inbox').select('id, integration_id, external_event_id, event_type, status, attempts, error, received_at').order('id', { ascending: false }).limit(30),
      supabase.from('integration_mappings').select('*').order('entity')])
    setIgs((a.data || []) as Ig[]); setInbox((b.data || []) as Inbox[]); setMaps((c.data || []) as Map[])
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  async function save() {
    if (!form || !form.code.trim() || !form.name.trim()) { setErr('Kod ve ad zorunlu'); return }
    const payload = { name: form.name.trim(), kind: form.kind, base_url: form.base_url.trim() || null, secret_env: form.secret_env.trim() || null }
    const { error } = form.id ? await supabase.from('integrations').update(payload).eq('id', form.id) : await supabase.from('integrations').insert({ ...payload, code: form.code.trim().toLowerCase() })
    if (error) { setErr(error.code === '23514' ? 'Kod (küçük harf, rakam, - _) veya gizli değişken adı (BÜYÜK_HARF) geçersiz' : error.code === '23505' ? 'Bu kod kayıtlı' : error.message); return }
    setErr(''); setForm(null); load()
  }
  async function setStatus(id: string, status: string) { await supabase.from('integrations').update({ status }).eq('id', id); load() }
  async function retry(id: number) { const { error } = await supabase.rpc('retry_inbox', { p_id: id }); if (error) setErr(error.message); else load() }
  async function addMap() {
    if (!mapF.integration_id || !mapF.source_field.trim() || !mapF.target_field.trim()) { setErr('Tüm eşleme alanları zorunlu'); return }
    const { error } = await supabase.from('integration_mappings').insert({ ...mapF, source_field: mapF.source_field.trim(), target_field: mapF.target_field.trim() })
    if (error) { setErr(error.message); return }
    setErr(''); setMapF({ ...mapF, source_field: '', target_field: '' }); load()
  }
  async function delMap(id: string) { await supabase.from('integration_mappings').delete().eq('id', id); load() }
  const copy = (t: string) => { navigator.clipboard?.writeText(t); setCopied(t); setTimeout(() => setCopied(''), 1500) }
  const igName = (id: string) => igs.find(i => i.id === id)?.name || '—'

  return (
    <>
      <CrmTopBar title="Entegrasyonlar" subtitle={`${igs.length} bağlantı`} action={<button className="btn" onClick={() => { setErr(''); setForm({ id: '', code: '', kind: 'erp', name: '', base_url: '', secret_env: '' }) }}><Plus size={14} /> Entegrasyon Ekle</button>} />
      <div style={{ padding: 22, maxWidth: 1000, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 14, fontSize: 12.5, color: 'var(--tx2)', lineHeight: 1.7 }}>
          <b style={{ color: 'var(--tx)' }}>Nasıl çalışır:</b> ERP/POS/e-ticaret sisteminiz olayları aşağıdaki webhook adresine imzalı olarak POST eder. İmza: <code>HMAC-SHA256(sır, "zaman.gövde")</code> → <code>x-crm-signature</code>, zaman damgası <code>x-crm-timestamp</code> (5 dk tolerans). Sır veritabanına yazılmaz; Vercel'de <code>Gizli değişken adı</code> alanındaki ortam değişkeninde tutulur.
          Gövde: <code>{'{ "event_id": "...", "type": "order.upsert" | "product.upsert", "data": { ... } }'}</code>. Sipariş ve ürün için ERP/POS yetkili kaynaktır; aynı olay tekrar gelirse yok sayılır. Kaynağınızın alan adları farklıysa aşağıdan eşleme tanımlayın.
        </div>
        <div className="card" style={{ padding: 14 }}>
          <div className="card-title" style={{ marginBottom: 8 }}>Hızlı kurulum: sisteminizi seçin</div>
          <div style={{ fontSize: 12.5, color: 'var(--tx3)', marginBottom: 10 }}>Seçtiğinizde form hazır dolar; yalnızca kaydedin. Sonra kartın içindeki "Kurulum" bölümünü açıp adımları izleyin.</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PRESETS.filter(p => !igs.some(i => i.code === p.code)).map(p => <button key={p.code} className="btn-ghost" onClick={() => { setErr(''); setForm({ id: '', code: p.code, kind: p.kind, name: p.name, base_url: '', secret_env: p.secret_env }) }}><Plus size={13} /> {p.name}</button>)}
            {PRESETS.every(p => igs.some(i => i.code === p.code)) && <span style={{ fontSize: 12.5, color: 'var(--tx3)' }}>Tüm hazır şablonlar eklendi</span>}
          </div>
        </div>
        {err && !form && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
        <div className="card">
          {igs.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Henüz bağlantı yok. Yukarıdan sisteminizi seçerek başlayın.</div> : igs.map(i => (
            <div key={i.id} style={{ padding: '12px 16px', borderTop: '1px solid var(--bdr)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 220 }}>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{i.name} <span className="badge badge-muted">{KIND[i.kind]}</span></div>
                <div style={{ fontSize: 12, color: 'var(--tx3)' }}>
                  <button onClick={() => copy(`${ORIGIN}/api/crm/webhooks/${i.code}`)} style={{ background: 'none', border: 'none', color: 'var(--ac)', cursor: 'pointer', padding: 0, fontSize: 12 }}><Copy size={11} /> {copied.endsWith(`/${i.code}`) ? 'Kopyalandı' : `/api/crm/webhooks/${i.code}`}</button>
                  {' · '}Sır: {i.secret_env || 'tanımsız'}{i.last_success_at && ` · son başarı ${new Date(i.last_success_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}`}
                </div>
                {i.last_error && <div style={{ fontSize: 12, color: 'var(--red)' }}>{i.last_error}</div>}
              </div>
              <span className={`badge ${STATUS[i.status][1]}`}>{STATUS[i.status][0]}</span>
              {i.status !== 'active' ? <button className="btn" disabled={!i.secret_env} title={!i.secret_env ? 'Önce gizli değişken adını girin' : ''} onClick={() => setStatus(i.id, 'active')}>Etkinleştir</button> : <button className="btn-ghost" onClick={() => setStatus(i.id, 'paused')}>Durdur</button>}
              <button className="btn-ghost" onClick={() => setForm({ id: i.id, code: i.code, kind: i.kind, name: i.name, base_url: i.base_url || '', secret_env: i.secret_env || '' })}>Düzenle</button>
              <button className="btn-ghost" onClick={() => setOpen(open === i.id ? '' : i.id)}>{open === i.id ? 'Kurulumu kapat' : 'Kurulum'}</button>
              {open === i.id && <Setup ig={i} copy={copy} />}
            </div>))}
        </div>
        <div className="card">
          <div className="card-title" style={{ padding: '14px 16px 6px' }}>Alan eşlemeleri</div>
          <div style={{ padding: '0 16px 10px', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <select className="inp" style={{ width: 160 }} value={mapF.integration_id} onChange={e => setMapF({ ...mapF, integration_id: e.target.value })}><option value="">Entegrasyon</option>{igs.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}</select>
            <select className="inp" style={{ width: 110 }} value={mapF.entity} onChange={e => setMapF({ ...mapF, entity: e.target.value })}><option value="order">Sipariş</option><option value="product">Ürün</option></select>
            <input className="inp" style={{ width: 170 }} placeholder="kaynak alan (a.b)" value={mapF.source_field} onChange={e => setMapF({ ...mapF, source_field: e.target.value })} />
            <input className="inp" style={{ width: 170 }} placeholder="CRM alanı (customer.phone)" value={mapF.target_field} onChange={e => setMapF({ ...mapF, target_field: e.target.value })} />
            <button className="btn" onClick={addMap}>Ekle</button>
          </div>
          {maps.filter(m => m.entity !== 'customer').map(m => <div key={m.id} style={{ display: 'flex', gap: 10, padding: '6px 16px', borderTop: '1px solid var(--bdr)', fontSize: 12.5, color: 'var(--tx2)' }}><span style={{ flex: 1 }}>{igName(m.integration_id)} · {m.entity === 'order' ? 'Sipariş' : 'Ürün'}: <code>{m.source_field}</code> → <code>{m.target_field}</code></span><button className="btn-ghost" onClick={() => delMap(m.id)}>Sil</button></div>)}
        </div>
        <div className="card">
          <div className="card-title" style={{ padding: '14px 16px 6px' }}>Senkron geçmişi (gelen olaylar)</div>
          {inbox.length === 0 ? <div style={{ padding: 18, textAlign: 'center', color: 'var(--tx3)', fontSize: 12.5 }}>Henüz olay gelmedi</div> : inbox.map(m => (
            <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '8px 16px', borderTop: '1px solid var(--bdr)', fontSize: 12.5, color: 'var(--tx2)' }}>
              <span style={{ flex: 1 }}>{igName(m.integration_id)} · {m.event_type} · {m.external_event_id}{m.error && <span style={{ color: 'var(--red)' }}> — {m.error}</span>}</span>
              <span className={`badge ${ST_IN[m.status][1]}`}>{ST_IN[m.status][0]}</span>
              <span style={{ color: 'var(--tx3)' }}>{new Date(m.received_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</span>
              {(m.status === 'dead' || m.status === 'failed') && <button className="btn-ghost" onClick={() => retry(m.id)}><RotateCw size={13} /></button>}
            </div>))}
        </div>
      </div>

      {form && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setForm(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 480 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{form.id ? 'Entegrasyonu Düzenle' : 'Entegrasyon Ekle'}</h2><button onClick={() => setForm(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="modal-grid">
                <div><label className="label">Kod * <span style={{ color: 'var(--tx3)' }}>(adres sonu)</span></label><input className="inp" disabled={!!form.id} value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="erp" /></div>
                <div><label className="label">Tür</label><select className="inp" value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value })}>{Object.entries(KIND).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
              </div>
              <div><label className="label">Ad *</label><input className="inp" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><label className="label">Kaynak sistem adresi (isteğe bağlı)</label><input className="inp" value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} placeholder="https://..." /></div>
              <div><label className="label">Gizli değişken adı</label><input className="inp" value={form.secret_env} onChange={e => setForm({ ...form, secret_env: e.target.value.toUpperCase() })} placeholder="CRM_WEBHOOK_SECRET_ERP" style={{ fontFamily: 'JetBrains Mono, monospace' }} /><div style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 4 }}>Sırrın kendisini buraya yazmayın; Vercel ortam değişkeni olarak ekleyin.</div></div>
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setForm(null)}>Vazgeç</button><button className="btn" onClick={save}>Kaydet</button></div>
            </div>
          </div>
        </div>)}
    </>
  )
}
