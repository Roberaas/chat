'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Download, ShieldCheck, ArrowLeft } from 'lucide-react'
import RobertoLogo from '@/components/RobertoLogo'

type Step = 'sifre' | 'otp'

export default function LoginPage() {
  const [kullanici_adi, setKullaniciAdi] = useState('')
  const [sifre, setSifre] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<Step>('sifre')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [maskedPhone, setMaskedPhone] = useState('')
  const [installPrompt, setInstallPrompt] = useState<any>(null)
  const [installing, setInstalling] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault()
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  async function installApp() {
    if (!installPrompt) return
    setInstalling(true)
    installPrompt.prompt()
    await installPrompt.userChoice
    setInstallPrompt(null)
    setInstalling(false)
  }

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

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,106,247,.14), transparent 65%)', pointerEvents: 'none' }} />

      <div className="anim-up" style={{ width: '100%', maxWidth: 380, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-block', marginBottom: 14 }}><RobertoLogo size={48} /></div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-.4px' }}>Roberto Bravo</h1>
          <p style={{ fontSize: 12.5, color: 'var(--tx3)', marginTop: 4 }}>WhatsApp Bot Yönetim Paneli</p>
        </div>

        <div className="card" style={{ padding: 28 }}>
          {step === 'sifre' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label className="label">Kullanıcı Adı veya E-posta</label>
                <input className="inp" type="text" value={kullanici_adi} onChange={e => setKullaniciAdi(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loginWithPassword()} placeholder="kullanici.adi" autoComplete="username" />
              </div>
              <div>
                <label className="label">Şifre</label>
                <input className="inp" type="password" value={sifre} onChange={e => setSifre(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && loginWithPassword()} placeholder="••••••••" autoComplete="current-password" />
              </div>

              {error && <div className="toast toast-err" style={{ margin: 0 }}>{error}</div>}

              <button className="btn" onClick={loginWithPassword} disabled={loading} style={{ justifyContent: 'center', padding: '11px 0' }}>
                {loading ? 'Doğrulanıyor...' : 'Devam Et →'}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ac2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
                  <ShieldCheck size={18} style={{ color: 'var(--ac)' }} />
                </div>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>SMS kodu gönderildi</p>
                <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 3, fontFamily: 'JetBrains Mono, monospace' }}>{maskedPhone}</p>
              </div>
              <div>
                <label className="label">Doğrulama Kodu</label>
                <input className="inp" type="number" value={otp} onChange={e => setOtp(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && verifyOtp()} placeholder="000000"
                  style={{ fontSize: 24, textAlign: 'center', letterSpacing: '.3em', fontFamily: 'JetBrains Mono, monospace' }} />
              </div>

              {error && <div className="toast toast-err" style={{ margin: 0 }}>{error}</div>}

              <button className="btn" onClick={verifyOtp} disabled={loading} style={{ justifyContent: 'center', padding: '11px 0' }}>
                {loading ? 'Doğrulanıyor...' : 'Giriş Yap'}
              </button>
              <button className="btn-ghost" onClick={() => { setStep('sifre'); setOtp(''); setError('') }} style={{ justifyContent: 'center' }}>
                <ArrowLeft size={13} /> Geri dön
              </button>
            </div>
          )}
        </div>

        {installPrompt && (
          <button className="btn-ghost" onClick={installApp} disabled={installing} style={{ width: '100%', justifyContent: 'center', marginTop: 14, padding: '10px 0' }}>
            <Download size={14} strokeWidth={1.75} />
            {installing ? 'Kuruluyor...' : 'Uygulamayı Kur'}
          </button>
        )}

        <p style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--tx3)', marginTop: 22, fontFamily: 'JetBrains Mono, monospace' }}>
          roberto admin · v3.0
        </p>
      </div>
    </div>
  )
}
