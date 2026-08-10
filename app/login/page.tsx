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
      if (data.ok) {
        router.push('/')
        router.refresh()
      } else {
        setError(data.error || 'Giriş başarısız')
      }
    } catch {
      setError('Bağlantı hatası')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-cream-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-10">
          <div className="font-display text-5xl text-ink-900 mb-2">roberto<span className="text-moss-500">.</span></div>
          <div className="text-xs uppercase tracking-[0.3em] text-ink-400">yönetim paneli</div>
        </div>

        <div className="bg-white border border-cream-200 rounded-2xl p-8 shadow-sm">
          <div className="space-y-4">
            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-300 block mb-1.5">Kullanıcı Adı</label>
              <input
                type="text"
                value={kullanici_adi}
                onChange={e => setKullaniciAdi(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="kullanici.adi"
                className="w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-xl text-ink-700 font-mono placeholder-ink-300 focus:outline-none focus:border-moss-400 transition-colors"
              />
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-[0.2em] text-ink-300 block mb-1.5">Şifre</label>
              <input
                type="password"
                value={sifre}
                onChange={e => setSifre(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-cream-50 border border-cream-200 rounded-xl text-ink-700 placeholder-ink-300 focus:outline-none focus:border-moss-400 transition-colors"
              />
            </div>

            {error && (
              <div className="px-4 py-3 bg-ember-50 border border-ember-200 rounded-xl text-ember-700 text-sm">
                {error}
              </div>
            )}

            <button
              onClick={login}
              disabled={loading}
              className="w-full py-3 bg-ink-900 text-cream-50 rounded-xl font-medium hover:bg-ink-700 transition-colors disabled:opacity-40"
            >
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-ink-300 mt-6 font-mono">
          roberto. admin · v1.0
        </p>
      </div>
    </div>
  )
}
