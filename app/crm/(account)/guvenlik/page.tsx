'use client'
import { Suspense, useCallback, useEffect, useState } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ShieldCheck, Trash2 } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import ConfirmModal from '@/components/ConfirmModal'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type Factor = { id: string; status: string; friendly_name?: string }

function Inner() {
  const supabase = createCrmBrowserClient()
  const router = useRouter()
  const zorunlu = useSearchParams().get('zorunlu') === '1'
  const [factors, setFactors] = useState<Factor[]>([])
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null)
  const [code, setCode] = useState('')
  const [err, setErr] = useState('')
  const [ok, setOk] = useState('')
  const [del, setDel] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.auth.mfa.listFactors()
    setFactors([...(data?.totp || [])] as Factor[])
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [load])

  async function start() {
    setErr(''); setOk('')
    // Doğrulanmamış eski denemeleri temizle
    for (const f of factors.filter(f => f.status !== 'verified')) await supabase.auth.mfa.unenroll({ factorId: f.id })
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Doğrulayıcı ' + new Date().toLocaleDateString('tr-TR') })
    if (error || !data) { setErr(error?.message || 'Kayıt başlatılamadı'); return }
    setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret })
  }
  async function verify() {
    if (!enroll || code.length < 6) { setErr('6 haneli kodu girin'); return }
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: enroll.id, code })
    if (error) { setErr('Kod hatalı'); return }
    setEnroll(null); setCode(''); setErr(''); setOk('İki adımlı doğrulama etkinleştirildi.')
    await load()
    if (zorunlu) { router.replace('/crm'); router.refresh() }
  }
  async function remove() {
    if (!del) return
    const { error } = await supabase.auth.mfa.unenroll({ factorId: del })
    setDel(null)
    if (error) setErr(error.message); else { setOk('Faktör kaldırıldı.'); load() }
  }

  const verified = factors.filter(f => f.status === 'verified')
  return (
    <>
      <CrmTopBar title="Güvenlik" subtitle="iki adımlı doğrulama" />
      <div style={{ padding: 22, maxWidth: 560, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
        {zorunlu && <div className="toast toast-err" style={{ margin: 0 }}>Rolünüz için iki adımlı doğrulama zorunludur. Devam etmek için etkinleştirin.</div>}
        {ok && <div className="toast toast-ok" style={{ margin: 0 }}>{ok}</div>}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <ShieldCheck size={18} style={{ color: verified.length ? 'var(--green)' : 'var(--tx3)' }} />
            <span className="card-title">Doğrulayıcı uygulama (TOTP)</span>
            <span className={`badge ${verified.length ? 'badge-green' : 'badge-muted'}`} style={{ marginLeft: 'auto' }}>{verified.length ? 'Etkin' : 'Kapalı'}</span>
          </div>
          {verified.map(f => (
            <div key={f.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13 }}>{f.friendly_name || 'Doğrulayıcı'}</span>
              <button onClick={() => setDel(f.id)} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }} title="Kaldır"><Trash2 size={14} /></button>
            </div>
          ))}
          {!enroll && <button className="btn" onClick={start} style={{ marginTop: 14 }}>{verified.length ? 'Yeni doğrulayıcı ekle' : 'Etkinleştir'}</button>}
          {enroll && (
            <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
              <p style={{ fontSize: 12.5, color: 'var(--tx2)', textAlign: 'center' }}>Google Authenticator, 1Password vb. ile QR kodu okutun, ardından 6 haneli kodu girin.</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={enroll.qr} alt="QR" width={170} height={170} style={{ background: '#fff', padding: 8, borderRadius: 10 }} />
              <code style={{ fontSize: 11, color: 'var(--tx3)', wordBreak: 'break-all', textAlign: 'center' }}>{enroll.secret}</code>
              <input className="inp" inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="000000"
                style={{ fontSize: 22, textAlign: 'center', letterSpacing: '.3em', fontFamily: 'JetBrains Mono, monospace', maxWidth: 220 }} />
              <button className="btn" onClick={verify}>Doğrula ve Etkinleştir</button>
            </div>
          )}
          {err && <div className="toast toast-err" style={{ margin: '14px 0 0' }}>{err}</div>}
        </div>
      </div>
      <ConfirmModal open={!!del} title="Doğrulayıcıyı kaldır" message="Bu faktör kaldırılacak. Zorunlu roller için yeniden kayıt gerekir." confirmText="Evet, kaldır" onConfirm={remove} onCancel={() => setDel(null)} />
    </>
  )
}
export default function GuvenlikPage() { return <Suspense><Inner /></Suspense> }
