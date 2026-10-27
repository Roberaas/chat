'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { KeyRound } from 'lucide-react'
import RobertoLogo from '@/components/RobertoLogo'

// İlk giriş / yönetici sıfırlaması sonrası zorunlu şifre değişimi
export default function SifrePage() {
  const router = useRouter()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (pw.length < 12) { setError('Şifre en az 12 karakter olmalı'); return }
    if (!/[a-z]/.test(pw) || !/[A-Z]/.test(pw) || !/\d/.test(pw)) { setError('Büyük harf, küçük harf ve rakam içermeli'); return }
    if (pw !== pw2) { setError('Şifreler eşleşmiyor'); return }
    setLoading(true); setError('')
    const r = await fetch('/api/crm/me/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pw }) })
    const d = await r.json().catch(() => ({}))
    if (!d.ok) { setError(d.error || 'Şifre güncellenemedi'); setLoading(false); return }
    router.replace('/crm'); router.refresh()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div className="anim-up" style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}><div style={{ display: 'inline-block', marginBottom: 12 }}><RobertoLogo size={44} /></div></div>
        <form className="card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }} onSubmit={e => { e.preventDefault(); submit() }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ac2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><KeyRound size={18} style={{ color: 'var(--ac)' }} /></div>
            <p style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>Yeni şifre belirleyin</p>
            <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 3 }}>Devam etmek için geçici şifrenizi değiştirmelisiniz.</p>
          </div>
          <div><label className="label">Yeni şifre</label><input className="inp" type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="new-password" /></div>
          <div><label className="label">Yeni şifre (tekrar)</label><input className="inp" type="password" value={pw2} onChange={e => setPw2(e.target.value)} autoComplete="new-password" /></div>
          {error && <div className="toast toast-err" style={{ margin: 0 }}>{error}</div>}
          <button className="btn" type="submit" disabled={loading} style={{ justifyContent: 'center', padding: '11px 0' }}>{loading ? 'Kaydediliyor...' : 'Şifreyi Kaydet'}</button>
        </form>
      </div>
    </div>
  )
}
