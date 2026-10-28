'use client'
import { useEffect, useState } from 'react'

type Legal = Record<string, { version: number; title: string; body: string }>
type Row = { id: string; customer_no: number; name: string; phone: string | null; city: string | null; birth_date: string | null }

const inp: React.CSSProperties = { width: '100%', padding: '14px 14px', fontSize: 17, border: '1px solid var(--bdr)', borderRadius: 10, background: 'var(--bg)', color: 'var(--tx)', boxSizing: 'border-box' }
const btn: React.CSSProperties = { padding: '14px 22px', fontSize: 17, fontWeight: 600, border: 0, borderRadius: 10, background: 'var(--ac)', color: '#fff', cursor: 'pointer' }
const btn2: React.CSSProperties = { ...btn, background: 'transparent', color: 'var(--tx2)', border: '1px solid var(--bdr)' }
const lbl: React.CSSProperties = { display: 'block', fontSize: 13, color: 'var(--tx3)', marginBottom: 5 }

async function api(body: Record<string, unknown>) {
  const r = await fetch('/api/crm/store', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  return r.json().catch(() => ({ ok: false, error: 'Sunucu hatası' }))
}

export default function StoreScreen() {
  const [tab, setTab] = useState<'kayit' | 'ara'>('kayit')
  const [legal, setLegal] = useState<Legal | null>(null)
  const [step, setStep] = useState<'form' | 'code' | 'done' | 'consent' | 'consentCode' | 'consentDone'>('form')
  const [f, setF] = useState({ first: '', last: '', phone: '', email: '', city: '', birth: '' })
  const [ack, setAck] = useState(false)
  const [showNotice, setShowNotice] = useState(false)
  const [pending, setPending] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: 'err' | 'ok'; s: string } | null>(null)
  const [dup, setDup] = useState<{ name: string; same_store: boolean } | null>(null)
  const [cust, setCust] = useState<{ id: string; no: number } | null>(null)
  const [ch, setCh] = useState<Record<string, boolean>>({ sms: false, email: false, call: false })
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<Row[]>([])
  const [searched, setSearched] = useState(false)

  useEffect(() => { api({ action: 'legal' }).then(d => { if (d.ok) setLegal(d.texts) }) }, [])
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF(p => ({ ...p, [k]: e.target.value }))
  const fail = (s: string) => setMsg({ t: 'err', s })
  const reset = () => { setF({ first: '', last: '', phone: '', email: '', city: '', birth: '' }); setAck(false); setShowNotice(false); setPending(''); setCode(''); setDup(null); setCust(null); setMsg(null); setCh({ sms: false, email: false, call: false }); setStep('form') }

  // Telefon/e-posta girilince canlı mükerrer kontrolü
  async function liveCheck() {
    if (!f.phone && !f.email) return
    const d = await api({ action: 'check', phone: f.phone, email: f.email })
    const r = d.result
    setDup(d.ok && r && r.exists ? { name: r.name, same_store: !!r.same_store } : null)
  }

  async function submit() {
    setMsg(null); setBusy(true)
    const hasPhone = f.phone.trim().length > 0
    const d = hasPhone
      ? await api({ action: 'register-start', first: f.first, last: f.last, phone: f.phone, email: f.email, city: f.city, birth: f.birth, noticeAck: ack })
      : await api({ action: 'register-email', first: f.first, last: f.last, email: f.email, city: f.city, birth: f.birth })
    setBusy(false)
    if (!d.ok) return fail(d.error)
    if (d.status === 'duplicate') { setDup({ name: d.name, same_store: d.same_store }); return fail(d.same_store ? `Bu müşteri zaten kayıtlı: ${d.name}` : `Bu müşteri başka bir mağazada kayıtlı (${d.name}).`) }
    if (d.status === 'code_sent') { setPending(d.pendingId); setStep('code'); return }
    if (d.status === 'created') { setCust({ id: d.id, no: d.no }); setStep('done') }
  }

  async function link() {
    setBusy(true)
    const d = await api({ action: 'register-email', first: f.first, last: f.last, email: f.email, city: f.city, birth: f.birth, link: true })
    setBusy(false)
    if (d.ok && d.status === 'linked') setMsg({ t: 'ok', s: 'Müşteri mağazanıza bağlandı.' }); else fail(d.error || 'Bağlanamadı')
  }

  async function verify() {
    setMsg(null); setBusy(true)
    const d = await api({ action: 'register-verify', pendingId: pending, code })
    setBusy(false)
    if (!d.ok) return fail(d.error)
    if (d.status === 'created') { setCust({ id: d.id, no: d.no }); setStep('done'); return }
    if (d.status === 'wrong_code') return fail(`Kod hatalı. Kalan deneme: ${d.left}`)
    if (d.status === 'duplicate') return fail('Bu müşteri zaten kayıtlı.')
    fail(d.status === 'locked' ? 'Çok fazla hatalı deneme. Kaydı baştan başlatın.' : 'Kodun süresi doldu. Kaydı baştan başlatın.')
  }

  async function consentStart() {
    const channels = Object.keys(ch).filter(k => ch[k])
    if (!cust || !channels.length) return fail('En az bir kanal seçin')
    setMsg(null); setBusy(true)
    const d = await api({ action: 'consent-start', customerId: cust.id, channels })
    setBusy(false)
    if (!d.ok) return fail(d.error)
    setPending(d.pendingId); setCode(''); setStep('consentCode')
  }

  async function consentVerify() {
    setMsg(null); setBusy(true)
    const d = await api({ action: 'consent-verify', pendingId: pending, code })
    setBusy(false)
    if (!d.ok) return fail(d.error)
    if (d.status === 'granted') { setStep('consentDone'); return }
    if (d.status === 'wrong_code') return fail(`Kod hatalı. Kalan deneme: ${d.left}`)
    fail('Kodun süresi doldu veya çok fazla deneme yapıldı.')
  }

  async function search() {
    setBusy(true); const d = await api({ action: 'search', q }); setBusy(false)
    setSearched(true); setRows(d.ok ? d.rows : []); if (!d.ok) fail(d.error)
  }

  const notice = legal?.privacy_notice
  const consent = legal?.marketing_consent
  const msgBox = msg && <div style={{ padding: '12px 14px', borderRadius: 10, fontSize: 15, background: msg.t === 'err' ? 'rgba(220,60,60,.12)' : 'rgba(40,160,90,.12)', color: msg.t === 'err' ? '#c33' : '#1a8a4a' }}>{msg.s}</div>

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button style={tab === 'kayit' ? btn : btn2} onClick={() => setTab('kayit')}>Müşteri Kaydı</button>
        <button style={tab === 'ara' ? btn : btn2} onClick={() => setTab('ara')}>Müşteri Ara</button>
      </div>

      {tab === 'kayit' && step === 'form' && (
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 12 }}>
            <div><label style={lbl}>Ad *</label><input style={inp} value={f.first} onChange={set('first')} autoComplete="off" /></div>
            <div><label style={lbl}>Soyad</label><input style={inp} value={f.last} onChange={set('last')} autoComplete="off" /></div>
            <div><label style={lbl}>Telefon (doğrulama SMS'i gider)</label><input style={inp} inputMode="tel" placeholder="05xx xxx xx xx" value={f.phone} onChange={set('phone')} onBlur={liveCheck} autoComplete="off" /></div>
            <div><label style={lbl}>E-posta</label><input style={inp} type="email" value={f.email} onChange={set('email')} onBlur={liveCheck} autoComplete="off" /></div>
            <div><label style={lbl}>Şehir</label><input style={inp} value={f.city} onChange={set('city')} autoComplete="off" /></div>
            <div><label style={lbl}>Doğum günü</label><input style={inp} type="date" value={f.birth} onChange={set('birth')} /></div>
          </div>
          {dup && <div style={{ padding: 12, borderRadius: 10, background: 'rgba(230,160,30,.14)', fontSize: 15 }}>
            {dup.same_store ? `Bu müşteri zaten kayıtlı: ${dup.name}. Tekrar kaydedilmez.` : `Bu müşteri sistemde başka bir mağazada kayıtlı (${dup.name}).`}
            {!dup.same_store && f.email && !f.phone && <div style={{ marginTop: 8 }}><button style={btn2} disabled={busy} onClick={link}>Mağazama bağla</button></div>}
          </div>}
          <div style={{ border: '1px solid var(--bdr)', borderRadius: 10, padding: 12 }}>
            <button type="button" style={{ ...btn2, padding: '10px 14px', fontSize: 15 }} onClick={() => setShowNotice(v => !v)}>{showNotice ? 'Aydınlatma metnini gizle' : 'Aydınlatma metnini müşteriye göster'}</button>
            {showNotice && notice && <div style={{ marginTop: 10, whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.6, maxHeight: 320, overflow: 'auto' }}><b>{notice.title}</b>{'\n\n'}{notice.body}</div>}
            <label style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 12, fontSize: 15, cursor: 'pointer' }}>
              <input type="checkbox" checked={ack} onChange={e => setAck(e.target.checked)} style={{ width: 22, height: 22, marginTop: 1 }} />
              <span>Aydınlatma metni müşteriye gösterildi / okundu. <span style={{ color: 'var(--tx3)' }}>(Bu bir onay değil, bilgilendirme kaydıdır.)</span></span>
            </label>
          </div>
          {msgBox}
          <div><button style={{ ...btn, opacity: busy || !f.first || (!f.phone && !f.email) || (!!f.phone && !ack) ? .5 : 1 }}
            disabled={busy || !f.first || (!f.phone && !f.email) || (!!f.phone && !ack)} onClick={submit}>
            {f.phone ? 'Doğrulama kodu gönder' : 'Kaydet (yalnızca e-posta)'}</button></div>
        </div>
      )}

      {tab === 'kayit' && (step === 'code' || step === 'consentCode') && (
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 16 }}>{step === 'code' ? 'Müşterinin telefonuna 6 haneli doğrulama kodu gönderildi.' : 'Müşterinin telefonuna ticari ileti izni için 6 haneli kod gönderildi.'} Müşteriden kodu isteyin.</div>
          <input style={{ ...inp, fontSize: 28, letterSpacing: 8, textAlign: 'center', maxWidth: 260 }} inputMode="numeric" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} autoFocus />
          {msgBox}
          <div style={{ display: 'flex', gap: 8 }}>
            <button style={{ ...btn, opacity: busy || code.length !== 6 ? .5 : 1 }} disabled={busy || code.length !== 6} onClick={step === 'code' ? verify : consentVerify}>Doğrula</button>
            <button style={btn2} onClick={() => step === 'code' ? reset() : setStep('done')}>Vazgeç</button>
          </div>
        </div>
      )}

      {tab === 'kayit' && step === 'done' && cust && (
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a8a4a' }}>Müşteri kaydedildi (No: {cust.no})</div>
          {consent && f.phone && <div style={{ border: '1px solid var(--bdr)', borderRadius: 10, padding: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>{consent.title}</div>
            <div style={{ whiteSpace: 'pre-wrap', fontSize: 15, lineHeight: 1.6, marginBottom: 10 }}>{consent.body}</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 10 }}>
              {[['sms', 'SMS'], ['email', 'E-posta'], ['call', 'Arama']].map(([k, l]) => (
                <label key={k} style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 16 }}>
                  <input type="checkbox" style={{ width: 22, height: 22 }} checked={ch[k]} disabled={k === 'email' && !f.email} onChange={e => setCh(p => ({ ...p, [k]: e.target.checked }))} />{l}</label>))}
            </div>
            <div style={{ fontSize: 13, color: 'var(--tx3)', marginBottom: 10 }}>İsteğe bağlıdır. Müşteri istemezse boş bırakın; kayıt etkilenmez. Seçilirse müşterinin telefonuna ayrı bir onay kodu gider.</div>
            {msgBox}
            <button style={{ ...btn, marginTop: 8, opacity: busy ? .5 : 1 }} disabled={busy} onClick={consentStart}>İzin için kod gönder</button>
          </div>}
          <div><button style={btn2} onClick={reset}>Yeni müşteri</button></div>
        </div>
      )}

      {tab === 'kayit' && step === 'consentDone' && (
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 700, color: '#1a8a4a' }}>Ticari ileti izni kaydedildi</div>
          <div><button style={btn} onClick={reset}>Yeni müşteri</button></div>
        </div>
      )}

      {tab === 'ara' && (
        <div className="card" style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input style={inp} placeholder="Ad, soyad veya telefon (en az 3 karakter)" value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && q.trim().length >= 3 && search()} />
            <button style={{ ...btn, opacity: q.trim().length < 3 || busy ? .5 : 1 }} disabled={q.trim().length < 3 || busy} onClick={search}>Ara</button>
          </div>
          {msgBox}
          {searched && rows.length === 0 && <div style={{ color: 'var(--tx3)' }}>Kayıt bulunamadı.</div>}
          {rows.map(r => (
            <div key={r.id} style={{ border: '1px solid var(--bdr)', borderRadius: 10, padding: 12, fontSize: 16 }}>
              <b>{r.name}</b> <span style={{ color: 'var(--tx3)' }}>#{r.customer_no}</span>
              <div style={{ color: 'var(--tx2)', fontSize: 14 }}>{[r.phone, r.city, r.birth_date].filter(Boolean).join(' · ')}</div>
            </div>))}
        </div>
      )}
    </div>
  )
}
