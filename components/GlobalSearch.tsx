'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, User, CheckSquare, Phone, MessageSquare, ArrowRight, Repeat, Package } from 'lucide-react'

type Sonuc = { tip: string; id: any; baslik: string; alt: string; link: string; meta: string }

const TIP_ICON: Record<string, any> = { musteri: User, abonelik: Repeat, gorev: CheckSquare, arama: Phone, not: MessageSquare, siparis: Package }
const TIP_LABEL: Record<string, string> = { musteri: 'Müşteri', abonelik: 'Abonelik', gorev: 'Görev', arama: 'Arama', not: 'Not', siparis: 'Sipariş' }
const TIP_RENK: Record<string, string> = { musteri: 'var(--green)', abonelik: 'var(--amber)', gorev: 'var(--ac)', arama: 'var(--blue)', not: 'var(--tx2)', siparis: 'var(--tx2)' }

// Ctrl+K komut paleti — /api/arama
export default function GlobalSearch() {
  const [acik, setAcik] = useState(false)
  const [sorgu, setSorgu] = useState('')
  const [sonuclar, setSonuclar] = useState<Sonuc[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [secili, setSecili] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); setAcik(a => !a) }
      if (e.key === 'Escape') setAcik(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (acik) setTimeout(() => inputRef.current?.focus(), 50)
    else { setSorgu(''); setSonuclar([]) }
  }, [acik])

  const ara = useCallback(async (q: string) => {
    if (q.length < 2) { setSonuclar([]); return }
    setYukleniyor(true)
    try {
      const res = await fetch(`/api/arama?q=${encodeURIComponent(q)}`)
      const data = await res.json()
      setSonuclar(data.sonuclar || [])
      setSecili(0)
    } catch {}
    setYukleniyor(false)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => ara(sorgu), 300)
    return () => clearTimeout(t)
  }, [sorgu, ara])

  function git(link: string) { router.push(link); setAcik(false) }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSecili(s => Math.min(s + 1, sonuclar.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSecili(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && sonuclar[secili]) git(sonuclar[secili].link)
  }

  if (!acik) return null

  return (
    <div className="overlay" style={{ alignItems: 'flex-start', paddingTop: '10vh' }} onClick={() => setAcik(false)}>
      <div className="anim-pop" style={{ width: '100%', maxWidth: 560, background: 'var(--s1)', border: '1px solid var(--bdr2)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.4)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--bdr)' }}>
          <Search size={17} style={{ color: 'var(--tx3)', flexShrink: 0 }} />
          <input
            ref={inputRef} value={sorgu} onChange={e => setSorgu(e.target.value)} onKeyDown={onKeyDown}
            placeholder="Telefon, müşteri, görev, not ara..."
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--tx)', fontSize: 14.5 }}
          />
          {sorgu && <button onClick={() => setSorgu('')} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={15} /></button>}
          <kbd style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, color: 'var(--tx3)', background: 'var(--s3)', padding: '2px 6px', borderRadius: 5 }}>ESC</kbd>
        </div>

        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {yukleniyor && <div style={{ padding: 18, textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>Aranıyor...</div>}

          {!yukleniyor && sorgu.length >= 2 && sonuclar.length === 0 && (
            <div style={{ padding: '32px 18px', textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>“{sorgu}” için sonuç bulunamadı</div>
          )}

          {!yukleniyor && sonuclar.map((s, i) => {
            const Icon = TIP_ICON[s.tip] || Search
            const aktif = i === secili
            return (
              <button
                key={`${s.tip}-${s.id}-${i}`} onClick={() => git(s.link)} onMouseEnter={() => setSecili(i)}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '10px 18px', textAlign: 'left', background: aktif ? 'var(--ac2)' : 'transparent', border: 'none', borderLeft: `2.5px solid ${aktif ? 'var(--ac)' : 'transparent'}`, cursor: 'pointer', color: 'var(--tx)' }}
              >
                <div style={{ width: 32, height: 32, borderRadius: 8, background: 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Icon size={14} style={{ color: TIP_RENK[s.tip] }} strokeWidth={1.8} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.baslik}</p>
                  {s.alt && <p style={{ fontSize: 11.5, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.alt}</p>}
                </div>
                <span className="badge badge-muted">{TIP_LABEL[s.tip]}</span>
                <ArrowRight size={13} style={{ color: 'var(--tx3)' }} />
              </button>
            )
          })}

          {!sorgu && (
            <div style={{ padding: '28px 18px', textAlign: 'center', color: 'var(--tx3)', fontSize: 12.5 }}>
              Telefon numarası, müşteri adı, görev veya not yazın
              <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', gap: 14, fontSize: 11.5 }}>
                <span>↑↓ seç</span><span>Enter git</span><span>Esc kapat</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
