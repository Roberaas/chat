'use client'

import React, { useState, useEffect } from 'react'
import { Send, TrendingUp, Globe, FileText, CheckCircle, AlertCircle, Eye, Save, BarChart2, RotateCcw, Plus, Trash2, Calendar, X } from 'lucide-react'

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

  // ── STYLES ──
  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value }))
  const inputStyle = { flex: 1, background: 'none', border: 'none', outline: 'none', padding: '11px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit' }
  const wrapStyle = (red?: boolean) => ({ display: 'flex', alignItems: 'center', background: red ? 'rgba(168,48,64,0.04)' : 'var(--bg-card)', border: `1px solid ${red ? 'rgba(168,48,64,0.2)' : 'rgba(201,168,76,0.12)'}`, borderRadius: 8, overflow: 'hidden' })
  const prefixStyle = (red?: boolean) => ({ padding: '0 12px', fontSize: 13, color: red ? '#A83040' : '#5A5550', borderRight: `1px solid ${red ? 'rgba(168,48,64,0.15)' : 'rgba(201,168,76,0.08)'}` })
  const labelStyle = { fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#5A5550', marginBottom: 6, display: 'block' }
  const cardStyle = { background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, padding: 20 }

  const SatisField = ({ label, adetKey, tutarKey }: { label: string; adetKey: keyof typeof form; tutarKey: keyof typeof form }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div><label style={labelStyle}>{label} Adet</label><div style={wrapStyle()}><span style={prefixStyle()}>#</span><input type="number" value={form[adetKey]} onChange={f(adetKey)} placeholder="0" style={inputStyle} /></div></div>
      <div><label style={labelStyle}>{label} Ciro</label><div style={wrapStyle()}><span style={prefixStyle()}>₺</span><input type="number" value={form[tutarKey]} onChange={f(tutarKey)} placeholder="0.00" style={inputStyle} /></div></div>
    </div>
  )
  const IadeField = ({ label, adetKey, tutarKey }: { label: string; adetKey: keyof typeof form; tutarKey: keyof typeof form }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div><label style={{ ...labelStyle, color: '#A83040' }}>{label} Adet</label><div style={wrapStyle(true)}><span style={prefixStyle(true)}>#</span><input type="text" inputMode="numeric" value={String(form[adetKey])} onChange={e => setForm(p => ({ ...p, [adetKey]: e.target.value }))} placeholder="0" style={{ ...inputStyle, color: '#A83040' }} /></div></div>
      <div><label style={{ ...labelStyle, color: '#A83040' }}>{label} Tutar</label><div style={wrapStyle(true)}><span style={prefixStyle(true)}>₺</span><input type="text" inputMode="decimal" value={String(form[tutarKey])} onChange={e => setForm(p => ({ ...p, [tutarKey]: e.target.value }))} placeholder="0.00" style={{ ...inputStyle, color: '#A83040' }} /></div></div>
    </div>
  )

  // ── SEND BUTTON (yeniden kullanılabilir) ──
  function SendFlow({ state, onPreview, onSend, onReset, mail, setMail, label }:
    { state: SendState; onPreview: () => void; onSend: () => void; onReset: () => void; mail: string; setMail: (v: string) => void; label: string }) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label style={labelStyle}>Alıcı E-posta</label>
          <div style={wrapStyle()}><input type="text" value={mail} onChange={e => setMail(e.target.value)} placeholder="mail@domain.com" style={inputStyle} /></div>
        </div>
        {state === 'idle' && (
          <button onClick={onPreview} style={{ width: '100%', padding: '14px 24px', background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.3)', borderRadius: 10, color: 'var(--gold-light)', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Eye size={13} /> Önizle
          </button>
        )}
        {state === 'previewing' && (
          <div style={{ padding: '14px', textAlign: 'center', color: '#7A7468', fontSize: 13 }}>Rapor hazırlanıyor...</div>
        )}
        {state === 'preview_ok' && (
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onReset} style={{ flex: '0 0 auto', padding: '14px 16px', background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, color: '#7A7468', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <X size={14} /> Kapat
            </button>
            <button onClick={onSend} style={{ flex: 1, padding: '14px 24px', background: 'linear-gradient(135deg,#C9A84C,#8B6914)', border: 'none', borderRadius: 10, color: 'var(--bg-base)', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <Send size={13} /> Onayla & Gönder
            </button>
          </div>
        )}
        {state === 'sending' && (
          <div style={{ padding: '14px', textAlign: 'center', color: '#C9A84C', fontSize: 13 }}>Gönderiliyor...</div>
        )}
        {state === 'sent_ok' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(76,168,100,0.08)', border: '1px solid rgba(76,168,100,0.2)', borderRadius: 8, color: '#7AC98A', fontSize: 13 }}>
            <CheckCircle size={14} /> {label} başarıyla gönderildi.
            <button onClick={onReset} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#7A7468', cursor: 'pointer', fontSize: 11 }}>Sıfırla</button>
          </div>
        )}
        {state === 'sent_err' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(168,76,76,0.08)', border: '1px solid rgba(168,76,76,0.2)', borderRadius: 8, color: '#C98A8A', fontSize: 13 }}>
            <AlertCircle size={14} /> Gönderilemedi. <button onClick={onReset} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#C98A8A', cursor: 'pointer', fontSize: 11 }}>Tekrar dene</button>
          </div>
        )}
      </div>
    )
  }

  // ── PREVIEW MODAL ──
  function PreviewModal({ html, onClose }: { html: string; onClose: () => void }) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '40px 20px', overflowY: 'auto' }}>
        <div style={{ background: 'var(--bg-base)', borderRadius: 16, width: '100%', maxWidth: 680, border: '1px solid rgba(201,168,76,0.2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={13} color="#C9A84C" />
              <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A7468' }}>Mail Önizleme</span>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#7A7468', cursor: 'pointer' }}><X size={16} /></button>
          </div>
          <div style={{ padding: 20 }}>
            <div style={{ background: '#F8F5F0', borderRadius: 10, overflow: 'hidden', border: '1px solid rgba(139,105,20,0.15)' }}>
              <div style={{ background: '#EDE8E0', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 6, borderBottom: '1px solid rgba(139,105,20,0.12)' }}>
                {['#C4364A','#C9A84C','#7AC98A'].map(c => <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c, opacity: 0.6 }} />)}
              </div>
              <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
                <iframe srcDoc={html} style={{ width: '100%', border: 'none', minHeight: 600 }} title="Mail Önizleme" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Günlük için önizleme HTML'i al (existing route kullanarak preview isteği atmak yerine state'den türet)
  // Bunun için /api/rapor-ilet POST'u preview_only desteklemiyor, modal'da mevcut önizleme panelini göster
  const gunlukPreviewContent = gunlukState === 'preview_ok'

  return (
    <>
      {/* HAFTALIK PREVIEW MODAL */}
      {haftalikState === 'preview_ok' && haftalikPreviewHtml && (
        <PreviewModal html={haftalikPreviewHtml} onClose={() => setHaftalikState('idle')} />
      )}
      {/* AYLIK PREVIEW MODAL */}
      {aylikState === 'preview_ok' && aylikPreviewHtml && (
        <PreviewModal html={aylikPreviewHtml} onClose={() => setAylikState('idle')} />
      )}

      <div style={{ padding: '24px 16px', maxWidth: 900, margin: '0 auto' }}>
        <style>{`
          @keyframes spin { to { transform: rotate(360deg); } }
          @media (max-width: 899px) { .rapor-layout { flex-direction: column !important; } }
        `}</style>

        {/* BAŞLIK */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#5A5550', marginBottom: 10 }}>Satış Raporları</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 38, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 6 }}>Rapor İlet</h1>
          <p style={{ fontSize: 13, color: '#5A5550' }}>{today}</p>
        </div>

        {/* SEKMELER */}
        <div style={{ display: 'flex', gap: 0, marginBottom: 32, border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, overflow: 'hidden' }}>
          {([['gunluk', 'Günlük Rapor'], ['haftalik', 'Haftalık Rapor'], ['aylik', 'Aylık Rapor']] as [Sekme, string][]).map(([key, label]) => (
            <button key={key} onClick={() => setSekme(key)} style={{ flex: 1, padding: '12px 8px', background: sekme === key ? 'linear-gradient(135deg,rgba(201,168,76,0.15),rgba(201,168,76,0.05))' : 'var(--bg-card)', border: 'none', borderRight: key !== 'aylik' ? '1px solid rgba(201,168,76,0.2)' : 'none', color: sekme === key ? 'var(--gold-light)' : '#5A5550', fontSize: 11, fontWeight: sekme === key ? 600 : 400, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', transition: 'all 0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* ════════════ GÜNLÜK ════════════ */}
        {sekme === 'gunluk' && (
          <div className="rapor-layout" style={{ display: 'flex', gap: 32 }}>
            <div style={{ flex: '0 0 500px', display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* Aylık Özet */}
              <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <BarChart2 size={13} color="#C9A84C" strokeWidth={1.5} />
                  <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold-light)' }}>{ayLabel} — Net Toplam (Bugün Dahil)</span>
                </div>
                {loadingAylik ? <p style={{ fontSize: 12, color: '#5A5550' }}>Yükleniyor...</p> : (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div><p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7468', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Net Satış</p><p style={{ margin: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: 'var(--gold-light)' }}>{ay_net_adet} <span style={{ fontSize: 11, color: '#7A7468' }}>adet</span></p></div>
                    <div><p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7468', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Net Ciro</p><p style={{ margin: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: 'var(--gold-light)' }}>{fmt(ay_net_tutar)} <span style={{ fontSize: 11, color: '#7A7468' }}>₺</span></p></div>
                    <div><p style={{ margin: '0 0 2px', fontSize: 9, color: '#A83040', letterSpacing: '0.1em', textTransform: 'uppercase' }}>İade</p><p style={{ margin: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: '#A83040' }}>{ay_iade_adet} <span style={{ fontSize: 11, color: '#A83040' }}>adet</span></p><p style={{ margin: '2px 0 0', fontSize: 10, color: '#A83040' }}>{fmt(ay_iade_tutar)} ₺</p></div>
                  </div>
                )}
              </div>

              {/* Kanallar */}
              <div style={cardStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><TrendingUp size={14} color="#C9A84C" strokeWidth={1.5} /><span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold-light)' }}>Trendyol</span></div><SatisField label="Satış" adetKey="trendyol_adet" tutarKey="trendyol_tutar" /></div>
              <div style={cardStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Globe size={14} color="#9A928A" strokeWidth={1.5} /><span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9A928A' }}>robertobravo.com</span></div><SatisField label="Satış" adetKey="site_rb_adet" tutarKey="site_rb_tutar" /></div>
              <div style={cardStyle}><div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><Globe size={14} color="#7A8A9A" strokeWidth={1.5} /><span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A8A9A' }}>935byrobertobravo.com</span></div><SatisField label="Satış" adetKey="site_935_adet" tutarKey="site_935_tutar" /></div>

              {/* İade */}
              <div style={{ background: 'rgba(168,48,64,0.03)', border: '1px solid rgba(168,48,64,0.2)', borderRadius: 12, padding: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><RotateCcw size={14} color="#A83040" strokeWidth={1.5} /><span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#A83040' }}>İadeler</span></div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <IadeField label="Trendyol" adetKey="iade_trendyol_adet" tutarKey="iade_trendyol_tutar" />
                  <IadeField label="RB Site" adetKey="iade_rb_adet" tutarKey="iade_rb_tutar" />
                  <IadeField label="935 Site" adetKey="iade_935_adet" tutarKey="iade_935_tutar" />
                </div>
              </div>

              {/* Net Özet */}
              {(brut_adet > 0 || brut_tutar > 0) && (
                <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 12, padding: '14px 20px' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div><div style={{ fontSize: 9, color: '#7A7468', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Brüt</div><div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: 'var(--text-muted)', fontWeight: 300 }}>{brut_adet} <span style={{ fontSize: 10 }}>adet</span></div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(brut_tutar)} ₺</div></div>
                    <div><div style={{ fontSize: 9, color: '#A83040', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>İade</div><div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#A83040', fontWeight: 300 }}>-{iade_adet} <span style={{ fontSize: 10 }}>adet</span></div><div style={{ fontSize: 11, color: '#A83040' }}>-{fmt(iade_tutar)} ₺</div></div>
                    <div><div style={{ fontSize: 9, color: '#7A7468', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Bugün Net</div><div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: 'var(--gold-light)', fontWeight: 300 }}>{net_adet} <span style={{ fontSize: 10 }}>adet</span></div><div style={{ fontSize: 11, color: 'var(--gold-light)' }}>{fmt(net_tutar)} ₺</div></div>
                  </div>
                </div>
              )}

              {/* Durum */}
              <div style={cardStyle}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}><FileText size={14} color="#7A7468" strokeWidth={1.5} /><span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A7468' }}>Durum Notu</span></div>
                <textarea value={form.durum} onChange={e => setForm(f => ({ ...f, durum: e.target.value }))} placeholder="Günün özeti..." rows={3} style={{ width: '100%', background: 'rgba(201,168,76,0.03)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
              </div>

              {/* Kaydet */}
              <button onClick={saveToDb} disabled={saving} style={{ width: '100%', padding: '13px 24px', background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 10, color: 'var(--gold-light)', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}>
                <Save size={13} />{saving ? 'Kaydediliyor...' : 'Kaydet'}
              </button>
              {saveResult === 'ok' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(76,168,100,0.08)', border: '1px solid rgba(76,168,100,0.2)', borderRadius: 8, color: '#7AC98A', fontSize: 12 }}><CheckCircle size={13} /> Kaydedildi.</div>}
              {saveResult === 'err' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(168,76,76,0.08)', border: '1px solid rgba(168,76,76,0.2)', borderRadius: 8, color: '#C98A8A', fontSize: 12 }}><AlertCircle size={13} /> Kaydedilemedi.</div>}

              {/* Günlük Gönder */}
              <div>
                <label style={labelStyle}>Alıcı E-posta</label>
                <div style={{ ...wrapStyle(), marginBottom: 10 }}><input type="text" value={form.mail_to} onChange={f('mail_to')} placeholder="mail@domain.com" style={inputStyle} /></div>
                {(gunlukState === 'idle' || gunlukState === 'previewing') && (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setGunlukState('preview_ok')} style={{ flex: '0 0 auto', padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, color: 'var(--gold-light)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Eye size={14} /> Önizle
                    </button>
                    <button onClick={gunlukGonder} style={{ flex: 1, padding: '14px 24px', background: 'linear-gradient(135deg,#C9A84C,#8B6914)', border: 'none', borderRadius: 10, color: 'var(--bg-base)', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                      <Send size={13} /> Raporu Gönder
                    </button>
                  </div>
                )}
                {gunlukState === 'sending' && <div style={{ padding: '14px', textAlign: 'center', color: '#C9A84C', fontSize: 13 }}>Gönderiliyor...</div>}
                {gunlukState === 'sent_ok' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(76,168,100,0.08)', border: '1px solid rgba(76,168,100,0.2)', borderRadius: 8, color: '#7AC98A', fontSize: 13 }}><CheckCircle size={14} /> Rapor başarıyla gönderildi. <button onClick={() => setGunlukState('idle')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#7A7468', cursor: 'pointer', fontSize: 11 }}>Sıfırla</button></div>}
                {gunlukState === 'sent_err' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(168,76,76,0.08)', border: '1px solid rgba(168,76,76,0.2)', borderRadius: 8, color: '#C98A8A', fontSize: 13 }}><AlertCircle size={14} /> Gönderilemedi. <button onClick={() => setGunlukState('idle')} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#C98A8A', cursor: 'pointer', fontSize: 11 }}>Tekrar dene</button></div>}
              </div>
            </div>

            {/* Günlük Önizleme Paneli */}
            {gunlukState === 'preview_ok' && (
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Eye size={12} color="#5A5550" /><span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A7570' }}>Mail Önizleme</span></div>
                  <button onClick={() => setGunlukState('idle')} style={{ background: 'none', border: 'none', color: '#7A7468', cursor: 'pointer' }}><X size={16} /></button>
                </div>
                <div style={{ background: '#F8F5F0', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(139,105,20,0.15)' }}>
                  <div style={{ background: '#EDE8E0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(139,105,20,0.12)' }}>
                    <div style={{ display: 'flex', gap: 5 }}>{['#C4364A','#C9A84C','#7AC98A'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.6 }} />)}</div>
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
                <button onClick={gunlukGonder} style={{ marginTop: 16, width: '100%', padding: '14px 24px', background: 'linear-gradient(135deg,#C9A84C,#8B6914)', border: 'none', borderRadius: 10, color: '#1A1410', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <Send size={13} /> Onayla & Gönder
                </button>
              </div>
            )}
          </div>
        )}

        {/* ════════════ HAFTALIK ════════════ */}
        {sekme === 'haftalik' && (
          <div style={{ maxWidth: 520, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Calendar size={14} color="#C9A84C" strokeWidth={1.5} />
                <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold-light)' }}>Haftalık Rapor</span>
              </div>
              <p style={{ fontSize: 13, color: '#7A7468', lineHeight: 1.6, margin: 0 }}>
                Son 7 günün satış verilerini (trendyol + site kırılımları, iadeler, günlük dağılım) otomatik olarak derleyip mail olarak iletir.
              </p>
            </div>

            <SendFlow
              state={haftalikState}
              onPreview={haftalikOnizle}
              onSend={haftalikGonder}
              onReset={() => setHaftalikState('idle')}
              mail={haftalikMail}
              setMail={setHaftalikMail}
              label="Haftalık rapor"
            />

            {haftalikState === 'preview_ok' && haftalikMeta && (
              <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 10, padding: '14px 18px' }}>
                <p style={{ margin: '0 0 8px', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A7468' }}>Rapor özeti · {haftalikMeta.aralik}</p>
                <div style={{ display: 'flex', gap: 24 }}>
                  <div><div style={{ fontSize: 9, color: '#7A7468', marginBottom: 2 }}>Net Satış</div><div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, color: 'var(--gold-light)' }}>{haftalikMeta.net_adet} <span style={{ fontSize: 11 }}>adet</span></div></div>
                  <div><div style={{ fontSize: 9, color: '#7A7468', marginBottom: 2 }}>Net Ciro</div><div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, color: 'var(--gold-light)' }}>{fmt(haftalikMeta.net_tutar)} <span style={{ fontSize: 11 }}>₺</span></div></div>
                  <div><div style={{ fontSize: 9, color: '#7A7468', marginBottom: 2 }}>Gün Sayısı</div><div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, color: 'var(--gold-light)' }}>{haftalikMeta.gun_sayisi}</div></div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════ AYLIK ════════════ */}
        {sekme === 'aylik' && (
          <div style={{ maxWidth: 620, display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, padding: '20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <BarChart2 size={14} color="#C9A84C" strokeWidth={1.5} />
                <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold-light)' }}>Aylık Rapor — {ayLabel}</span>
              </div>
              <p style={{ fontSize: 13, color: '#7A7468', lineHeight: 1.6, margin: 0 }}>Cari aydaki tüm satış verileri + manuel girdiğin reklam giderlerini derleyip iletir.</p>
            </div>

            {/* REKLAM GİDERLERİ */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
                <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C' }}>Dijital Reklam Giderleri</span>
                {toplamReklam > 0 && <span style={{ fontSize: 12, color: 'var(--gold-light)', fontFamily: 'monospace' }}>Toplam: {fmt(toplamReklam)} ₺</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {reklamKalemleri.map((k) => (
                  <div key={k.id} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 120px 36px', gap: 8, alignItems: 'center' }}>
                    <input value={k.grup} onChange={e => reklamGuncelle(k.id, 'grup', e.target.value)} placeholder="Grup (Altın)" style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none' }} />
                    <input value={k.kalem} onChange={e => reklamGuncelle(k.id, 'kalem', e.target.value)} placeholder="Kalem (search, pmax...)" style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 6, padding: '8px 10px', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none' }} />
                    <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 6, overflow: 'hidden' }}>
                      <span style={{ padding: '0 8px', fontSize: 12, color: '#7A7468', borderRight: '1px solid rgba(201,168,76,0.1)' }}>₺</span>
                      <input type="number" value={k.tutar} onChange={e => reklamGuncelle(k.id, 'tutar', e.target.value)} placeholder="0" style={{ flex: 1, background: 'none', border: 'none', outline: 'none', padding: '8px 8px', fontSize: 12, color: 'var(--text-primary)', fontFamily: 'inherit', width: 0 }} />
                    </div>
                    <button onClick={() => reklamSil(k.id)} style={{ background: 'none', border: '1px solid rgba(168,48,64,0.2)', borderRadius: 6, padding: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#A83040' }}><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
              <button onClick={reklamEkle} style={{ marginTop: 12, width: '100%', padding: '9px', background: 'none', border: '1px dashed rgba(201,168,76,0.25)', borderRadius: 8, color: '#7A7468', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <Plus size={12} /> Kalem Ekle
              </button>
            </div>

            <SendFlow
              state={aylikState}
              onPreview={aylikOnizle}
              onSend={aylikGonder}
              onReset={() => setAylikState('idle')}
              mail={aylikMail}
              setMail={setAylikMail}
              label="Aylık rapor"
            />

            {aylikState === 'preview_ok' && aylikMeta && (
              <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 10, padding: '14px 18px' }}>
                <p style={{ margin: '0 0 8px', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A7468' }}>Rapor özeti · {aylikMeta.ayLabel}</p>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <div><div style={{ fontSize: 9, color: '#7A7468', marginBottom: 2 }}>Net Satış</div><div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, color: 'var(--gold-light)' }}>{aylikMeta.net_adet} <span style={{ fontSize: 11 }}>adet</span></div></div>
                  <div><div style={{ fontSize: 9, color: '#7A7468', marginBottom: 2 }}>Net Ciro</div><div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, color: 'var(--gold-light)' }}>{fmt(aylikMeta.net_tutar)} <span style={{ fontSize: 11 }}>₺</span></div></div>
                  {aylikMeta.toplamReklam > 0 && <div><div style={{ fontSize: 9, color: '#8B6914', marginBottom: 2 }}>Toplam Reklam</div><div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, color: '#C9A84C' }}>{fmt(aylikMeta.toplamReklam)} <span style={{ fontSize: 11 }}>₺</span></div></div>}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
