'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [kullanici_adi, setKullaniciAdi] = useState('')
  const [sifre, setSifre] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function login() {
    if (!kullanici_adi || !sifre) { setError('Kullanıcı adı ve şifre gerekli'); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kullanici_adi, sifre })
      })
      const data = await res.json()
      if (data.ok) { router.push('/'); router.refresh() }
      else setError(data.error || 'Giriş başarısız')
    } catch { setError('Bağlantı hatası') }
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0A0908', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      {/* Subtle radial glow */}
      <div style={{ position: 'fixed', top: '30%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, background: 'radial-gradient(circle, rgba(201,168,76,0.04) 0%, transparent 70%)', pointerEvents: 'none' }} />

      <div style={{ width: '100%', maxWidth: 360, position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 48, fontWeight: 300, color: '#F5F0E8', letterSpacing: '-0.03em', lineHeight: 1 }}>
            roberto<span style={{ color: '#C9A84C' }}>.</span>
          </div>
          <div style={{ marginTop: 10, height: 1, background: 'linear-gradient(90deg, transparent, rgba(201,168,76,0.4), transparent)' }} />
          <div style={{ fontSize: 10, letterSpacing: '0.35em', color: '#3A3730', marginTop: 10, textTransform: 'uppercase' }}>
            yönetim paneli
          </div>
        </div>

        {/* Card */}
        <div style={{ background: '#111009', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 16, padding: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <label style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3A3730', display: 'block', marginBottom: 8 }}>
                Kullanıcı Adı
              </label>
              <input
                type="text"
                value={kullanici_adi}
                onChange={e => setKullaniciAdi(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="kullanici.adi"
                className="input-premium"
                style={{ padding: '11px 14px', fontSize: 13 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 10, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#3A3730', display: 'block', marginBottom: 8 }}>
                Şifre
              </label>
              <input
                type="password"
                value={sifre}
                onChange={e => setSifre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="••••••••"
                className="input-premium"
                style={{ padding: '11px 14px', fontSize: 13 }}
              />
            </div>

            {error && (
              <div style={{ padding: '10px 14px', background: 'rgba(139,38,53,0.12)', border: '1px solid rgba(139,38,53,0.3)', borderRadius: 8, fontSize: 12, color: '#C4364A' }}>
                {error}
              </div>
            )}

            <button
              onClick={login}
              disabled={loading}
              className="btn-gold"
              style={{ padding: '12px 0', fontSize: 13, letterSpacing: '0.05em', marginTop: 4 }}
            >
              {loading ? 'Doğrulanıyor...' : 'Giriş Yap'}
            </button>
          </div>
        </div>

        <p style={{ textAlign: 'center', fontSize: 10, color: '#272420', marginTop: 24, fontFamily: 'JetBrains Mono, monospace' }}>
          roberto admin · v2.0
        </p>
      </div>
    </div>
  )
}
