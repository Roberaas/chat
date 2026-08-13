'use client'

import { useState } from 'react'
import { Send, TrendingUp, Globe, FileText, CheckCircle, AlertCircle } from 'lucide-react'

export default function RaporIletPage() {
  const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
  const todayISO = new Date().toISOString().split('T')[0]

  const [form, setForm] = useState({
    trendyol_adet: '',
    trendyol_tutar: '',
    site_adet: '',
    site_tutar: '',
    durum: '',
    mail_to: 'mert@robertobravo.com',
  })
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<'ok' | 'err' | null>(null)

  const total_adet = (parseInt(form.trendyol_adet) || 0) + (parseInt(form.site_adet) || 0)
  const total_tutar = (parseFloat(form.trendyol_tutar) || 0) + (parseFloat(form.site_tutar) || 0)

  async function send() {
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/rapor-ilet', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, tarih: today, tarih_iso: todayISO })
      })
      const data = await res.json()
      setResult(data.ok ? 'ok' : 'err')
    } catch {
      setResult('err')
    }
    setSending(false)
  }

  const inp = (label: string, key: keyof typeof form, placeholder: string, prefix?: string) => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5A5550' }}>{label}</label>
      <div style={{ display: 'flex', alignItems: 'center', background: '#1A1712', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 8, overflow: 'hidden' }}>
        {prefix && <span style={{ padding: '0 12px', fontSize: 13, color: '#5A5550', borderRight: '1px solid rgba(201,168,76,0.08)' }}>{prefix}</span>}
        <input
          type={prefix === '₺' ? 'number' : 'text'}
          value={form[key]}
          onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          style={{ flex: 1, background: 'none', border: 'none', outline: 'none', padding: '12px 14px', fontSize: 13, color: '#EDE8DF', fontFamily: 'inherit' }}
        />
      </div>
    </div>
  )

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      {/* Başlık */}
      <div style={{ marginBottom: 40 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#5A5550', marginBottom: 10 }}>Günlük Rapor</p>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 42, fontWeight: 300, color: '#EDE8DF', lineHeight: 1.1, marginBottom: 8 }}>Rapor İlet</h1>
        <p style={{ fontSize: 13, color: '#5A5550' }}>{today}</p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Trendyol */}
        <div style={{ background: '#1A1712', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <TrendingUp size={16} color="#C9A84C" strokeWidth={1.5} />
            <span style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C' }}>Trendyol</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {inp('Satış Adedi', 'trendyol_adet', '0', '#')}
            {inp('Ciro', 'trendyol_tutar', '0.00', '₺')}
          </div>
        </div>

        {/* Site */}
        <div style={{ background: '#1A1712', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <Globe size={16} color="#9A928A" strokeWidth={1.5} />
            <span style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#9A928A' }}>Site (robertobravo.com)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {inp('Satış Adedi', 'site_adet', '0', '#')}
            {inp('Ciro', 'site_tutar', '0.00', '₺')}
          </div>
        </div>

        {/* Toplam özet */}
        {(form.trendyol_adet || form.site_adet || form.trendyol_tutar || form.site_tutar) ? (
          <div style={{ background: 'rgba(201,168,76,0.04)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 12, padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#7A7468', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Toplam</span>
            <div style={{ display: 'flex', gap: 32 }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#C9A84C', fontWeight: 300 }}>{total_adet}</div>
                <div style={{ fontSize: 9, color: '#5A5550', letterSpacing: '0.15em', textTransform: 'uppercase' }}>adet</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 28, color: '#C9A84C', fontWeight: 300 }}>{total_tutar.toLocaleString('tr-TR')} ₺</div>
                <div style={{ fontSize: 9, color: '#5A5550', letterSpacing: '0.15em', textTransform: 'uppercase' }}>ciro</div>
              </div>
            </div>
          </div>
        ) : null}

        {/* Durum Notu */}
        <div style={{ background: '#1A1712', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, padding: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
            <FileText size={16} color="#7A7468" strokeWidth={1.5} />
            <span style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A7468' }}>Durum Notu</span>
          </div>
          <textarea
            value={form.durum}
            onChange={e => setForm(f => ({ ...f, durum: e.target.value }))}
            placeholder="Günün özeti, dikkat çeken noktalar, notlar..."
            rows={4}
            style={{ width: '100%', background: 'rgba(201,168,76,0.03)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#EDE8DF', fontFamily: 'inherit', outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6 }}
          />
        </div>

        {/* Mail */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <label style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5A5550' }}>Alıcı E-posta</label>
          <input
            type="email"
            value={form.mail_to}
            onChange={e => setForm(f => ({ ...f, mail_to: e.target.value }))}
            style={{ background: '#1A1712', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 8, padding: '12px 14px', fontSize: 13, color: '#EDE8DF', fontFamily: 'inherit', outline: 'none' }}
          />
        </div>

        {/* Gönder */}
        <button
          onClick={send}
          disabled={sending}
          style={{
            padding: '16px 32px', background: 'linear-gradient(135deg, #C9A84C, #8B6914)',
            border: 'none', borderRadius: 10, color: '#0E0C0A', fontSize: 13, fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase', cursor: sending ? 'not-allowed' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: sending ? 0.7 : 1,
            transition: 'opacity 0.2s'
          }}
        >
          {sending ? (
            <div style={{ width: 16, height: 16, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#0E0C0A', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
          ) : (
            <Send size={14} />
          )}
          {sending ? 'Gönderiliyor...' : 'Raporu Gönder'}
        </button>

        {result === 'ok' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'rgba(76,168,100,0.08)', border: '1px solid rgba(76,168,100,0.2)', borderRadius: 10, color: '#7AC98A' }}>
            <CheckCircle size={16} /> Rapor başarıyla gönderildi.
          </div>
        )}
        {result === 'err' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 18px', background: 'rgba(168,76,76,0.08)', border: '1px solid rgba(168,76,76,0.2)', borderRadius: 10, color: '#C98A8A' }}>
            <AlertCircle size={16} /> Gönderilemedi. Tekrar deneyin.
          </div>
        )}
      </div>
    </div>
  )
}
