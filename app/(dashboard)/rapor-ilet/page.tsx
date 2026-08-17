'use client'

import { useState, useEffect } from 'react'
import { Send, TrendingUp, Globe, FileText, CheckCircle, AlertCircle, Eye, Save, BarChart2 } from 'lucide-react'

export default function RaporIletPage() {
  const todayISO = new Date().toISOString().split('T')[0]
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const ayLabel = new Date().toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })

  const [form, setForm] = useState({
    trendyol_adet: '',
    trendyol_tutar: '',
    site_rb_adet: '',
    site_rb_tutar: '',
    site_935_adet: '',
    site_935_tutar: '',
    durum: '',
    mail_to: 'mert@robertobravo.com',
  })
  const [aylik, setAylik] = useState({ trendyol_adet: 0, trendyol_tutar: 0, site_rb_adet: 0, site_rb_tutar: 0, site_935_adet: 0, site_935_tutar: 0 })
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [saveResult, setSaveResult] = useState<'ok' | 'err' | null>(null)
  const [result, setResult] = useState<'ok' | 'err' | null>(null)
  const [preview, setPreview] = useState(false)
  const [loadingAylik, setLoadingAylik] = useState(true)

  // Bugünün kayıtlı verisini ve aylık toplamı çek
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
            durum: data.bugun.durum || '',
          }))
        }
        if (data.aylik) setAylik(data.aylik)
      } catch { }
      setLoadingAylik(false)
    }
    loadData()
  }, [])

  const total_adet = (parseInt(form.trendyol_adet) || 0) + (parseInt(form.site_rb_adet) || 0) + (parseInt(form.site_935_adet) || 0)
  const total_tutar = (parseFloat(form.trendyol_tutar) || 0) + (parseFloat(form.site_rb_tutar) || 0) + (parseFloat(form.site_935_tutar) || 0)
  const fmt = (n: number) => n.toLocaleString('tr-TR')

  // Aylık kümülatif: önceki günler + bugünün formdaki değerleri
  const ayToplamAdet = (aylik.trendyol_adet + aylik.site_rb_adet + aylik.site_935_adet) - 
    ((parseInt(String(aylik.trendyol_adet)) || 0)) + total_adet
  // Daha net hesap: aylık toplamdan bugünü çıkar, bugünün formunu ekle
  const aylikOncekiAdet = aylik.trendyol_adet + aylik.site_rb_adet + aylik.site_935_adet
  const aylikOncekiTutar = aylik.trendyol_tutar + aylik.site_rb_tutar + aylik.site_935_tutar
  // aylik zaten bugün dahil mi değil mi? API'den ayrı çekeceğiz (bugün hariç ay toplamı)
  const ayKumulatifAdet = aylik.trendyol_adet + aylik.site_rb_adet + aylik.site_935_adet + total_adet
  const ayKumulatifTutar = aylik.trendyol_tutar + aylik.site_rb_tutar + aylik.site_935_tutar + total_tutar

  async function saveToDb() {
    setSaving(true); setSaveResult(null)
    try {
      const res = await fetch('/api/rapor-ilet/kaydet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tarih: todayISO,
          trendyol_adet: parseInt(form.trendyol_adet) || 0,
          trendyol_tutar: parseFloat(form.trendyol_tutar) || 0,
          site_rb_adet: parseInt(form.site_rb_adet) || 0,
          site_rb_tutar: parseFloat(form.site_rb_tutar) || 0,
          site_935_adet: parseInt(form.site_935_adet) || 0,
          site_935_tutar: parseFloat(form.site_935_tutar) || 0,
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
          tarih: today,
          tarih_iso: todayISO,
          ay_label: ayLabel,
          ay_trendyol_adet: aylik.trendyol_adet + (parseInt(form.trendyol_adet) || 0),
          ay_trendyol_tutar: aylik.trendyol_tutar + (parseFloat(form.trendyol_tutar) || 0),
          ay_rb_adet: aylik.site_rb_adet + (parseInt(form.site_rb_adet) || 0),
          ay_rb_tutar: aylik.site_rb_tutar + (parseFloat(form.site_rb_tutar) || 0),
          ay_935_adet: aylik.site_935_adet + (parseInt(form.site_935_adet) || 0),
          ay_935_tutar: aylik.site_935_tutar + (parseFloat(form.site_935_tutar) || 0),
          ay_toplam_adet: ayKumulatifAdet,
          ay_toplam_tutar: ayKumulatifTutar,
        })
      })
      setResult((await res.json()).ok ? 'ok' : 'err')
    } catch { setResult('err') }
    setSending(false)
  }

  const inp = (label: string, key: keyof typeof form, placeholder: string, prefix?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5A5550' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', background: '#1A1712', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 8, overflow: 'hidden' }}>
        {prefix && <span style={{ padding: '0 12px', fontSize: 13, color: '#5A5550', borderRight: '1px solid rgba(201,168,76,0.08)' }}>{prefix}</span>}
        <input type={prefix ? "number" : "text"} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} placeholder={placeholder}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', padding: '12px 14px', fontSize: 13, color: '#EDE8DF', fontFamily: 'inherit' }} />
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 16px', maxWidth: 1400, margin: '0 auto' }}
      className="rapor-layout">
      <style>{`
        @media (min-width: 900px) {
          .rapor-layout { flex-direction: row !important; padding: 40px 32px !important; gap: 32px !important; }
        }
        @media (max-width: 899px) {
          .rapor-preview { width: 100% !important; }
          .rapor-form { flex: none !important; width: 100% !important; }
        }
      `}</style>

      {/* SOL: Form */}
      <div className="rapor-form" style={{ flex: '0 0 480px', display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ marginBottom: 4 }}>
          <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#5A5550', marginBottom: 10 }}>Günlük Rapor</p>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 38, fontWeight: 300, color: '#EDE8DF', lineHeight: 1.1, marginBottom: 6 }}>Rapor İlet</h1>
          <p style={{ fontSize: 13, color: '#5A5550' }}>{today}</p>
        </div>

        {/* Aylık Kümülatif */}
        <div style={{ background: 'rgba(201,168,76,0.05)', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 12, padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <BarChart2 size={13} color="#C9A84C" strokeWidth={1.5} />
            <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C' }}>
              {ayLabel} — Bugün Dahil Toplam
            </span>
          </div>
          {loadingAylik ? (
            <p style={{ fontSize: 12, color: '#5A5550' }}>Yükleniyor...</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7468', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Toplam Satış</p>
                <p style={{ margin: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: 30, fontWeight: 300, color: '#C9A84C' }}>{ayKumulatifAdet} <span style={{ fontSize: 12, color: '#7A7468' }}>adet</span></p>
              </div>
              <div>
                <p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7468', letterSpacing: '0.15em', textTransform: 'uppercase' }}>Toplam Ciro</p>
                <p style={{ margin: 0, fontFamily: 'Cormorant Garamond, serif', fontSize: 30, fontWeight: 300, color: '#C9A84C' }}>{fmt(ayKumulatifTutar)} <span style={{ fontSize: 12, color: '#7A7468' }}>₺</span></p>
                <p style={{ margin: '2px 0 0', fontSize: 9, color: '#5A5550', letterSpacing: '0.1em' }}>KDV DAHİL</p>
              </div>
            </div>
          )}
        </div>

        {/* Trendyol */}
        <div style={{ background: '#1A1712', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={14} color="#C9A84C" strokeWidth={1.5} />
            <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C' }}>Trendyol</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {inp('Satış Adedi', 'trendyol_adet', '0', '#')}
            {inp('Ciro', 'trendyol_tutar', '0.00', '₺')}
          </div>
        </div>

        {/* Site RB */}
        <div style={{ background: '#1A1712', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Globe size={14} color="#9A928A" strokeWidth={1.5} />
            <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9A928A' }}>robertobravo.com</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {inp('Satış Adedi', 'site_rb_adet', '0', '#')}
            {inp('Ciro', 'site_rb_tutar', '0.00', '₺')}
          </div>
        </div>

        {/* Site 935 */}
        <div style={{ background: '#1A1712', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Globe size={14} color="#7A8A9A" strokeWidth={1.5} />
            <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A8A9A' }}>935byrobertobravo.com</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            {inp('Satış Adedi', 'site_935_adet', '0', '#')}
            {inp('Ciro', 'site_935_tutar', '0.00', '₺')}
          </div>
        </div>

        {/* Günlük toplam */}
        {(form.trendyol_adet || form.site_rb_adet || form.site_935_adet || form.trendyol_tutar || form.site_rb_tutar || form.site_935_tutar) ? (
          <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 12, padding: '14px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 10, color: '#7A7468', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Bugün</span>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, color: '#C9A84C', fontWeight: 300 }}>{total_adet}</div>
                <div style={{ fontSize: 9, color: '#5A5550', textTransform: 'uppercase', letterSpacing: '0.1em' }}>adet</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 26, color: '#C9A84C', fontWeight: 300 }}>{fmt(total_tutar)} ₺</div>
                <div style={{ fontSize: 9, color: '#5A5550', textTransform: 'uppercase', letterSpacing: '0.1em' }}>ciro (KDV Dahil)</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Durum */}
        <div style={{ background: '#1A1712', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <FileText size={14} color="#7A7468" strokeWidth={1.5} />
            <span style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A7468' }}>Durum Notu</span>
          </div>
          <textarea value={form.durum} onChange={e => setForm(f => ({ ...f, durum: e.target.value }))} placeholder="Günün özeti, dikkat çeken noktalar..." rows={3}
            style={{ width: '100%', background: 'rgba(201,168,76,0.03)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#EDE8DF', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }} />
        </div>

        {/* Mail */}
        {inp('Alıcı E-posta', 'mail_to', 'mail@domain.com')}

        {/* Kaydet */}
        <button onClick={saveToDb} disabled={saving} style={{ width: '100%', padding: '13px 24px', background: '#1A1712', border: '1px solid rgba(201,168,76,0.25)', borderRadius: 10, color: '#C9A84C', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: saving ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving ? 0.7 : 1 }}>
          <Save size={13} />
          {saving ? 'Kaydediliyor...' : 'Kaydet (Veritabanı)'}
        </button>
        {saveResult === 'ok' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(76,168,100,0.08)', border: '1px solid rgba(76,168,100,0.2)', borderRadius: 8, color: '#7AC98A', fontSize: 12 }}><CheckCircle size={13} /> Kaydedildi.</div>}
        {saveResult === 'err' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', background: 'rgba(168,76,76,0.08)', border: '1px solid rgba(168,76,76,0.2)', borderRadius: 8, color: '#C98A8A', fontSize: 12 }}><AlertCircle size={13} /> Kaydedilemedi.</div>}

        {/* Gönder */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setPreview(p => !p)} style={{ flex: '0 0 auto', padding: '14px 18px', background: '#1A1712', border: '1px solid rgba(201,168,76,0.2)', borderRadius: 10, color: '#C9A84C', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <Eye size={14} /> {preview ? 'Gizle' : 'Önizle'}
          </button>
          <button onClick={send} disabled={sending} style={{ flex: 1, padding: '14px 24px', background: 'linear-gradient(135deg,#C9A84C,#8B6914)', border: 'none', borderRadius: 10, color: '#0E0C0A', fontSize: 12, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', cursor: sending ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: sending ? 0.7 : 1 }}>
            {sending ? <div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#0E0C0A', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> : <Send size={13} />}
            {sending ? 'Gönderiliyor...' : 'Raporu Gönder (Mail)'}
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
              <div style={{ display: 'flex', gap: 5 }}>
                {['#C4364A','#C9A84C','#7AC98A'].map(c => <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.6 }} />)}
              </div>
              <div style={{ flex: 1, background: '#E4DFD8', borderRadius: 4, padding: '4px 10px', fontSize: 10, color: '#7A7570' }}>
                Roberto Bravo — Günlük Rapor · {today}
              </div>
            </div>
            <div style={{ padding: 0, fontFamily: 'Georgia, serif' }}>
              {/* Header */}
              <div style={{ padding: '40px 40px 28px', background: '#FFFFFF', borderBottom: '1px solid rgba(139,105,20,0.2)' }}>
                <p style={{ margin: '0 0 6px', fontSize: 9, letterSpacing: '4px', textTransform: 'uppercase', color: '#7A7570' }}>Roberto Bravo</p>
                <h1 style={{ margin: '0 0 4px', fontSize: 30, fontWeight: 300, color: '#1A1410' }}>Günlük Rapor</h1>
                <p style={{ margin: 0, fontSize: 12, color: '#6A6460' }}>{today}</p>
              </div>
              {/* Aylık Kümülatif */}
              <div style={{ padding: '24px 40px', background: '#1A1610', borderBottom: '1px solid rgba(201,168,76,0.1)' }}>
                <p style={{ margin: '0 0 14px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C' }}>{ayLabel} — Aylık Toplam (Bugün Dahil)</p>
                <div style={{ display: 'flex', gap: 32 }}>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7570' }}>Toplam Satış</p>
                    <p style={{ margin: 0, fontSize: 36, fontWeight: 300, color: '#C9A84C', lineHeight: 1 }}>{ayKumulatifAdet} <span style={{ fontSize: 12, color: '#7A7570' }}>adet</span></p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 2px', fontSize: 9, color: '#7A7570' }}>Toplam Ciro</p>
                    <p style={{ margin: 0, fontSize: 36, fontWeight: 300, color: '#C9A84C', lineHeight: 1 }}>{fmt(ayKumulatifTutar)} <span style={{ fontSize: 12, color: '#7A7570' }}>₺</span></p>
                  </div>
                </div>
              </div>
              {/* Bugün */}
              <div style={{ padding: '24px 40px', background: '#F4EFE8', borderBottom: '1px solid rgba(139,105,20,0.15)', display: 'flex', gap: 32 }}>
                <div>
                  <p style={{ margin: '0 0 2px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#7A7570' }}>Bugün Satış</p>
                  <p style={{ margin: 0, fontSize: 40, fontWeight: 300, color: '#1A1410', lineHeight: 1 }}>{total_adet}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: '#7A7570' }}>adet</p>
                </div>
                <div style={{ borderLeft: '1px solid rgba(139,105,20,0.15)', paddingLeft: 32 }}>
                  <p style={{ margin: '0 0 2px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#7A7570' }}>Bugün Ciro</p>
                  <p style={{ margin: 0, fontSize: 40, fontWeight: 300, color: '#1A1410', lineHeight: 1 }}>{fmt(total_tutar)}</p>
                  <p style={{ margin: '2px 0 0', fontSize: 10, color: '#7A7570' }}>TL</p>
                </div>
              </div>
              {/* Trendyol */}
              <div style={{ padding: '24px 40px', background: '#FFFFFF', borderBottom: '1px solid rgba(139,105,20,0.1)' }}>
                <p style={{ margin: '0 0 12px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#C9A84C' }}>Trendyol</p>
                <div style={{ display: 'flex', gap: 32 }}>
                  <div><p style={{ margin: '0 0 2px', fontSize: 10, color: '#7A7570' }}>Satış Adedi</p><p style={{ margin: 0, fontSize: 20, fontWeight: 300, color: '#1A1410' }}>{form.trendyol_adet || '—'} <span style={{ fontSize: 11, color: '#6A6460' }}>adet</span></p></div>
                  <div><p style={{ margin: '0 0 2px', fontSize: 10, color: '#7A7570' }}>Ciro</p><p style={{ margin: 0, fontSize: 20, fontWeight: 300, color: '#1A1410' }}>{fmt(parseFloat(form.trendyol_tutar) || 0)} <span style={{ fontSize: 11, color: '#6A6460' }}>TL</span></p></div>
                </div>
              </div>
              {/* Site RB */}
              <div style={{ padding: '24px 40px', background: '#FFFFFF', borderBottom: '1px solid rgba(139,105,20,0.1)' }}>
                <p style={{ margin: '0 0 12px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#4A4540' }}>robertobravo.com</p>
                <div style={{ display: 'flex', gap: 32 }}>
                  <div><p style={{ margin: '0 0 2px', fontSize: 10, color: '#7A7570' }}>Satış Adedi</p><p style={{ margin: 0, fontSize: 20, fontWeight: 300, color: '#1A1410' }}>{form.site_rb_adet || '—'} <span style={{ fontSize: 11, color: '#6A6460' }}>adet</span></p></div>
                  <div><p style={{ margin: '0 0 2px', fontSize: 10, color: '#7A7570' }}>Ciro</p><p style={{ margin: 0, fontSize: 20, fontWeight: 300, color: '#1A1410' }}>{fmt(parseFloat(form.site_rb_tutar) || 0)} <span style={{ fontSize: 11, color: '#6A6460' }}>TL</span></p></div>
                </div>
              </div>
              {/* Site 935 */}
              <div style={{ padding: '24px 40px', background: '#FFFFFF', borderBottom: '1px solid rgba(139,105,20,0.1)' }}>
                <p style={{ margin: '0 0 12px', fontSize: 8, letterSpacing: '3px', textTransform: 'uppercase', color: '#7A8A9A' }}>935byrobertobravo.com</p>
                <div style={{ display: 'flex', gap: 32 }}>
                  <div><p style={{ margin: '0 0 2px', fontSize: 10, color: '#7A7570' }}>Satış Adedi</p><p style={{ margin: 0, fontSize: 20, fontWeight: 300, color: '#1A1410' }}>{form.site_935_adet || '—'} <span style={{ fontSize: 11, color: '#6A6460' }}>adet</span></p></div>
                  <div><p style={{ margin: '0 0 2px', fontSize: 10, color: '#7A7570' }}>Ciro</p><p style={{ margin: 0, fontSize: 20, fontWeight: 300, color: '#1A1410' }}>{fmt(parseFloat(form.site_935_tutar) || 0)} <span style={{ fontSize: 11, color: '#6A6460' }}>TL</span></p></div>
                </div>
              </div>
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
