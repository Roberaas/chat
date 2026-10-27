'use client'
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ShieldCheck, ArrowLeft } from 'lucide-react'
import RobertoLogo from '@/components/RobertoLogo'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [factorId, setFactorId] = useState<string | null>(null)
  const [error, setError] = useState(params.get('e') === 'pasif' ? 'Hesabınız pasif. Yöneticinize başvurun.' : '')
  const [loading, setLoading] = useState(false)

  const nextPath = (() => {
    const n = params.get('next') || '/crm'
    return n.startsWith('/crm') && !n.startsWith('//') ? n : '/crm'
  })()

  async function finish(supabase: ReturnType<typeof createCrmBrowserClient>) {
    const { data, error } = await supabase.rpc('me')
    if (error || !data?.profile || !data.profile.is_active) {
      await supabase.auth.signOut()
      setError('Bu hesap CRM için yetkilendirilmemiş veya pasif.')
      setLoading(false)
      return
    }
    router.replace(nextPath); router.refresh()
  }

  // Oturum varsa: MFA bekliyorsa doğrulama adımını aç, tamamsa içeri al
  useEffect(() => {
    (async () => {
      const supabase = createCrmBrowserClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
      if (aal.data?.nextLevel === 'aal2' && aal.data.currentLevel !== 'aal2') {
        const { data: f } = await supabase.auth.mfa.listFactors()
        const totp = f?.totp?.find(x => x.status === 'verified')
        if (totp) { setFactorId(totp.id); return }
      }
      router.replace(nextPath)
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signIn() {
    if (!email || !password) { setError('E-posta ve şifre gerekli'); return }
    setLoading(true); setError('')
    const supabase = createCrmBrowserClient()
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (error) { setError('E-posta veya şifre hatalı'); setLoading(false); return }
    const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (aal.data?.nextLevel === 'aal2' && aal.data.currentLevel !== 'aal2') {
      const { data: f } = await supabase.auth.mfa.listFactors()
      const totp = f?.totp?.find(x => x.status === 'verified')
      if (totp) { setFactorId(totp.id); setLoading(false); return }
    }
    await finish(supabase)
  }

  async function verifyMfa() {
    if (!factorId || code.length < 6) { setError('6 haneli kodu girin'); return }
    setLoading(true); setError('')
    const supabase = createCrmBrowserClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
    if (error) { setError('Kod hatalı'); setLoading(false); return }
    await finish(supabase)
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '-20%', left: '50%', transform: 'translateX(-50%)', width: 640, height: 640, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,106,247,.14), transparent 65%)', pointerEvents: 'none' }} />
      <div className="anim-up" style={{ width: '100%', maxWidth: 380, position: 'relative' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ display: 'inline-block', marginBottom: 14 }}><RobertoLogo size={48} /></div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-.4px' }}>Roberto CRM</h1>
          <p style={{ fontSize: 12.5, color: 'var(--tx3)', marginTop: 4 }}>Müşteri İlişkileri Yönetimi</p>
        </div>
        <div className="card" style={{ padding: 28 }}>
          {!factorId ? (
            <form onSubmit={e => { e.preventDefault(); signIn() }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div><label className="label">E-posta</label>
                <input className="inp" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ad@sirket.com" autoComplete="username" /></div>
              <div><label className="label">Şifre</label>
                <input className="inp" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" autoComplete="current-password" /></div>
              {error && <div className="toast toast-err" style={{ margin: 0 }}>{error}</div>}
              <button className="btn" type="submit" disabled={loading} style={{ justifyContent: 'center', padding: '11px 0' }}>{loading ? 'Doğrulanıyor...' : 'Giriş Yap'}</button>
            </form>
          ) : (
            <form onSubmit={e => { e.preventDefault(); verifyMfa() }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--ac2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}><ShieldCheck size={18} style={{ color: 'var(--ac)' }} /></div>
                <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>İki adımlı doğrulama</p>
                <p style={{ fontSize: 12, color: 'var(--tx3)', marginTop: 3 }}>Doğrulayıcı uygulamanızdaki 6 haneli kod</p>
              </div>
              <input className="inp" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000"
                style={{ fontSize: 24, textAlign: 'center', letterSpacing: '.3em', fontFamily: 'JetBrains Mono, monospace' }} autoFocus />
              {error && <div className="toast toast-err" style={{ margin: 0 }}>{error}</div>}
              <button className="btn" type="submit" disabled={loading} style={{ justifyContent: 'center', padding: '11px 0' }}>{loading ? 'Doğrulanıyor...' : 'Doğrula'}</button>
              <button type="button" className="btn-ghost" onClick={async () => { await createCrmBrowserClient().auth.signOut(); setFactorId(null); setCode(''); setError('') }} style={{ justifyContent: 'center' }}><ArrowLeft size={13} /> Geri dön</button>
            </form>
          )}
        </div>
        <p style={{ textAlign: 'center', fontSize: 10.5, color: 'var(--tx3)', marginTop: 22 }}>Hesap yönetici tarafından oluşturulur.</p>
      </div>
    </div>
  )
}

export default function CrmLoginPage() {
  return <Suspense><LoginForm /></Suspense>
}
