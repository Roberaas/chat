'use client'
import { useState } from 'react'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type T = { code: string; title: string; body: string; version: number }
export default function LegalTextsEditor({ initial }: { initial: T[] }) {
  const [items, setItems] = useState(initial)
  const [msg, setMsg] = useState('')
  async function save(t: T) {
    const sb = createCrmBrowserClient()
    const { error } = await sb.from('legal_texts').update({ title: t.title, body: t.body, version: t.version + 1, updated_at: new Date().toISOString() }).eq('code', t.code)
    if (error) return setMsg(error.message)
    setItems(p => p.map(x => x.code === t.code ? { ...x, version: x.version + 1 } : x)); setMsg('Kaydedildi (yeni sürüm).')
  }
  const edit = (code: string, k: 'title' | 'body', v: string) => setItems(p => p.map(x => x.code === code ? { ...x, [k]: v } : x))
  return (
    <div style={{ padding: 22, maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="card" style={{ padding: 14, fontSize: 13, color: 'var(--tx2)', lineHeight: 1.7 }}>
        Köşeli parantezli alanları ([Şirket unvanı], hukuki sebep, iletişim) hukuk danışmanınızla doldurun. Her kayıt yeni sürüm üretir; müşteri kayıtlarında hangi sürümün gösterildiği saklanır.
        Aydınlatma metni bir onay metni değildir, ticari ileti izni metni ise ayrı ve isteğe bağlıdır.
      </div>
      {items.map(t => (
        <div key={t.code} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div className="card-title">{t.code === 'privacy_notice' ? 'Aydınlatma metni' : 'Ticari ileti izni'} · sürüm {t.version}</div>
          <input value={t.title} onChange={e => edit(t.code, 'title', e.target.value)} style={{ padding: 10, border: '1px solid var(--bdr)', borderRadius: 8, background: 'var(--bg)', color: 'var(--tx)' }} />
          <textarea value={t.body} rows={14} onChange={e => edit(t.code, 'body', e.target.value)} style={{ padding: 10, border: '1px solid var(--bdr)', borderRadius: 8, background: 'var(--bg)', color: 'var(--tx)', fontFamily: 'inherit', lineHeight: 1.6 }} />
          <div><button onClick={() => save(t)} style={{ padding: '9px 18px', border: 0, borderRadius: 8, background: 'var(--ac)', color: '#fff', fontWeight: 600, cursor: 'pointer' }}>Kaydet</button></div>
        </div>))}
      {msg && <div style={{ fontSize: 13, color: 'var(--tx2)' }}>{msg}</div>}
    </div>
  )
}
