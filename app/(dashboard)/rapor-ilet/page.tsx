'use client'

import React, { useState, useEffect } from 'react'
import { Send, TrendingUp, Globe, FileText, CheckCircle, AlertCircle, Eye, Save, BarChart2, RotateCcw, Plus, Trash2, Calendar, X } from 'lucide-react'
import TopBar from '@/components/TopBar'

// ─── TYPES ──────────────────────────────────────────────
type Sekme = 'gunluk' | 'haftalik' | 'aylik'
type ReklamKalemi = { id: string; grup: string; kalem: string; tutar: string }
type SendState = 'idle' | 'previewing' | 'preview_ok' | 'sending' | 'sent_ok' | 'sent_err'

// ─── HELPERS ────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 8)
const fmt = (n: number) => n.toLocaleString('tr-TR')

export default function RaporIletPage() {
  const _now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Istanbul' }))
  const todayISO = `${_now.getFullYear()}-${String(_now.getMonth()+1).padStart(2,'0')}-${String(_now.getDate()).padStart(2,'0')}`
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const ayLabel = new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })

  const [sekme, setSekme] = useState<Sekme>('gunluk')

  // ── GÜNLÜK STATE ──
  const emptyForm = {
    trendyol_adet: '', trendyol_tutar: '',
    site_rb_adet: '', site_rb_tutar: '',
    site_935_adet: '', site_935_tutar: '',
    iade_trendyol_adet: '', iade_trendyol_tutar: '',
    iade_rb_adet: '', iade_rb_tutar: '',
    iade_935_adet: '', iade_935_tutar: '',
    durum: '',
    mail_to: 'kerem@robertobravo.com',
  }
  const [form, setForm] = useState(emptyForm)
  const [aylik, setAylik] = useState({ trendyol_adet: 0, trendyol_tutar: 0, site_rb_adet: 0, site_rb_tutar: 0, site_935_adet: 0, site_935_tutar: 0, iade_trendyol_adet: 0, iade_trendyol_tutar: 0, iade_rb_adet: 0, iade_rb_tutar: 0, iade_935_adet: 0, iade_935_tutar: 0 })
  const [saving, setSaving] = useState(false)
  const [saveResult, setSaveResult] = useState<'ok' | 'err' | null>(null)
  const [loadingAylik, setLoadingAylik] = useState(true)
  const [gunlukState, setGunlukState] = useState<SendState>('idle')
  const [gunlukPreviewHtml, setGunlukPreviewHtml] = useState('')

  // ── HAFTALIK STATE ──
  const [haftalikMail, setHaftalikMail] = useState('kerem@robertobravo.com')
  const [haftalikState, setHaftalikState] = useState<SendState>('idle')
  const [haftalikPreviewHtml, setHaftalikPreviewHtml] = useState('')
  const [haftalikMeta, setHaftalikMeta] = useState<any>(null)

  // ── AYLIK STATE ──
  const [aylikMail, setAylikMail] = useState('kerem@robertobravo.com')
  const [aylikState, setAylikState] = useState<SendState>('idle')
  const [aylikPreviewHtml, setAylikPreviewHtml] = useState('')
  const [aylikMeta, setAylikMeta] = useState<any>(null)
  const [reklamKalemleri, setReklamKalemleri] = useState<ReklamKalemi[]>([
    { id: uid(), grup: 'Altın', kalem: 'search', tutar: '' },
    { id: uid(), grup: 'Altın', kalem: 'xml', tutar: '' },
    { id: uid(), grup: 'Altın', kalem: 'engagement', tutar: '' },
    { id: uid(), grup: 'Gümüş', kalem: 'pmax', tutar: '' },
    { id: uid(), grup: 'Gümüş', kalem: 'engagement', tutar: '' },
    { id: uid(), grup: 'Gümüş', kalem: 'xml', tutar: '' },
  ])

  // ── GÜNLÜK HESAPLAMALAR ──
  const brut_adet = (parseInt(form.trendyol_adet)||0) + (parseInt(form.site_rb_adet)||0) + (parseInt(form.site_935_adet)||0)
  const brut_tutar = (parseFloat(form.trendyol_tutar)||0) + (parseFloat(form.site_rb_tutar)||0) + (parseFloat(form.site_935_tutar)||0)
  const iade_adet = (parseInt(form.iade_trendyol_adet)||0) + (parseInt(form.iade_rb_adet)||0) + (parseInt(form.iade_935_adet)||0)
  const iade_tutar = (parseFloat(form.iade_trendyol_tutar)||0) + (parseFloat(form.iade_rb_tutar)||0) + (parseFloat(form.iade_935_tutar)||0)
  const net_adet = brut_adet - iade_adet
  const net_tutar = brut_tutar - iade_tutar
  const ay_brut_adet  = (parseInt(String(aylik.trendyol_adet))||0)  + (parseInt(String(aylik.site_rb_adet))||0)  + (parseInt(String(aylik.site_935_adet))||0)  + brut_adet
  const ay_brut_tutar = (parseFloat(String(aylik.trendyol_tutar))||0) + (parseFloat(String(aylik.site_rb_tutar))||0) + (parseFloat(String(aylik.site_935_tutar))||0) + brut_tutar
  const ay_iade_adet  = (parseInt(String(aylik.iade_trendyol_adet))||0)  + (parseInt(String(aylik.iade_rb_adet))||0)  + (parseInt(String(aylik.iade_935_adet))||0)  + iade_adet
  const ay_iade_tutar = (parseFloat(String(aylik.iade_trendyol_tutar))||0) + (parseFloat(String(aylik.iade_rb_tutar))||0) + (parseFloat(String(aylik.iade_935_tutar))||0) + iade_tutar
  const ay_net_adet   = ay_brut_adet  - ay_iade_adet
  const ay_net_tutar  = ay_brut_tutar - ay_iade_tutar

  // ── EFFECTS ──
  useEffect(() => {
    const saved = localStorage.getItem('rapor-form-' + todayISO)
    if (saved) { try { setForm(f => ({ ...f, ...JSON.parse(saved) })) } catch {} }
  }, [])
  useEffect(() => { localStorage.setItem('rapor-form-' + todayISO, JSON.stringify(form)) }, [form])
  useEffect(() => {
    async function loadData() {
      setLoadingAylik(true)
      try {
        const res = await fetch(`/api/rapor-ilet/data?tarih=${todayISO}`)
        const data = await res.json()
        if (data.bugun) setForm(f => ({ ...f, trendyol_adet: String(data.bugun.trendyol_adet||''), trendyol_tutar: String(data.bugun.trendyol_tutar||''), site_rb_adet: String(data.bugun.site_rb_adet||''), site_rb_tutar: String(data.bugun.site_rb_tutar||''), site_935_adet: String(data.bugun.site_935_adet||''), site_935_tutar: String(data.bugun.site_935_tutar||''), iade_trendyol_adet: String(data.bugun.iade_trendyol_adet||''), iade_trendyol_tutar: String(data.bugun.iade_trendyol_tutar||''), iade_rb_adet: String(data.bugun.iade_rb_adet||''), iade_rb_tutar: String(data.bugun.iade_rb_tutar||''), iade_935_adet: String(data.bugun.iade_935_adet||''), iade_935_tutar: String(data.bugun.iade_935_tutar||''), durum: data.bugun.durum||'' }))
        if (data.aylik) setAylik(data.aylik)
      } catch {}
      setLoadingAylik(false)
    }
    loadData()
  }, [])

  // ── ACTIONS ──
  async function saveToDb() {
    setSaving(true); setSaveResult(null)
    try {
      const res = await fetch('/api/rapor-ilet/kaydet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tarih: todayISO, trendyol_adet: parseInt(form.trendyol_adet)||0, trendyol_tutar: parseFloat(form.trendyol_tutar)||0, site_rb_adet: parseInt(form.site_rb_adet)||0, site_rb_tutar: parseFloat(form.site_rb_tutar)||0, site_935_adet: parseInt(form.site_935_adet)||0, site_935_tutar: parseFloat(form.site_935_tutar)||0, iade_trendyol_adet: parseInt(form.iade_trendyol_adet)||0, iade_trendyol_tutar: parseFloat(form.iade_trendyol_tutar)||0, iade_rb_adet: parseInt(form.iade_rb_adet)||0, iade_rb_tutar: parseFloat(form.iade_rb_tutar)||0, iade_935_adet: parseInt(form.iade_935_adet)||0, iade_935_tutar: parseFloat(form.iade_935_tutar)||0, durum: form.durum }) })
      setSaveResult((await res.json()).ok ? 'ok' : 'err')
    } catch { setSaveResult('err') }
    setSaving(false)
  }

  // Günlük: önizle
  async function gunlukOnizle() {
    setGunlukState('previewing')
    // Günlük önizleme için mevcut state'den HTML build et (inline)
    setGunlukPreviewHtml('__GUNLUK__') // trigger modal
    setGunlukState('preview_ok')
  }
  // Günlük: gönder
  async function gunlukGonder() {
    setGunlukState('sending')
    try {
      const res = await fetch('/api/rapor-ilet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, tarih: today, tarih_iso: todayISO, ay_label: ayLabel, brut_adet, brut_tutar, iade_adet, iade_tutar, net_adet, net_tutar, ay_brut_adet, ay_brut_tutar, ay_iade_adet, ay_iade_tutar, ay_net_adet, ay_net_tutar }) })
      setGunlukState((await res.json()).ok ? 'sent_ok' : 'sent_err')
    } catch { setGunlukState('sent_err') }
  }

  // Haftalık: önizle
  async function haftalikOnizle() {
    setHaftalikState('previewing')
    try {
      const res = await fetch('/api/rapor-ilet/haftalik', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mail_to: haftalikMail, preview_only: true }) })
      const data = await res.json()
      if (data.ok) { setHaftalikPreviewHtml(data.html); setHaftalikMeta(data.meta); setHaftalikState('preview_ok') }
      else setHaftalikState('idle')
    } catch { setHaftalikState('idle') }
  }
  // Haftalık: gönder
  async function haftalikGonder() {
    setHaftalikState('sending')
    try {
      const res = await fetch('/api/rapor-ilet/haftalik', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mail_to: haftalikMail, preview_only: false }) })
      setHaftalikState((await res.json()).ok ? 'sent_ok' : 'sent_err')
    } catch { setHaftalikState('sent_err') }
  }

  // Aylık: önizle
  async function aylikOnizle() {
    setAylikState('previewing')
    const kalemleri = reklamKalemleri.filter(k => k.tutar !== '').map(k => ({ grup: k.grup, kalem: k.kalem, tutar: parseFloat(k.tutar)||0 }))
    try {
      const res = await fetch('/api/rapor-ilet/aylik', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mail_to: aylikMail, preview_only: true, reklam_kalemleri: kalemleri }) })
      const data = await res.json()
      if (data.ok) { setAylikPreviewHtml(data.html); setAylikMeta(data.meta); setAylikState('preview_ok') }
      else setAylikState('idle')
    } catch { setAylikState('idle') }
  }
  // Aylık: gönder
  async function aylikGonder() {
    setAylikState('sending')
    const kalemleri = reklamKalemleri.filter(k => k.tutar !== '').map(k => ({ grup: k.grup, kalem: k.kalem, tutar: parseFloat(k.tutar)||0 }))
    try {
      const res = await fetch('/api/rapor-ilet/aylik', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mail_to: aylikMail, preview_only: false, reklam_kalemleri: kalemleri }) })
      setAylikState((await res.json()).ok ? 'sent_ok' : 'sent_err')
    } catch { setAylikState('sent_err') }
  }

  // Reklam kalem işlemleri
  const reklamGuncelle = (id: string, field: keyof ReklamKalemi, val: string) =>
    setReklamKalemleri(prev => prev.map(k => k.id === id ? { ...k, [field]: val } : k))
  const reklamEkle = () => setReklamKalemleri(prev => [...prev, { id: uid(), grup: prev[prev.length-1]?.grup || 'Altın', kalem: '', tutar: '' }])
  const reklamSil = (id: string) => setReklamKalemleri(prev => prev.filter(k => k.id !== id))
  const toplamReklam = reklamKalemleri.reduce((a, k) => a + (parseFloat(k.tutar)||0), 0)


  // ── UI HELPERS (render fonksiyonları — bileşen değil, odak kaybı olmasın) ──
  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value }))
  const mono = 'JetBrains Mono, monospace'
  const secTitle = (Icon: any, text: string, color = 'var(--tx2)') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
      <Icon size={14} style={{ color }} strokeWidth={1.6} />
      <span className="card-title" style={{ color }}>{text}</span>
    </div>
  )
  const field = (label: string, prefix: string, key: keyof typeof form, red?: boolean) => (
    <div>
      <label className="label" style={red ? { color: 'var(--red)' } : undefined}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', background: red ? 'var(--red2)' : 'var(--s3)', border: `1px solid ${red ? 'rgba(242,87,87,.25)' : 'var(--bdr2)'}`, borderRadius: 8, overflow: 'hidden' }}>
        <span style={{ padding: '0 12px', fontSize: 13, color: red ? 'var(--red)' : 'var(--tx3)', borderRight: `1px solid ${red ? 'rgba(242,87,87,.2)' : 'var(--bdr)'}` }}>{prefix}</span>
        <input type="text" inputMode={prefix === '#' ? 'numeric' : 'decimal'} value={String(form[key])} onChange={f(key)} placeholder={prefix === '#' ? '0' : '0.00'}
          style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', outline: 'none', padding: '10px 12px', fontSize: 13, color: red ? 'var(--red)' : 'var(--tx)', fontFamily: mono }} />
      </div>
    </div>
  )
  const satisField = (label: string, a: keyof typeof form, t: keyof typeof form, red?: boolean) => (
    <div className="modal-grid">
      {field(`${label} Adet`, '#', a, red)}
      {field(`${label} ${red ? 'Tutar' : 'Ciro'}`, '₺', t, red)}
    </div>
  )
  const metric = (label: string, value: React.ReactNode, sub?: React.ReactNode, color = 'var(--tx)') => (
    <div>
      <div className="kpi-label" style={{ color: color === 'var(--tx)' ? undefined : color }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 600, color, lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color, opacity: .8, marginTop: 2, fontFamily: mono }}>{sub}</div>}
    </div>
  )
  const statusBox = (ok: boolean, text: string, onReset: () => void, resetLabel: string) => (
    <div className={`toast ${ok ? 'toast-ok' : 'toast-err'}`} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
      {ok ? <CheckCircle size={14} /> : <AlertCircle size={14} />} {text}
      <button onClick={onReset} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'inherit', opacity: .75, fontSize: 11 }}>{resetLabel}</button>
    </div>
  )

  // Haftalık / Aylık gönderim akışı
  const sendFlow = (state: SendState, onPreview: () => void, onSend: () => void, onReset: () => void, mail: string, setMail: (v: string) => void, label: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <label className="label">Alıcı E-posta</label>
        <input className="inp" type="text" value={mail} onChange={e => setMail(e.target.value)} placeholder="mail@domain.com" />
      </div>
      {state === 'idle' && <button className="btn-ghost" onClick={onPreview} style={{ justifyContent: 'center', padding: '12px 0' }}><Eye size={14} /> Önizle</button>}
      {state === 'previewing' && <div style={{ padding: 12, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Rapor hazırlanıyor...</div>}
      {state === 'preview_ok' && (
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn-ghost" onClick={onPreview} style={{ flex: '0 0 auto' }}><Eye size={14} /> Önizlemeyi Aç</button>
          <button className="btn" onClick={onSend} style={{ flex: 1, justifyContent: 'center' }}><Send size={13} /> Gönder</button>
        </div>
      )}
      {state === 'sending' && <div style={{ padding: 12, textAlign: 'center', color: 'var(--ac)', fontSize: 13 }}>Gönderiliyor...</div>}
      {state === 'sent_ok' && statusBox(true, `${label} başarıyla gönderildi.`, onReset, 'Sıfırla')}
      {state === 'sent_err' && statusBox(false, 'Gönderilemedi.', onReset, 'Tekrar dene')}
    </div>
  )

  const previewModal = (html: string, onClose: () => void, onSend: () => void) => (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }} style={{ alignItems: 'flex-start', overflowY: 'auto' }}>
      <div className="modal anim-pop" style={{ maxWidth: 680, width: '100%', margin: '24px auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Eye size={14} style={{ color: 'var(--ac)' }} /><h2 className="modal-title" style={{ marginBottom: 0 }}>Mail Önizleme</h2></div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
        </div>
        <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid var(--bdr2)', background: '#fff' }}>
          <iframe srcDoc={html} style={{ width: '100%', border: 'none', minHeight: 500, height: '60vh' }} title="Mail Önizleme" />
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          <button className="btn-ghost" onClick={onClose}><X size={13} /> Kapat</button>
          <button className="btn" onClick={onSend} style={{ flex: 1, justifyContent: 'center' }}><Send size={13} /> Onayla &amp; Gönder</button>
        </div>
      </div>
    </div>
  )

  const sekmeler: [Sekme, string][] = [['gunluk', 'Günlük Rapor'], ['haftalik', 'Haftalık Rapor'], ['aylik', 'Aylık Rapor']]

  return (
    <>
      {haftalikState === 'preview_ok' && haftalikPreviewHtml && previewModal(haftalikPreviewHtml, () => setHaftalikPreviewHtml(''), haftalikGonder)}
      {aylikState === 'preview_ok' && aylikPreviewHtml && previewModal(aylikPreviewHtml, () => setAylikPreviewHtml(''), aylikGonder)}

      <TopBar title="Rapor İlet" subtitle={today} />

      <div className="tabs" style={{ paddingLeft: 12, overflowX: 'auto' }}>
        {sekmeler.map(([key, label]) => <button key={key} className={`tab${sekme === key ? ' active' : ''}`} onClick={() => setSekme(key)}>{label}</button>)}
      </div>

      <div style={{ padding: 22, maxWidth: 1100, width: '100%', margin: '0 auto' }}>

        {/* ════════════ GÜNLÜK ════════════ */}
        {sekme === 'gunluk' && (
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 440px', maxWidth: 560, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card" style={{ padding: 18, background: 'var(--ac3)', borderColor: 'rgba(124,106,247,.25)' }}>
                {secTitle(BarChart2, `${ayLabel} — Net Toplam (Bugün Dahil)`, 'var(--ac)')}
                {loadingAylik ? <p style={{ fontSize: 12, color: 'var(--tx3)' }}>Yükleniyor...</p> : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                    {metric('Net Satış', <>{ay_net_adet} <small style={{ fontSize: 11, color: 'var(--tx3)' }}>adet</small></>)}
                    {metric('Net Ciro', <>{fmt(ay_net_tutar)} <small style={{ fontSize: 11, color: 'var(--tx3)' }}>₺</small></>)}
                    {metric('İade', <>{ay_iade_adet} <small style={{ fontSize: 11 }}>adet</small></>, `${fmt(ay_iade_tutar)} ₺`, 'var(--red)')}
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 18 }}>{secTitle(TrendingUp, 'Trendyol', 'var(--ac)')}{satisField('Satış', 'trendyol_adet', 'trendyol_tutar')}</div>
              <div className="card" style={{ padding: 18 }}>{secTitle(Globe, 'robertobravo.com')}{satisField('Satış', 'site_rb_adet', 'site_rb_tutar')}</div>
              <div className="card" style={{ padding: 18 }}>{secTitle(Globe, '935byrobertobravo.com', 'var(--blue)')}{satisField('Satış', 'site_935_adet', 'site_935_tutar')}</div>

              <div className="card" style={{ padding: 18, background: 'var(--red2)', borderColor: 'rgba(242,87,87,.2)' }}>
                {secTitle(RotateCcw, 'İadeler', 'var(--red)')}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {satisField('Trendyol', 'iade_trendyol_adet', 'iade_trendyol_tutar', true)}
                  {satisField('RB Site', 'iade_rb_adet', 'iade_rb_tutar', true)}
                  {satisField('935 Site', 'iade_935_adet', 'iade_935_tutar', true)}
                </div>
              </div>

              {(brut_adet > 0 || brut_tutar > 0) && (
                <div className="card" style={{ padding: '14px 18px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
                    {metric('Brüt', <>{brut_adet} <small style={{ fontSize: 10 }}>adet</small></>, `${fmt(brut_tutar)} ₺`, 'var(--tx2)')}
                    {metric('İade', <>-{iade_adet} <small style={{ fontSize: 10 }}>adet</small></>, `-${fmt(iade_tutar)} ₺`, 'var(--red)')}
                    {metric('Bugün Net', <>{net_adet} <small style={{ fontSize: 10 }}>adet</small></>, `${fmt(net_tutar)} ₺`, 'var(--green)')}
                  </div>
                </div>
              )}

              <div className="card" style={{ padding: 18 }}>
                {secTitle(FileText, 'Durum Notu')}
                <textarea className="inp" value={form.durum} onChange={e => setForm(p => ({ ...p, durum: e.target.value }))} placeholder="Günün özeti..." rows={3} style={{ resize: 'vertical', lineHeight: 1.6 }} />
              </div>

              <button className="btn-ghost" onClick={saveToDb} disabled={saving} style={{ justifyContent: 'center', padding: '12px 0', opacity: saving ? .7 : 1 }}>
                <Save size={13} />{saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              {saveResult === 'ok' && <div className="toast toast-ok" style={{ margin: 0 }}><CheckCircle size={13} style={{ display: 'inline', marginRight: 6 }} />Kaydedildi.</div>}
              {saveResult === 'err' && <div className="toast toast-err" style={{ margin: 0 }}><AlertCircle size={13} style={{ display: 'inline', marginRight: 6 }} />Kaydedilemedi.</div>}

              <div>
                <label className="label">Alıcı E-posta</label>
                <input className="inp" type="text" value={form.mail_to} onChange={f('mail_to')} placeholder="mail@domain.com" style={{ marginBottom: 10 }} />
                {(gunlukState === 'idle' || gunlukState === 'previewing') && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button className="btn-ghost" onClick={() => setGunlukState('preview_ok')}><Eye size={14} /> Önizle</button>
                    <button className="btn" onClick={gunlukGonder} style={{ flex: 1, justifyContent: 'center' }}><Send size={13} /> Raporu Gönder</button>
                  </div>
                )}
                {gunlukState === 'sending' && <div style={{ padding: 12, textAlign: 'center', color: 'var(--ac)', fontSize: 13 }}>Gönderiliyor...</div>}
                {gunlukState === 'sent_ok' && statusBox(true, 'Rapor başarıyla gönderildi.', () => setGunlukState('idle'), 'Sıfırla')}
                {gunlukState === 'sent_err' && statusBox(false, 'Gönderilemedi.', () => setGunlukState('idle'), 'Tekrar dene')}
              </div>
            </div>

            {/* Günlük önizleme (mail şablonu — mailin kendi görünümü) */}
            {gunlukState === 'preview_ok' && (
              <div style={{ flex: '1 1 380px', minWidth: 0 }}>
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Eye size={13} style={{ color: 'var(--tx3)' }} /><span className="card-title">Mail Önizleme</span></div>
                  <button onClick={() => setGunlukState('idle')} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={16} /></button>
                </div>
                <div style={{ background: '#F8F5F0', borderRadius: 12, overflow: 'hidden', border: '1px solid var(--bdr2)' }}>
                  <div style={{ background: '#EDE8E0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(139,105,20,0.12)' }}>
                    <div style={{ display: 'flex', gap: 5 }}>{['#C4364A', '#C9A84C', '#7AC98A'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.6 }} />)}</div>
                    <div style={{ flex: 1, background: '#E4DFD8', borderRadius: 4, padding: '4px 10px', fontSize: 10, color: '#7A7570' }}>Roberto Bravo — Günlük Rapor · {today}</div>
                  </div>
                  <div style={{ fontFamily: 'Georgia, serif' }}>
                    <div style={{ padding: '40px 40px 28px', background: '#FFFFFF', borderBottom: '1px solid rgba(139,105,20,0.2)' }}><p style={{ margin: '0 0 6px', fontSize: 9, letterSpacing: '4px', textTransform: 'uppercase', color: '#7A7570' }}>Roberto Bravo</p><h1 style={{ margin: '0 0 4px', fontSize: 30, fontWeight: 300, color: '#1A1410' }}>Günlük Rapor</h1><p style={{ margin: 0, fontSize: 12, color: '#6A6460' }}>{today}</p></div>
                    <div style={{ padding: '24px 40px', background: '#1A1610', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                      <p style={{ margin: '0 0 14px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C' }}>{ayLabel} — Aylık Net</p>
                      <div style={{ display: 'flex', gap: 40 }}>
                        <div><p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7570' }}>Net Satış</p><p style={{ margin: 0, fontSize: 36, fontWeight: 300, color: '#C9A84C', lineHeight: 1 }}>{ay_net_adet} <span style={{ fontSize: 12, color: '#7A7570' }}>adet</span></p></div>
                        <div><p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7570' }}>Net Ciro</p><p style={{ margin: 0, fontSize: 36, fontWeight: 300, color: '#C9A84C', lineHeight: 1 }}>{fmt(ay_net_tutar)} <span style={{ fontSize: 12, color: '#7A7570' }}>₺</span></p></div>
                      </div>
                    </div>
                    <div style={{ padding: '24px 40px', background: '#F4EFE8', borderBottom: '1px solid rgba(139,105,20,0.15)' }}>
                      <p style={{ margin: '0 0 8px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#8B6914' }}>Bugün</p>
                      <div style={{ display: 'flex', gap: 32 }}>
                        <div><p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7570' }}>Brüt</p><p style={{ margin: 0, fontSize: 32, fontWeight: 300, color: '#1A1410', lineHeight: 1 }}>{brut_adet} <span style={{ fontSize: 11, color: '#6A6460' }}>adet</span></p><p style={{ margin: '2px 0 0', fontSize: 11, color: '#7A7570' }}>{fmt(brut_tutar)} ₺</p></div>
                        {iade_adet > 0 && <div><p style={{ margin: '0 0 2px', fontSize: 9, color: '#C4364A' }}>İade</p><p style={{ margin: 0, fontSize: 32, fontWeight: 300, color: '#C4364A', lineHeight: 1 }}>-{iade_adet}</p><p style={{ margin: '2px 0 0', fontSize: 11, color: '#C4364A' }}>-{fmt(iade_tutar)} ₺</p></div>}
                        <div><p style={{ margin: '0 0 2px', fontSize: 9, color: '#8B6914' }}>Net</p><p style={{ margin: 0, fontSize: 32, fontWeight: 300, color: '#1A1410', lineHeight: 1 }}>{net_adet} <span style={{ fontSize: 11, color: '#6A6460' }}>adet</span></p><p style={{ margin: '2px 0 0', fontSize: 11, color: '#7A7570' }}>{fmt(net_tutar)} ₺</p></div>
                      </div>
                    </div>
                    <div style={{ padding: '20px 40px', background: '#1A1410' }}><p style={{ margin: 0, fontSize: 9, color: '#9A9590', letterSpacing: '2px', textTransform: 'uppercase' }}>Roberto Bravo — {today}</p></div>
                  </div>
                </div>
                <button className="btn" onClick={gunlukGonder} style={{ marginTop: 16, width: '100%', justifyContent: 'center', padding: '12px 0' }}><Send size={13} /> Onayla &amp; Gönder</button>
              </div>
            )}
          </div>
        )}

        {/* ════════════ HAFTALIK ════════════ */}
        {sekme === 'haftalik' && (
          <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ padding: 18, background: 'var(--ac3)', borderColor: 'rgba(124,106,247,.25)' }}>
              {secTitle(Calendar, 'Haftalık Rapor', 'var(--ac)')}
              <p style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6, margin: 0 }}>Son 7 günün satış verilerini (trendyol + site kırılımları, iadeler, günlük dağılım) otomatik olarak derleyip mail olarak iletir.</p>
            </div>

            {sendFlow(haftalikState, haftalikOnizle, haftalikGonder, () => setHaftalikState('idle'), haftalikMail, setHaftalikMail, 'Haftalık rapor')}

            {haftalikState === 'preview_ok' && haftalikMeta && (
              <div className="card" style={{ padding: '14px 18px' }}>
                <p className="kpi-label" style={{ marginBottom: 10 }}>Rapor özeti · {haftalikMeta.aralik}</p>
                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                  {metric('Net Satış', <>{haftalikMeta.net_adet} <small style={{ fontSize: 11 }}>adet</small></>)}
                  {metric('Net Ciro', <>{fmt(haftalikMeta.net_tutar)} <small style={{ fontSize: 11 }}>₺</small></>)}
                  {metric('Gün Sayısı', haftalikMeta.gun_sayisi)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════ AYLIK ════════════ */}
        {sekme === 'aylik' && (
          <div style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="card" style={{ padding: 18, background: 'var(--ac3)', borderColor: 'rgba(124,106,247,.25)' }}>
              {secTitle(BarChart2, `Aylık Rapor — ${ayLabel}`, 'var(--ac)')}
              <p style={{ fontSize: 13, color: 'var(--tx2)', lineHeight: 1.6, margin: 0 }}>Cari aydaki tüm satış verileri + manuel girdiğin reklam giderlerini derleyip iletir.</p>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <span className="card-title">Dijital Reklam Giderleri</span>
                {toplamReklam > 0 && <span style={{ fontSize: 12, color: 'var(--ac)', fontFamily: mono }}>Toplam: {fmt(toplamReklam)} ₺</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reklamKalemleri.map(k => (
                  <div key={k.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(70px,110px) 1fr minmax(80px,120px) 34px', gap: 8, alignItems: 'center' }}>
                    <input className="inp" value={k.grup} onChange={e => reklamGuncelle(k.id, 'grup', e.target.value)} placeholder="Grup" style={{ padding: '8px 10px', fontSize: 12 }} />
                    <input className="inp" value={k.kalem} onChange={e => reklamGuncelle(k.id, 'kalem', e.target.value)} placeholder="Kalem (search, pmax...)" style={{ padding: '8px 10px', fontSize: 12 }} />
                    <input className="inp" type="number" value={k.tutar} onChange={e => reklamGuncelle(k.id, 'tutar', e.target.value)} placeholder="₺ 0" style={{ padding: '8px 10px', fontSize: 12, fontFamily: mono }} />
                    <button onClick={() => reklamSil(k.id)} className="btn-danger" style={{ padding: 7, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
              <button onClick={reklamEkle} className="btn-ghost" style={{ marginTop: 12, width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}><Plus size={12} /> Kalem Ekle</button>
            </div>

            {sendFlow(aylikState, aylikOnizle, aylikGonder, () => setAylikState('idle'), aylikMail, setAylikMail, 'Aylık rapor')}

            {aylikState === 'preview_ok' && aylikMeta && (
              <div className="card" style={{ padding: '14px 18px' }}>
                <p className="kpi-label" style={{ marginBottom: 10 }}>Rapor özeti · {aylikMeta.ayLabel}</p>
                <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap' }}>
                  {metric('Net Satış', <>{aylikMeta.net_adet} <small style={{ fontSize: 11 }}>adet</small></>)}
                  {metric('Net Ciro', <>{fmt(aylikMeta.net_tutar)} <small style={{ fontSize: 11 }}>₺</small></>)}
                  {aylikMeta.toplamReklam > 0 && metric('Toplam Reklam', <>{fmt(aylikMeta.toplamReklam)} <small style={{ fontSize: 11 }}>₺</small></>, undefined, 'var(--amber)')}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
