'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, X, User, Repeat, CheckSquare, Phone, MessageSquare, Package, ArrowRight } from 'lucide-react'

type Sonuc = {
  tip: string; id: any; baslik: string; alt: string; link: string; meta: string
}

const TIP_ICON: Record<string, any> = {
  musteri: User, abonelik: Repeat, gorev: CheckSquare,
  arama: Phone, not: MessageSquare, siparis: Package,
}
const TIP_LABEL: Record<string, string> = {
  musteri: 'Müşteri', abonelik: 'Abonelik', gorev: 'Görev',
  arama: 'Arama', not: 'Not', siparis: 'Sipariş',
}
const TIP_RENK: Record<string, string> = {
  musteri: '#7c9059', abonelik: '#d97757', gorev: '#c4633f',
  arama: '#d9c07a', not: '#a8b885', siparis: '#928c79',
}

export default function GlobalArama() {
  const [acik, setAcik] = useState(false)
  const [sorgu, setSorgu] = useState('')
  const [sonuclar, setSonuclar] = useState<Sonuc[]>([])
  const [yukleniyor, setYukleniyor] = useState(false)
  const [secili, setSecili] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()

  // Ctrl+K ile aç
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault()
        setAcik(a => !a)
      }
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

  function git(link: string) {
    router.push(link)
    setAcik(false)
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSecili(s => Math.min(s + 1, sonuclar.length - 1)) }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSecili(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter' && sonuclar[secili]) git(sonuclar[secili].link)
  }

  if (!acik) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh] px-4" onClick={() => setAcik(false)}>
      <div className="absolute inset-0 bg-ink-900/50 backdrop-blur-sm" />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-cream-200 overflow-hidden" onClick={e => e.stopPropagation()}>

        {/* Arama kutusu */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-cream-100">
          <Search className="w-5 h-5 text-ink-300 shrink-0" strokeWidth={1.5} />
          <input
            ref={inputRef}
            value={sorgu}
            onChange={e => setSorgu(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Müşteri, sipariş, görev, not ara..."
            className="flex-1 text-base text-ink-900 placeholder-ink-300 focus:outline-none bg-transparent"
          />
          {sorgu && (
            <button onClick={() => setSorgu('')} className="text-ink-300 hover:text-ink-600">
              <X className="w-4 h-4" />
            </button>
          )}
          <kbd className="hidden sm:flex items-center gap-1 px-2 py-1 bg-cream-100 text-ink-400 text-[10px] rounded-lg font-mono">
            ESC
          </kbd>
        </div>

        {/* Sonuçlar */}
        <div className="max-h-[60vh] overflow-y-auto">
          {yukleniyor && (
            <div className="px-5 py-4 space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-cream-100 rounded-xl animate-pulse" />)}
            </div>
          )}

          {!yukleniyor && sorgu.length >= 2 && sonuclar.length === 0 && (
            <div className="px-5 py-10 text-center">
              <div className="text-3xl mb-2">🔍</div>
              <p className="text-sm text-ink-400">"{sorgu}" için sonuç bulunamadı</p>
            </div>
          )}

          {!yukleniyor && sonuclar.length > 0 && (
            <div className="py-2">
              {/* Tip bazlı grupla */}
              {(['musteri', 'abonelik', 'siparis', 'gorev', 'arama', 'not'] as string[]).map(tip => {
                const grup = sonuclar.filter(s => s.tip === tip)
                if (!grup.length) return null
                const Icon = TIP_ICON[tip] || Search
                return (
                  <div key={tip}>
                    <div className="px-5 py-1.5 flex items-center gap-2">
                      <div className="w-4 h-4 rounded flex items-center justify-center" style={{ background: `${TIP_RENK[tip]}20` }}>
                        <Icon className="w-2.5 h-2.5" style={{ color: TIP_RENK[tip] }} strokeWidth={2.5} />
                      </div>
                      <span className="text-[10px] uppercase tracking-[0.2em] text-ink-300 font-medium">{TIP_LABEL[tip]}</span>
                    </div>
                    {grup.map((s, i) => {
                      const globalI = sonuclar.indexOf(s)
                      const aktif = globalI === secili
                      return (
                        <button key={`${s.tip}-${s.id}`} onClick={() => git(s.link)}
                          onMouseEnter={() => setSecili(globalI)}
                          className={`w-full flex items-center gap-4 px-5 py-3 text-left transition-colors ${aktif ? 'bg-ink-900' : 'hover:bg-cream-50'}`}>
                          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{ background: aktif ? 'rgba(255,255,255,0.1)' : `${TIP_RENK[s.tip]}15` }}>
                            <Icon className="w-4 h-4" style={{ color: aktif ? 'white' : TIP_RENK[s.tip] }} strokeWidth={1.75} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className={`text-sm font-medium truncate ${aktif ? 'text-white' : 'text-ink-900'}`}>{s.baslik}</div>
                            {s.alt && <div className={`text-xs truncate mt-0.5 ${aktif ? 'text-ink-300' : 'text-ink-400'}`}>{s.alt}</div>}
                          </div>
                          {s.meta && (
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${aktif ? 'bg-white/10 text-white' : 'bg-cream-100 text-ink-400'}`}>
                              {s.meta}
                            </span>
                          )}
                          <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${aktif ? 'text-white' : 'text-ink-300'}`} strokeWidth={1.75} />
                        </button>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}

          {!sorgu && (
            <div className="px-5 py-8 text-center">
              <div className="text-4xl mb-3">⌨️</div>
              <p className="text-sm font-medium text-ink-700 mb-1">Global Arama</p>
              <p className="text-xs text-ink-400">Müşteri, abonelik, sipariş, görev, not</p>
              <div className="flex items-center justify-center gap-4 mt-4 text-xs text-ink-300">
                <span><kbd className="bg-cream-100 px-1.5 py-0.5 rounded font-mono">↑↓</kbd> seç</span>
                <span><kbd className="bg-cream-100 px-1.5 py-0.5 rounded font-mono">Enter</kbd> git</span>
                <span><kbd className="bg-cream-100 px-1.5 py-0.5 rounded font-mono">Esc</kbd> kapat</span>
              </div>
            </div>
          )}
        </div>

        {/* Alt bar */}
        {sonuclar.length > 0 && (
          <div className="px-5 py-2.5 border-t border-cream-100 flex items-center justify-between">
            <span className="text-xs text-ink-300 font-mono">{sonuclar.length} sonuç</span>
            <span className="text-xs text-ink-300">Ctrl+K ile aç/kapat</span>
          </div>
        )}
      </div>
    </div>
  )
}
