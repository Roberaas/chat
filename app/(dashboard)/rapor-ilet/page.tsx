'use client'

import { useState, useEffect } from 'react'
import { Send, TrendingUp, Globe, FileText, CheckCircle, AlertCircle, Eye, Save, BarChart2, RotateCcw } from 'lucide-react'

export default function RaporIletPage() {
  const todayISO = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Istanbul' }) // YYYY-MM-DD TR timezone
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const ayLabel = new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })

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
  const [sending, setSending] = useState(false)
  const [saveResult, setSaveResult] = useState<'ok' | 'err' | null>(null)
  const [result, setResult] = useState<'ok' | 'err' | null>(null)
  const [preview, setPreview] = useState(false)
  const [loadingAylik, setLoadingAylik] = useState(true)

  // localStorage otomatik kayıt
  useEffect(() => {
    const saved = localStorage.getItem('rapor-form-' + todayISO)
    if (saved) {
      try { setForm(f => ({ ...f, ...JSON.parse(saved) })) } catch {}
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('rapor-form-' + todayISO, JSON.stringify(form))
  }, [form])

  useEffect(() => {
    async function loadData() {
      setLoadingAylik(true)
      try {
        const res = await fetch(`/api/rapor-ilet/data?tarih=${todayISO}`)
        const data = await res.json()
        if (data.bugun) {
          setForm(f => ({
            ...f,
            trendyol_adet: String(data.bugun.trendyol_adet || ''),
            trendyol_tutar: String(data.bugun.trendyol_tutar || ''),
            site_rb_adet: String(data.bugun.site_rb_adet || ''),
            site_rb_tutar: String(data.bugun.site_rb_tutar || ''),
            site_935_adet: String(data.bugun.site_935_adet || ''),
            site_935_tutar: String(data.bugun.site_935_tutar || ''),
            iade_trendyol_adet: String(data.bugun.iade_trendyol_adet || ''),
            iade_trendyol_tutar: String(data.bugun.iade_trendyol_tutar || ''),
            iade_rb_adet: String(data.bugun.iade_rb_adet || ''),
            iade_rb_tutar: String(data.bugun.iade_rb_tutar || ''),
            iade_935_adet: String(data.bugun.iade_935_adet || ''),
            iade_935_tutar: String(data.bugun.iade_935_tutar || ''),
            durum: data.bugun.durum || '',
          }))
        }
        if (data.aylik) setAylik(data.aylik)
      } catch { }
      setLoadingAylik(false)
    }
    loadData()
  }, [])

  // Bugün brüt
  const brut_adet = (parseInt(form.trendyol_adet)||0) + (parseInt(form.site_rb_adet)||0) + (parseInt(form.site_935_adet)||0)
  const brut_tutar = (parseFloat(form.trendyol_tutar)||0) + (parseFloat(form.site_rb_tutar)||0) + (parseFloat(form.site_935_tutar)||0)
  // Bugün iade
  const iade_adet = (parseInt(form.iade_trendyol_adet)||0) + (parseInt(form.iade_rb_adet)||0) + (parseInt(form.iade_935_adet)||0)
  const iade_tutar = (parseFloat(form.iade_trendyol_tutar)||0) + (parseFloat(form.iade_rb_tutar)||0) + (parseFloat(form.iade_935_tutar)||0)
  // Bugün net
  const net_adet = brut_adet - iade_adet
  const net_tutar = brut_tutar - iade_tutar

  const fmt = (n: number) => n.toLocaleString('tr-TR')

  // Aylık net — aylik = bugün HARİÇ önceki günler, forma bugün eklenir
  const ay_brut_adet  = aylik.trendyol_adet  + aylik.site_rb_adet  + aylik.site_935_adet  + brut_adet
  const ay_brut_tutar = aylik.trendyol_tutar + aylik.site_rb_tutar + aylik.site_935_tutar + brut_tutar
  const ay_iade_adet  = (aylik.iade_trendyol_adet||0)  + (aylik.iade_rb_adet||0)  + (aylik.iade_935_adet||0)  + iade_adet
  const ay_iade_tutar = (aylik.iade_trendyol_tutar||0) + (aylik.iade_rb_tutar||0) + (aylik.iade_935_tutar||0) + iade_tutar
  const ay_net_adet   = ay_brut_adet  - ay_iade_adet
  const ay_net_tutar  = ay_brut_tutar - ay_iade_tutar

  async function saveToDb() {
    setSaving(true); setSaveResult(null)
    try {
      const res = await fetch('/api/rapor-ilet/kaydet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tarih: todayISO,
          trendyol_adet: parseInt(form.trendyol_adet)||0,
          trendyol_tutar: parseFloat(form.trendyol_tutar)||0,
          site_rb_adet: parseInt(form.site_rb_adet)||0,
          site_rb_tutar: parseFloat(form.site_rb_tutar)||0,
          site_935_adet: parseInt(form.site_935_adet)||0,
          site_935_tutar: parseFloat(form.site_935_tutar)||0,
          iade_trendyol_adet: parseInt(form.iade_trendyol_adet)||0,
          iade_trendyol_tutar: parseFloat(form.iade_trendyol_tutar)||0,
          iade_rb_adet: parseInt(form.iade_rb_adet)||0,
          iade_rb_tutar: parseFloat(form.iade_rb_tutar)||0,
          iade_935_adet: parseInt(form.iade_935_adet)||0,
          iade_935_tutar: parseFloat(form.iade_935_tutar)||0,
          durum: form.durum,
        })
      })
      setSaveResult((await res.json()).ok ? 'ok' : 'err')
    } catch { setSaveResult('err') }
    setSaving(false)
  }

  async function send() {
    setSending(true); setResult(null)
    try {
      const res = await fetch('/api/rapor-ilet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          tarih: today, tarih_iso: todayISO, ay_label: ayLabel,
          brut_adet, brut_tutar, iade_adet, iade_tutar, net_adet, net_tutar,
          ay_brut_adet, ay_brut_tutar, ay_iade_adet, ay_iade_tutar, ay_net_adet, ay_net_tutar,
        })
      })
      setResult((await res.json()).ok ? 'ok' : 'err')
    } catch { setResult('err') }
    setSending(false)
  }

  const f = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm(p => ({ ...p, [key]: e.target.value }))

  const inputStyle = {
    flex: 1, background: 'none', border: 'none', outline: 'none',
    padding: '11px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit'
  }
  const wrapStyle = (red?: boolean) => ({
    display: 'flex', alignItems: 'center',
    background: red ? 'rgba(168,48,64,0.04)' : 'var(--bg-card)',
    border: `1px solid ${red ? 'rgba(168,48,64,0.2)' : 'rgba(201,168,76,0.12)'}`,
    borderRadius: 8, overflow: 'hidden'
  })
  const prefixStyle = (red?: boolean) => ({
    padding: '0 12px', fontSize: 13,
    color: red ? '#A83040' : '#5A5550',
    borderRight: `1px solid ${red ? 'rgba(168,48,64,0.15)' : 'rgba(201,168,76,0.08)'}`
  })
  const labelStyle = { fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#5A5550', marginBottom: 6, display: 'block' }

  const SatisField = ({ label, adetKey, tutarKey }: { label: string; adetKey: keyof typeof form; tutarKey: keyof typeof form }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <label style={labelStyle}>{label} Adet</label>
        <div style={wrapStyle()}>
          <span style={prefixStyle()}>#</span>
          <input type="number" value={form[adetKey]} onChange={f(adetKey)} placeholder="0" style={inputStyle} />
        </div>
      </div>
      <div>
        <label style={labelStyle}>{label} Ciro</label>
        <div style={wrapStyle()}>
          <span style={prefixStyle()}>₺</span>
          <input type="number" value={form[tutarKey]} onChange={f(tutarKey)} placeholder="0.00" style={inputStyle} />
        </div>
      </div>
    </div>
  )

  const IadeField = ({ label, adetKey, tutarKey }: { label: string; adetKey: keyof typeof form; tutarKey: keyof typeof form }) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
      <div>
        <label style={{ ...labelStyle, color: '#A83040' }}>{label} Adet</label>
        <div style={wrapStyle(true)}>
          <span style={prefixStyle(true)}>#</span>
          <input
            type="text" inputMode="numeric"
            value={String(form[adetKey])}
            onChange={e => { const v = e.target.value; setForm(p => ({ ...p, [adetKey]: v })) }}
            placeholder="0"
            style={{ ...inputStyle, color: '#A83040' }}
          />
        </div>
      </div>
      <div>
        <label style={{ ...labelStyle, color: '#A83040' }}>{label} Tutar</label>
        <div style={wrapStyle(true)}>
          <span style={prefixStyle(true)}>₺</span>
          <input
            type="text" inputMode="decimal"
            value={String(form[tutarKey])}
            onChange={e => { const v = e.target.value; setForm(p => ({ ...p, [tutarKey]: v })) }}
            placeholder="0.00"
            style={{ ...inputStyle, color: '#A83040' }}
          />
        </div>
      </div>
    </div>
  )

  const cardStyle = { background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, padding: 20 }
  const sectionTitle = (icon: React.ReactNode, label: string, color = 'var(--gold-light)') => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
      {icon}
      <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color }}>{label}</span>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 16px', maxWidth: 1400, margin: '0 auto' }} className="rapor-layout">
      <style>{`
        @media (min-width: 900px) { .rapor-layout { flex-direction: row !important; padding: 40px 32px !important; gap: 32px !important; } }
        @media (max-width: 899px) { .rapor-preview { width: 100% !important; } .rapor-form { flex: none !important; width: 100% !important; } }
      `}</style>

      {/* SOL: Form */}
      <div className="rapor-form" style={{ flex: '0 0 500px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ marginBottom: 4 }}>
          <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#5A5550', marginBottom: 10 }}>Günlük Rapor</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 38, fontWeight: 300, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 6 }}>Rapor İlet</h1>
          <p style={{ fontSize: 13, color: '#5A5550' }}>{today}</p>
        </div>

        {/* Aylık Özet */}
        <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BarChart2 size={13} color="#C9A84C" strokeWidth={1.5} />
            <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'var(--gold-light)' }}>{ayLabel} — Net Toplam (Bugün Dahil)</span>
          </div>
          {loadingAylik ? <p style={{ fontSize: 12, color: '#5A5550' }}>Yükleniyor...</p> : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7468', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Net Satış</p>
                <p style={{ margin: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: 'var(--gold-light)' }}>{ay_net_adet} <span style={{ fontSize: 11, color: '#7A7468' }}>adet</span></p>
              </div>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7468', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Net Ciro</p>
                <p style={{ margin: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: 'var(--gold-light)' }}>{fmt(ay_net_tutar)} <span style={{ fontSize: 11, color: '#7A7468' }}>₺</span></p>
              </div>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 9, color: '#A83040', letterSpacing: '0.1em', textTransform: 'uppercase' }}>İade</p>
                <p style={{ margin: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: 28, fontWeight: 300, color: '#A83040' }}>{ay_iade_adet} <span style={{ fontSize: 11, color: '#A83040' }}>adet</span></p>
                <p style={{ margin: '2px 0 0', fontSize: 10, color: '#A83040' }}>{fmt(ay_iade_tutar)} ₺</p>
              </div>
            </div>
          )}
        </div>

        {/* Trendyol */}
        <div style={cardStyle}>
          {sectionTitle(<TrendingUp size={14} color="#C9A84C" strokeWidth={1.5} />, 'Trendyol')}
          <SatisField label="Satış" adetKey="trendyol_adet" tutarKey="trendyol_tutar" />
        </div>

        {/* Site RB */}
        <div style={cardStyle}>
          {sectionTitle(<Globe size={14} color="#9A928A" strokeWidth={1.5} />, 'robertobravo.com', '#9A928A')}
          <SatisField label="Satış" adetKey="site_rb_adet" tutarKey="site_rb_tutar" />
        </div>

        {/* Site 935 */}
        <div style={cardStyle}>
          {sectionTitle(<Globe size={14} color="#7A8A9A" strokeWidth={1.5} />, '935byrobertobravo.com', '#7A8A9A')}
          <SatisField label="Satış" adetKey="site_935_adet" tutarKey="site_935_tutar" />
        </div>

        {/* İADE BÖLÜMÜ */}
        <div style={{ background: 'rgba(168,48,64,0.03)', border: '1px solid rgba(168,48,64,0.2)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <RotateCcw size={14} color="#A83040" strokeWidth={1.5} />
            <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#A83040' }}>İadeler</span>
            <span style={{ marginLeft: 'auto', fontSize: 10, color: '#A83040', fontFamily: 'JetBrains Mono, monospace' }}>Toplam ciroya düşülür</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <IadeField label="Trendyol" adetKey="iade_trendyol_adet" tutarKey="iade_trendyol_tutar" />
            <IadeField label="RB Site" adetKey="iade_rb_adet" tutarKey="iade_rb_tutar" />
            <IadeField label="935 Site" adetKey="iade_935_adet" tutarKey="iade_935_tutar" />
          </div>
          {iade_adet > 0 && (
            <div style={{ marginTop: 14, padding: '10px 14px', background: 'rgba(168,48,64,0.06)', borderRadius: 8, display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#A83040' }}>Bugün toplam iade</span>
              <span style={{ fontSize: 12, color: '#A83040', fontFamily: 'JetBrains Mono, monospace', fontWeight: 600 }}>{iade_adet} adet / {fmt(iade_tutar)} ₺</span>
            </div>
          )}
        </div>

        {/* Bugün Net Özet */}
        {(brut_adet > 0 || brut_tutar > 0) && (
          <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 12, padding: '14px 20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <div>
                <div style={{ fontSize: 9, color: '#7A7468', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Brüt</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: 'var(--text-muted)', fontWeight: 300 }}>{brut_adet} <span style={{ fontSize: 10 }}>adet</span></div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{fmt(brut_tutar)} ₺</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#A83040', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>İade</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: '#A83040', fontWeight: 300 }}>-{iade_adet} <span style={{ fontSize: 10 }}>adet</span></div>
                <div style={{ fontSize: 11, color: '#A83040' }}>-{fmt(iade_tutar)} ₺</div>
              </div>
              <div>
                <div style={{ fontSize: 9, color: '#7A7468', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>Bugün Net</div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, color: 'var(--gold-light)', fontWeight: 300 }}>{net_adet} <span style={{ fontSize: 10 }}>adet</span></div>
                <div style={{ fontSize: 11, color: 'var(--gold-light)' }}>{fmt(net_tutar)} ₺</div>
              </div>
            </div>
          </div>
        )}

        {/* Durum Notu */}
        <div style={cardStyle}>
          {sectionTitle(<FileText size={14} color="#7A7468" strokeWidth={1.5} />, 'Durum Notu', '#7A7468')}
          <textarea value={form.durum} onChange={e => setForm(f => ({ ...f, durum: e.target.value }))} placeholder="Günün özeti, dikkat çeken noktalar..." rows={3}
            style={{ width: '100%', background: 'rgba(201,168,76,0.03)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--text-primary)', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
        </div>

        {/* Mail */}
        <div>
          <label style={labelStyle}>Alıcı E-posta</label>
          <div style={wrapStyle()}>
            <input type="text" value={form.mail_to} onChange={f('mail_to')} placeholder="mail@domain.com" style={inputStyle} />
          </div>
        </div>

        {/* Kaydet */}
        <button onClick={saveToDb} disabled={saving} style={{ width: '100%', padding: '13px 24px', background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 10, color: 'var(--gold-light)', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}>
          <Save size={13} />{saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        {saveResult === 'ok' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(76,168,100,0.08)', border: '1px solid rgba(76,168,100,0.2)', borderRadius: 8, color: '#7AC98A', fontSize: 12 }}><CheckCircle size={13} /> Kaydedildi.</div>}
        {saveResult === 'err' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(168,76,76,0.08)', border: '1px solid rgba(168,76,76,0.2)', borderRadius: 8, color: '#C98A8A', fontSize: 12 }}><AlertCircle size={13} /> Kaydedilemedi.</div>}

        {/* Gönder */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setPreview(p => !p)} style={{ flex: '0 0 auto', padding: '14px 18px', background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, color: 'var(--gold-light)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={14} /> {preview ? 'Gizle' : 'Önizle'}
          </button>
          <button onClick={send} disabled={sending} style={{ flex: 1, padding: '14px 24px', background: 'linear-gradient(135deg,#C9A84C,#8B6914)', border: 'none', borderRadius: 10, color: 'var(--bg-base)', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: sending ? 0.7 : 1 }}>
            {sending ? <div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: 'var(--bg-base)', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> : <Send size={13} />}
            {sending ? 'Gönderiliyor...' : 'Raporu Gönder'}
          </button>
        </div>
        {result === 'ok' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(76,168,100,0.08)', border: '1px solid rgba(76,168,100,0.2)', borderRadius: 8, color: '#7AC98A', fontSize: 13 }}><CheckCircle size={14} /> Rapor başarıyla gönderildi.</div>}
        {result === 'err' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(168,76,76,0.08)', border: '1px solid rgba(168,76,76,0.2)', borderRadius: 8, color: '#C98A8A', fontSize: 13 }}><AlertCircle size={14} /> Gönderilemedi. Tekrar deneyin.</div>}
      </div>

      {/* SAĞ: Önizleme */}
      {preview && (
        <div className="rapor-preview" style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Eye size={12} color="#5A5550" />
            <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A7570' }}>Mail Önizleme</span>
          </div>
          <div style={{ background: '#F8F5F0', borderRadius: 12, overflow: 'hidden', border: '1px solid rgba(139,105,20,0.15)' }}>
            <div style={{ background: '#EDE8E0', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(139,105,20,0.12)' }}>
              <div style={{ display: 'flex', gap: 5 }}>{['#C4364A','#C9A84C','#7AC98A'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.6 }} />)}</div>
              <div style={{ flex: 1, background: '#E4DFD8', borderRadius: 4, padding: '4px 10px', fontSize: 10, color: '#7A7570' }}>Roberto Bravo — Günlük Rapor · {today}</div>
            </div>
            <div style={{ fontFamily: 'Georgia, serif' }}>
              {/* Header */}
              <div style={{ padding: '40px 40px 28px', background: '#FFFFFF', borderBottom: '1px solid rgba(139,105,20,0.2)' }}>
                <p style={{ margin: '0 0 6px', fontSize: 9, letterSpacing: '4px', textTransform: 'uppercase', color: '#7A7570' }}>Roberto Bravo</p>
                <h1 style={{ margin: '0 0 4px', fontSize: 30, fontWeight: 300, color: '#1A1410' }}>Günlük Rapor</h1>
                <p style={{ margin: 0, fontSize: 12, color: '#6A6460' }}>{today}</p>
              </div>
              {/* Aylık Net */}
              <div style={{ padding: '24px 40px', background: '#1A1610', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                <p style={{ margin: '0 0 14px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C' }}>{ayLabel} — Aylık Net (İade Düşülmüş)</p>
                <div style={{ display: 'flex', gap: 40 }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7570' }}>Net Satış</p>
                    <p style={{ margin: 0, fontSize: 36, fontWeight: 300, color: '#C9A84C', lineHeight: 1 }}>{ay_net_adet} <span style={{ fontSize: 12, color: '#7A7570' }}>adet</span></p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7570' }}>Net Ciro</p>
                    <p style={{ margin: 0, fontSize: 36, fontWeight: 300, color: '#C9A84C', lineHeight: 1 }}>{fmt(ay_net_tutar)} <span style={{ fontSize: 12, color: '#7A7570' }}>₺</span></p>
                  </div>
                  {ay_iade_adet > 0 && (
                    <div>
                      <p style={{ margin: '0 0 2px', fontSize: 9, color: '#C4364A' }}>Toplam İade</p>
                      <p style={{ margin: 0, fontSize: 36, fontWeight: 300, color: '#C4364A', lineHeight: 1 }}>{ay_iade_adet} <span style={{ fontSize: 12 }}>adet</span></p>
                      <p style={{ margin: '2px 0 0', fontSize: 11, color: '#C4364A' }}>{fmt(ay_iade_tutar)} ₺</p>
                    </div>
                  )}
                </div>
              </div>
              {/* Bugün */}
              <div style={{ padding: '24px 40px', background: '#F4EFE8', borderBottom: '1px solid rgba(139,105,20,0.15)', display: 'flex', gap: 32 }}>
                {brut_adet > 0 && (
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#7A7570' }}>Brüt Satış</p>
                    <p style={{ margin: 0, fontSize: 40, fontWeight: 300, color: '#1A1410', lineHeight: 1 }}>{brut_adet}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: '#7A7570' }}>adet</p>
                  </div>
                )}
                {brut_tutar > 0 && (
                  <div style={{ borderLeft: brut_adet > 0 ? '1px solid rgba(139,105,20,0.15)' : 'none', paddingLeft: brut_adet > 0 ? 32 : 0 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#7A7570' }}>Brüt Ciro</p>
                    <p style={{ margin: 0, fontSize: 40, fontWeight: 300, color: '#1A1410', lineHeight: 1 }}>{fmt(brut_tutar)}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: '#7A7570' }}>TL (KDV Dahil)</p>
                  </div>
                )}
                {iade_adet > 0 && (
                  <div style={{ borderLeft: '1px solid rgba(168,48,64,0.2)', paddingLeft: 32 }}>
                    <p style={{ margin: '0 0 2px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#C4364A' }}>İade</p>
                    <p style={{ margin: 0, fontSize: 40, fontWeight: 300, color: '#C4364A', lineHeight: 1 }}>{iade_adet}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 10, color: '#C4364A' }}>{fmt(iade_tutar)} TL</p>
                  </div>
                )}
              </div>
              {/* Kanallar */}
              {[
                { label: 'Trendyol', adet: form.trendyol_adet, tutar: form.trendyol_tutar, iade_adet: form.iade_trendyol_adet, iade_tutar: form.iade_trendyol_tutar, color: '#4A4540' },
                { label: 'robertobravo.com', adet: form.site_rb_adet, tutar: form.site_rb_tutar, iade_adet: form.iade_rb_adet, iade_tutar: form.iade_rb_tutar, color: '#4A4540' },
                { label: '935byrobertobravo.com', adet: form.site_935_adet, tutar: form.site_935_tutar, iade_adet: form.iade_935_adet, iade_tutar: form.iade_935_tutar, color: '#7A8A9A' },
              ].map(ch => (
                <div key={ch.label} style={{ padding: '20px 40px', background: '#FFFFFF', borderBottom: '1px solid rgba(139,105,20,0.1)' }}>
                  <p style={{ margin: '0 0 12px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: ch.color }}>{ch.label}</p>
                  <div style={{ display: 'flex', gap: 32 }}>
                    <div><p style={{ margin: '0 0 2px', fontSize: 10, color: '#7A7570' }}>Satış</p><p style={{ margin: 0, fontSize: 20, fontWeight: 300, color: '#1A1410' }}>{ch.adet || '—'} <span style={{ fontSize: 11, color: '#6A6460' }}>adet / {fmt(parseFloat(ch.tutar)||0)} ₺</span></p></div>
                    {(parseInt(ch.iade_adet)||0) > 0 && (
                      <div><p style={{ margin: '0 0 2px', fontSize: 10, color: '#C4364A' }}>İade</p><p style={{ margin: 0, fontSize: 20, fontWeight: 300, color: '#C4364A' }}>{ch.iade_adet} <span style={{ fontSize: 11 }}>adet / {fmt(parseFloat(ch.iade_tutar)||0)} ₺</span></p></div>
                    )}
                  </div>
                </div>
              ))}
              {form.durum && (
                <div style={{ padding: '24px 40px', background: '#FFFFFF', borderBottom: '1px solid rgba(139,105,20,0.1)' }}>
                  <p style={{ margin: '0 0 10px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#6A6460' }}>Durum Notu</p>
                  <p style={{ margin: 0, fontSize: 12, color: '#4A4540', lineHeight: 1.7 }}>{form.durum}</p>
                </div>
              )}
              <div style={{ padding: '20px 40px', background: '#1A1410' }}>
                <p style={{ margin: 0, fontSize: 9, color: '#9A9590', letterSpacing: '2px', textTransform: 'uppercase' }}>Roberto Bravo — {today}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
