'use client'
import { useCallback, useEffect, useState } from 'react'
import { Plus, X, Info } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import { useCrm } from '@/components/crm/CrmProvider'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Camp = { id: string; name: string; channel: string; segment_id: string | null; template_id: string | null; status: string; scheduled_at: string | null; prepared_at: string | null }
type Tpl = { id: string; name: string; channel: string; subject: string | null; body: string; is_active: boolean }
type Seg = { id: string; name: string }
type Stat = { total: number; pending: number; skipped: number; sent: number; delivered: number; failed: number }
const STATUS: Record<string, [string, string]> = { draft: ['Taslak', 'badge-muted'], ready: ['Hazır', 'badge-blue'], sending: ['Gönderiliyor', 'badge-amber'], done: ['Tamamlandı', 'badge-green'], cancelled: ['İptal', 'badge-red'] }
const CH: Record<string, string> = { sms: 'SMS', email: 'E-posta', whatsapp: 'WhatsApp' }

export default function KampanyalarPage() {
  const crm = useCrm()
  const supabase = createCrmBrowserClient()
  const canWrite = crm.can('campaigns.write')
  const [tab, setTab] = useState<'kampanya' | 'sablon'>('kampanya')
  const [camps, setCamps] = useState<Camp[]>([])
  const [tpls, setTpls] = useState<Tpl[]>([])
  const [segs, setSegs] = useState<Seg[]>([])
  const [stats, setStats] = useState<Record<string, Stat>>({})
  const [cf, setCf] = useState<{ id: string; name: string; channel: string; segment_id: string; template_id: string; scheduled_at: string } | null>(null)
  const [tf, setTf] = useState<{ id: string; name: string; channel: string; subject: string; body: string; is_active: boolean } | null>(null)
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')

  const load = useCallback(async () => {
    const [c, t, s, r] = await Promise.all([
      supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
      supabase.from('message_templates').select('*').order('name'),
      supabase.from('segments').select('id, name').order('name'),
      supabase.from('campaign_recipients').select('campaign_id, status'),
    ])
    setCamps((c.data || []) as Camp[]); setTpls((t.data || []) as Tpl[]); setSegs((s.data || []) as Seg[])
    const st: Record<string, Stat> = {}
    for (const x of (r.data || []) as { campaign_id: string; status: string }[]) {
      const k = (st[x.campaign_id] ||= { total: 0, pending: 0, skipped: 0, sent: 0, delivered: 0, failed: 0 })
      k.total++; if (x.status === 'skipped_no_consent') k.skipped++; else (k as any)[x.status]++
    }
    setStats(st)
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  async function saveCamp() {
    if (!cf || !cf.name.trim()) { setErr('Ad zorunlu'); return }
    const payload = { name: cf.name.trim(), channel: cf.channel, segment_id: cf.segment_id || null, template_id: cf.template_id || null, scheduled_at: cf.scheduled_at ? new Date(cf.scheduled_at).toISOString() : null }
    const { error } = cf.id ? await supabase.from('campaigns').update({ ...payload, status: 'draft' }).eq('id', cf.id) : await supabase.from('campaigns').insert(payload)
    if (error) { setErr(error.message); return }
    setErr(''); setCf(null); load()
  }
  async function saveTpl() {
    if (!tf || !tf.name.trim() || !tf.body.trim()) { setErr('Ad ve metin zorunlu'); return }
    const payload = { name: tf.name.trim(), channel: tf.channel, subject: tf.subject.trim() || null, body: tf.body, is_active: tf.is_active }
    const { error } = tf.id ? await supabase.from('message_templates').update(payload).eq('id', tf.id) : await supabase.from('message_templates').insert({ ...payload, created_by: crm.profile.id })
    if (error) { setErr(error.code === '23505' ? 'Bu isim kullanımda' : error.message); return }
    setErr(''); setTf(null); load()
  }
  async function prepare(id: string) {
    const { data, error } = await supabase.rpc('prepare_campaign', { p_campaign: id })
    if (error) { setMsg(error.message); return }
    const r = (data as any[])[0]; setMsg(`Hedef kitle hazırlandı: ${r.total} kişi, ${r.eligible} izinli, ${r.skipped} izin yok (gönderilmeyecek)`); load()
  }
  const [sending, setSending] = useState('')
  const [prov, setProv] = useState<Record<string, string | null> | null>(null)
  useEffect(() => { fetch('/api/crm/messaging').then(r => r.json()).then(j => { if (j.ok) setProv(Object.fromEntries(j.channels.map((c: any) => [c.channel, c.provider]))) }).catch(() => {}) }, [])
  async function send(c: Camp) {
    if (!confirm(`"${c.name}" kampanyası izinli alıcılara GERÇEKTEN gönderilecek. Devam edilsin mi?`)) return
    setSending(c.id); let sent = 0, failed = 0
    try {
      for (let n = 0; n < 40; n++) {
        const r = await fetch(`/api/crm/campaigns/${c.id}/send`, { method: 'POST' }); const j = await r.json().catch(() => ({}))
        if (!r.ok || !j.ok) { setMsg(j.error || 'Gönderim başlatılamadı'); break }
        sent += j.sent; failed += j.failed + j.retried
        setMsg(`Gönderiliyor… ${sent} gönderildi, ${failed} hatalı/yeniden denenecek, ${j.remaining} bekliyor`); load()
        if (j.remaining === 0) { setMsg(`Tamamlandı: ${sent} gönderildi, ${failed} hatalı`); break }
        if (j.sent + j.failed + j.retried === 0) { setMsg(`Duraklatıldı (gönderim saati dışında veya günlük sınır doldu): ${sent} gönderildi, ${j.remaining} bekliyor. Uygun zamanda tekrar "Gönder"e basın.`); break }
      }
    } finally { setSending(''); load() }
  }
  async function setStatus(id: string, status: string) { const { error } = await supabase.from('campaigns').update({ status }).eq('id', id); setMsg(error ? error.message : ''); load() }

  return (
    <>
      <CrmTopBar title="Kampanyalar" action={canWrite && <button className="btn" onClick={() => { setErr(''); tab === 'kampanya' ? setCf({ id: '', name: '', channel: 'sms', segment_id: '', template_id: '', scheduled_at: '' }) : setTf({ id: '', name: '', channel: 'sms', subject: '', body: '', is_active: true }) }}><Plus size={14} /> {tab === 'kampanya' ? 'Kampanya Ekle' : 'Şablon Ekle'}</button>} />
      <div style={{ padding: 22, maxWidth: 1000, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="card" style={{ padding: 12, fontSize: 12.5, color: 'var(--tx2)', display: 'flex', gap: 8 }}><Info size={15} style={{ flexShrink: 0, color: 'var(--ac)' }} />
          Hedef kitle yalnızca ilgili kanalda pazarlama izni olan müşterilerden oluşur. Gönderim yalnızca 09:00-20:00 (İstanbul) arasında ve günlük sınır dahilinde yapılır; izni iptal edilen kişiye gönderilmez. SMS metnine ret yolu (ör. "İptal için İPTAL yazın") eklemeyi unutmayın.
          {prov && <> Sağlayıcı: {(['sms', 'whatsapp', 'email'] as const).map(k => <span key={k} className={`badge ${prov[k] ? 'badge-green' : 'badge-muted'}`} style={{ marginLeft: 4 }}>{CH[k]}: {prov[k] || 'bağlı değil'}</span>)}</>}</div>
        {msg && <div className="card" style={{ padding: 12, fontSize: 13, color: 'var(--tx2)' }}>{msg}</div>}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="tabs"><button className={`tab ${tab === 'kampanya' ? 'active' : ''}`} onClick={() => setTab('kampanya')}>Kampanyalar</button><button className={`tab ${tab === 'sablon' ? 'active' : ''}`} onClick={() => setTab('sablon')}>Şablonlar</button></div>
          {tab === 'kampanya' ? (camps.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Kampanya yok</div> : camps.map(c => {
            const s = stats[c.id]
            return (
              <div key={c.id} style={{ padding: '12px 16px', borderTop: '1px solid var(--bdr)', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{c.name} <span className="badge badge-muted">{CH[c.channel]}</span></div>
                  <div style={{ fontSize: 12, color: 'var(--tx3)' }}>{segs.find(x => x.id === c.segment_id)?.name || 'Segment yok'} · {tpls.find(x => x.id === c.template_id)?.name || 'Şablon yok'}{s ? ` · ${s.total} kişi / ${s.total - s.skipped} izinli / ${s.sent + s.delivered} gönderildi / ${s.failed} hatalı` : ' · hedef kitle hazırlanmadı'}</div>
                </div>
                <span className={`badge ${STATUS[c.status][1]}`}>{STATUS[c.status][0]}</span>
                {crm.can('campaigns.send') && ['ready', 'sending'].includes(c.status) && s && s.total - s.skipped > 0 && <button className="btn" disabled={!!sending || !prov?.[c.channel]} title={prov?.[c.channel] ? '' : 'Bu kanal için sağlayıcı bağlı değil'} onClick={() => send(c)}>{sending === c.id ? 'Gönderiliyor…' : 'Gönder'}</button>}
                {canWrite && ['draft', 'ready'].includes(c.status) && <>
                  <button className="btn-ghost" onClick={() => setCf({ id: c.id, name: c.name, channel: c.channel, segment_id: c.segment_id || '', template_id: c.template_id || '', scheduled_at: '' })}>Düzenle</button>
                  <button className="btn-ghost" onClick={() => prepare(c.id)}>Hedef kitleyi hazırla</button>
                  {c.status === 'draft' && <button className="btn" onClick={() => setStatus(c.id, 'ready')}>Hazır</button>}
                  <button className="btn-ghost" onClick={() => setStatus(c.id, 'cancelled')}>İptal</button></>}
              </div>)
          })) : (tpls.length === 0 ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Şablon yok</div> : tpls.map(t => (
            <div key={t.id} style={{ padding: '12px 16px', borderTop: '1px solid var(--bdr)', display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>{t.name} <span className="badge badge-muted">{CH[t.channel]}</span> {!t.is_active && <span className="badge badge-red">Pasif</span>}</div><div style={{ fontSize: 12, color: 'var(--tx3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.body}</div></div>
              {canWrite && <button className="btn-ghost" onClick={() => setTf({ id: t.id, name: t.name, channel: t.channel, subject: t.subject || '', body: t.body, is_active: t.is_active })}>Düzenle</button>}
            </div>)))}
        </div>
      </div>

      {cf && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setCf(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 460 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{cf.id ? 'Kampanyayı Düzenle' : 'Kampanya Ekle'}</h2><button onClick={() => setCf(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div><label className="label">Ad *</label><input className="inp" value={cf.name} onChange={e => setCf({ ...cf, name: e.target.value })} /></div>
              <div className="modal-grid">
                <div><label className="label">Kanal</label><select className="inp" value={cf.channel} onChange={e => setCf({ ...cf, channel: e.target.value, template_id: '' })}>{Object.entries(CH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
                <div><label className="label">Planlanan zaman</label><input className="inp" type="datetime-local" value={cf.scheduled_at} onChange={e => setCf({ ...cf, scheduled_at: e.target.value })} /></div>
              </div>
              <div><label className="label">Segment</label><select className="inp" value={cf.segment_id} onChange={e => setCf({ ...cf, segment_id: e.target.value })}><option value="">Seçin</option>{segs.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
              <div><label className="label">Şablon</label><select className="inp" value={cf.template_id} onChange={e => setCf({ ...cf, template_id: e.target.value })}><option value="">Seçin</option>{tpls.filter(t => t.channel === cf.channel && t.is_active).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setCf(null)}>Vazgeç</button><button className="btn" onClick={saveCamp}>Kaydet</button></div>
            </div>
          </div>
        </div>)}
      {tf && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) setTf(null) }}>
          <div className="modal anim-pop" style={{ maxWidth: 500 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 14 }}><h2 className="modal-title" style={{ marginBottom: 0 }}>{tf.id ? 'Şablonu Düzenle' : 'Şablon Ekle'}</h2><button onClick={() => setTf(null)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button></div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="modal-grid"><div><label className="label">Ad *</label><input className="inp" value={tf.name} onChange={e => setTf({ ...tf, name: e.target.value })} /></div>
                <div><label className="label">Kanal</label><select className="inp" value={tf.channel} onChange={e => setTf({ ...tf, channel: e.target.value })}>{Object.entries(CH).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div></div>
              {tf.channel === 'email' && <div><label className="label">Konu</label><input className="inp" value={tf.subject} onChange={e => setTf({ ...tf, subject: e.target.value })} /></div>}
              <div><label className="label">Metin * <span style={{ color: 'var(--tx3)' }}>({'{{ad}}'} müşteri adı)</span></label><textarea className="inp" rows={4} value={tf.body} onChange={e => setTf({ ...tf, body: e.target.value })} /></div>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--tx2)' }}><input type="checkbox" checked={tf.is_active} onChange={e => setTf({ ...tf, is_active: e.target.checked })} /> Aktif</label>
              {err && <div style={{ fontSize: 12.5, color: 'var(--red)' }}>{err}</div>}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><button className="btn-ghost" onClick={() => setTf(null)}>Vazgeç</button><button className="btn" onClick={saveTpl}>Kaydet</button></div>
            </div>
          </div>
        </div>)}
    </>
  )
}
