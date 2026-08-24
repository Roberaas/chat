'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type Step = 'sifre' | 'otp'

export default function LoginPage() {
  const [kullanici_adi, setKullaniciAdi] = useState('')
  const [sifre, setSifre] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<Step>('sifre')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState('')
  const router = useRouter()

  async function loginWithPassword() {
    if (!kullanici_adi || !sifre) { setError('Kullanıcı adı ve şifre gerekli'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/otp-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kullanici_adi, sifre })
      })
      const data = await res.json()
      if (data.ok) {
        setMaskedPhone(data.masked_phone)
        setStep('otp')
      } else setError(data.error || 'Giriş başarısız')
    } catch { setError('Bağlantı hatası') }
    setLoading(false)
  }

  async function verifyOtp() {
    if (!otp || otp.length < 4) { setError('Kodu girin'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/auth/otp-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kullanici_adi, otp })
      })
      const data = await res.json()
      if (data.ok) { router.push('/'); router.refresh() }
      else setError(data.error || 'Kod yanlış')
    } catch { setError('Bağlantı hatası') }
    setLoading(false)
  }

  const inputStyle = {
    width: '100%', background: 'rgba(139,105,20,0.04)', border: '1px solid rgba(139,105,20,0.15)',
    borderRadius: 8, padding: '12px 14px', fontSize: 14, color: '#1A1410',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' as const
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F5F3EF', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 360, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 48, fontWeight: 300, color: '#1A1410', letterSpacing: '-0.03em', lineHeight: 1 }}>
            roberto<span style={{ color: '#8B6914' }}>.</span>
          </div>
          <div style={{ marginTop: 10, height: 1, background: 'linear-gradient(90deg, transparent, rgba(139,105,20,0.4), transparent)' }} />
          <div style={{ fontSize: 10, letterSpacing: '0.35em', color: '#7A7468', marginTop: 10, textTransform: 'uppercase' }}>
            yönetim paneli
          </div>
        </div>

        {/* Card */}
        <div style={{ background: '#FFFFFF', border: '1px solid rgba(139,105,20,0.12)', borderRadius: 16, padding: 32, boxShadow: '0 4px 24px rgba(0,0,0,0.06)' }}>
          {step === 'sifre' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div>
                <label style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A7468', display: 'block', marginBottom: 8 }}>
                  Kullanıcı Adı
                </label>
                <input type="text" value={kullanici_adi} onChange={e => setKullaniciAdi(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loginWithPassword()}
                  placeholder="kullanici.adi" style={inputStyle} />
              </div>
              <div>
                <label style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A7468', display: 'block', marginBottom: 8 }}>
                  Şifre
                </label>
                <input type="password" value={sifre} onChange={e => setSifre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loginWithPassword()}
                  placeholder="••••••••" style={inputStyle} />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(168,48,64,0.06)', border: '1px solid rgba(168,48,64,0.2)', borderRadius: 8, fontSize: 12, color: '#A83040' }}>
                  {error}
                </div>
              )}

              <button onClick={loginWithPassword} disabled={loading}
                style={{ padding: '13px 0', background: 'linear-gradient(135deg,#8B6914,#6B4F0A)', border: 'none', borderRadius: 8, color: '#FFF8E8', fontSize: 13, fontWeight: 600, letterSpacing: '0.05em', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Doğrulanıyor...' : 'Devam Et →'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 13, color: '#3A3530', marginBottom: 6 }}>SMS kodu gönderildi</div>
                <div style={{ fontSize: 12, color: '#7A7468' }}>{maskedPhone}</div>
              </div>
              <div>
                <label style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#7A7468', display: 'block', marginBottom: 8 }}>
                  Doğrulama Kodu
                </label>
                <input type="number" value={otp} onChange={e => setOtp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && verifyOtp()}
                  placeholder="000000" maxLength={6}
                  style={{ ...inputStyle, fontSize: 24, textAlign: 'center', letterSpacing: '0.3em', fontFamily: 'JetBrains Mono, monospace' }} />
              </div>

              {error && (
                <div style={{ padding: '10px 14px', background: 'rgba(168,48,64,0.06)', border: '1px solid rgba(168,48,64,0.2)', borderRadius: 8, fontSize: 12, color: '#A83040' }}>
                  {error}
                </div>
              )}

              <button onClick={verifyOtp} disabled={loading}
                style={{ padding: '13px 0', background: 'linear-gradient(135deg,#8B6914,#6B4F0A)', border: 'none', borderRadius: 8, color: '#FFF8E8', fontSize: 13, fontWeight: 600, letterSpacing: '0.05em', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Doğrulanıyor...' : 'Giriş Yap'}
              </button>

              <button onClick={() => { setStep('sifre'); setOtp(''); setError('') }}
                style={{ background: 'none', border: 'none', fontSize: 12, color: '#7A7468', cursor: 'pointer', textDecoration: 'underline' }}>
                Geri dön
              </button>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: 10, color: '#A8A39E', marginTop: 24, fontFamily: 'JetBrains Mono, monospace' }}>
          roberto admin · v2.1
        </p>
      </div>
    </div>
  )
}
