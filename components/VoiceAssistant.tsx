'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, X, Volume2, Loader2 } from 'lucide-react'

type Mesaj = { rol: 'user' | 'assistant'; metin: string }

const SAYFALAR: Record<string, string> = {
  'sipariş': '/siparisler', 'siparişler': '/siparisler',
  'konuşma': '/konusmalar', 'mesaj': '/konusmalar',
  'destek': '/canli-destek', 'canlı': '/canli-destek',
  'müşteri': '/musteriler', 'müşteriler': '/musteriler',
  'abone': '/abonelikler', 'abonelik': '/abonelikler',
  'ödeme': '/odemeler', 'ödemeler': '/odemeler',
  'muhasebe': '/muhasebe', 'gelir': '/muhasebe',
  'harita': '/harita', 'teslimat': '/harita',
  'görev': '/calisma', 'çalışma': '/calisma',
  'takvim': '/takvim',
  'rapor': '/raporlar', 'raporlar': '/raporlar',
  'reklam': '/reklamlar',
  'ana sayfa': '/', 'genel': '/',
}

export default function VoiceAssistant() {
  const [acik, setAcik] = useState(false)
  const [durum, setDurum] = useState<'bekliyor' | 'dinliyor' | 'isleniyor' | 'konusuyor'>('bekliyor')
  const [mesajlar, setMesajlar] = useState<Mesaj[]>([])
  const [izin, setIzin] = useState(false)
  const [hata, setHata] = useState('')
  const router = useRouter()
  const mesajlarRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<any>(null)
  const wakeRef = useRef<any>(null)
  const acikRef = useRef(false)
  acikRef.current = acik

  useEffect(() => {
    if (mesajlarRef.current) mesajlarRef.current.scrollTop = mesajlarRef.current.scrollHeight
  }, [mesajlar])

  const konuş = useCallback((metin: string) => {
    window.speechSynthesis.cancel()
    const u = new SpeechSynthesisUtterance(metin)
    u.lang = 'tr-TR'
    u.rate = 1.05
    u.pitch = 1
    u.onstart = () => setDurum('konusuyor')
    u.onend = () => {
      if (acikRef.current) setDurum('dinliyor')
    }
    window.speechSynthesis.speak(u)
  }, [])

  // Tüm veriyi derin analiz için çek
  const tumVeriCek = useCallback(async () => {
    try {
      const [sipRes, abRes, gorevRes, sessionRes] = await Promise.all([
        fetch('/api/shopify/orders').then(r => r.json()).catch(() => ({ orders: [] })),
        fetch('/api/aboneliker').then(r => r.json()).catch(() => ({ subs: [] })),
        fetch('/api/gorev').then(r => r.json()).catch(() => ({ gorevler: [] })),
        fetch('/api/konusmalar').then(r => r.json()).catch(() => ({ sessions: [] })),
      ])

      const orders = sipRes.orders || []
      const now = new Date()
      const bugun = now.toDateString()
      const ayBas = new Date(now.getFullYear(), now.getMonth(), 1)
      const haftaOnce = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const ikiHaftaOnce = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

      const bugunOrders = orders.filter((o: any) => new Date(o.created_at).toDateString() === bugun)
      const buHaftaOrders = orders.filter((o: any) => new Date(o.created_at) >= haftaOnce)
      const gecenHaftaOrders = orders.filter((o: any) => {
        const d = new Date(o.created_at)
        return d >= ikiHaftaOnce && d < haftaOnce
      })
      const bekleyenSip = orders.filter((o: any) => !o.fulfillment_status || o.fulfillment_status === 'unfulfilled')
      const iadeSip = orders.filter((o: any) => o.has_refund)
      const ayGelir = orders.filter((o: any) => new Date(o.created_at) >= ayBas && o.financial_status === 'paid')
        .reduce((t: number, o: any) => t + parseFloat(o.total_price || 0), 0)
      const ortSepet = orders.length > 0 ? orders.reduce((t: number, o: any) => t + parseFloat(o.total_price || 0), 0) / orders.length : 0

      // Ürün analizi
      const urunSayac: Record<string, number> = {}
      orders.forEach((o: any) => {
        o.line_items?.forEach((li: any) => {
          urunSayac[li.title] = (urunSayac[li.title] || 0) + li.quantity
        })
      })
      const enCokSatan = Object.entries(urunSayac).sort((a,b) => b[1]-a[1]).slice(0,3).map(([k,v]) => `${k}(${v})`).join(', ')

      const aboneler = abRes.subs || []
      const aktifAboneler = aboneler.filter((a: any) => a.durum === 'abone')
      const bekleyenAboneler = aboneler.filter((a: any) => a.durum === 'bekliyor')
      const haftalikAdet = aktifAboneler.reduce((t: number, a: any) => t + (a.haftalik_adet || 0), 0)
      const aylikAbonelikGelir = haftalikAdet * 130 * 4

      const gorevler = gorevRes.gorevler || []
      const bekleyenGorev = gorevler.filter((g: any) => g.durum === 'bekliyor')
      const acilGorev = bekleyenGorev.filter((g: any) => g.oncelik === 'acil')
      const gecikGorev = bekleyenGorev.filter((g: any) => g.bitis_tarihi && new Date(g.bitis_tarihi) < now)

      const haftaTrend = buHaftaOrders.length > gecenHaftaOrders.length ? 'artıyor' :
        buHaftaOrders.length < gecenHaftaOrders.length ? 'azalıyor' : 'stabil'

      return `
=== GÜNCEL DASHBOARD VERİLERİ ===
TARİH: ${now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}

SİPARİŞ ANALİZİ:
- Toplam sipariş: ${orders.length}
- Bugün: ${bugunOrders.length} sipariş
- Bu hafta: ${buHaftaOrders.length} sipariş (geçen hafta: ${gecenHaftaOrders.length})
- Haftalık trend: ${haftaTrend}
- Kargo bekleyen: ${bekleyenSip.length} sipariş
- İade olan: ${iadeSip.length} sipariş
- Bu ay gelir: ${ayGelir.toLocaleString('tr')} TL
- Ortalama sepet: ${Math.round(ortSepet).toLocaleString('tr')} TL
- En çok satan: ${enCokSatan || 'veri yok'}

ABONELİK ANALİZİ:
- Aktif abone: ${aktifAboneler.length}
- Onay bekleyen: ${bekleyenAboneler.length}
- Haftalık teslimat: ${haftalikAdet} adet
- Tahmini aylık abonelik geliri: ${aylikAbonelikGelir.toLocaleString('tr')} TL

GÖREV ANALİZİ:
- Bekleyen görev: ${bekleyenGorev.length}
- Acil görev: ${acilGorev.length}
- Geciken görev: ${gecikGorev.length}
${acilGorev[0] ? '- ACİL: ' + acilGorev[0].baslik : ''}
${bekleyenGorev[0] ? '- Son görev: ' + bekleyenGorev[0].baslik : ''}
      `.trim()
    } catch {
      return 'Veri çekilemedi.'
    }
  }, [])

  const soruy = useCallback(async (soru: string) => {
    setDurum('isleniyor')
    const s = soru.toLowerCase()

    // Sayfa yönlendirme — "git", "aç", "göster" veya sadece sayfa adı
    const gitKomutlari = ['git', 'aç', 'göster', 'geç', 'gidin']
    const sayfaIste = gitKomutlari.some(k => s.includes(k))

    for (const [anahtar, link] of Object.entries(SAYFALAR)) {
      if (s.includes(anahtar) && sayfaIste) {
        router.push(link)
        const c = `${anahtar.charAt(0).toUpperCase() + anahtar.slice(1)} sayfasına gidiyorum.`
        setMesajlar(m => [...m, { rol: 'assistant', metin: c }])
        konuş(c)
        return
      }
    }

    // Veri çek
    const veri = await tumVeriCek()

    // Groq backend API
    try {
      const gecmis = mesajlar.slice(-6).map(m => ({
        role: m.rol === 'user' ? 'user' : 'assistant',
        content: m.metin
      }))

      const res = await fetch('/api/asistan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soru, veri, gecmis })
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      const cevap = data.cevap || 'Anlayamadım, tekrar söyler misin?'
      setMesajlar(m => [...m, { rol: 'assistant', metin: cevap }])
      konuş(cevap)
    } catch (e) {
      console.error('Asistan hata:', e)
      const c = 'Bağlantı hatası oluştu, tekrar dener misin?'
      setMesajlar(m => [...m, { rol: 'assistant', metin: c }])
      konuş(c)
    }
  }, [mesajlar, konuş, tumVeriCek, router])

  const dinlemeBaslat = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    try { recognitionRef.current?.stop() } catch {}

    const r = new SR()
    r.lang = 'tr-TR'
    r.continuous = false
    r.interimResults = false
    r.maxAlternatives = 1

    r.onstart = () => setDurum('dinliyor')
    r.onresult = (e: any) => {
      const metin = e.results[0][0].transcript
      if (!metin.trim()) return
      setMesajlar(m => [...m, { rol: 'user', metin }])
      soruy(metin)
    }
    r.onend = () => {
      if (acikRef.current && durumRef.current === 'dinliyor' && recognitionRef.current === r) {
        setTimeout(() => {
          if (acikRef.current && durumRef.current === 'dinliyor') {
            try { r.start() } catch {}
          }
        }, 300)
      }
    }
    r.onerror = (e: any) => {
      if (e.error === 'aborted') return
      if (e.error !== 'no-speech') setDurum('dinliyor')
    }
    recognitionRef.current = r
    try { r.start() } catch {}
  }, [soruy])

  const durumRef = useRef(durum)
  durumRef.current = durum

  const wakeWordBaslat = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return
    try { wakeRef.current?.stop() } catch {}

    const r = new SR()
    r.lang = 'tr-TR'
    r.continuous = true
    r.interimResults = true

    r.onresult = (e: any) => {
      if (acikRef.current) return
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript.toLowerCase().trim()
        const wakeWords = ['hey roberto', 'ey roberto', 'hey roberto', 'hey roberto', 'hey robertoo', 'ay roberto']
        if (wakeWords.some(w => t.includes(w))) {
          r.stop()
          setAcik(true)
          const karsilama = 'Merhaba Mert! Ben Roberto yapay zeka asistanı. Nasıl yardımcı olabilirim?'
          setMesajlar([{ rol: 'assistant', metin: karsilama }])
          setTimeout(() => konuş(karsilama), 300)
          break
        }
      }
    }
    r.onend = () => {
      if (!acikRef.current && wakeRef.current === r) {
        setTimeout(() => {
          if (!acikRef.current && wakeRef.current === r) {
            try { r.start() } catch {}
          }
        }, 800)
      }
    }
    r.onerror = (e: any) => {
      if (e.error === 'aborted') return
      setTimeout(() => {
        if (!acikRef.current && wakeRef.current === r) {
          try { r.start() } catch {}
        }
      }, 1500)
    }
    wakeRef.current = r
    try { r.start() } catch {}
  }, [konuş])

  // Sayfa yüklenince izin kontrolü
  useEffect(() => {
    navigator.permissions?.query({ name: 'microphone' as PermissionName })
      .then(result => {
        if (result.state === 'granted') {
          setIzin(true)
          wakeWordBaslat()
        }
      }).catch(() => {})

    return () => {
      // Sayfa geçişinde her şeyi temizle
      try { wakeRef.current?.abort() } catch {}
      try { wakeRef.current?.stop() } catch {}
      try { recognitionRef.current?.abort() } catch {}
      try { recognitionRef.current?.stop() } catch {}
      wakeRef.current = null
      recognitionRef.current = null
      window.speechSynthesis.cancel()
    }
  }, [wakeWordBaslat])

  // Asistan açılınca dinle, kapanınca wake word'e dön
  useEffect(() => {
    if (acik) {
      setTimeout(() => dinlemeBaslat(), 2500)
    } else {
      try { recognitionRef.current?.stop() } catch {}
      window.speechSynthesis.cancel()
      setDurum('bekliyor')
      if (izin) setTimeout(() => wakeWordBaslat(), 800)
    }
  }, [acik])

  const izinAl = async () => {
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true })
      setIzin(true)
      setHata('')
      wakeWordBaslat()
      // Paneli aç ve karşıla
      setAcik(true)
      const k = 'Merhaba Mert! Mikrofon bağlandı. Artık "Hey Roberto" diyerek beni her zaman açabilirsiniz.'
      setMesajlar([{ rol: 'assistant', metin: k }])
      setTimeout(() => konuş(k), 300)
    } catch {
      setHata('Mikrofon izni verilmedi. Tarayıcı ayarlarından izin ver.')
    }
  }

  const kapat = () => {
    setAcik(false)
    setMesajlar([])
  }

  const DURUM_RENK: Record<string, string> = {
    bekliyor: 'bg-ink-500',
    dinliyor: 'bg-moss-500 animate-pulse',
    isleniyor: 'bg-amber-400',
    konusuyor: 'bg-ember-400 animate-pulse',
  }
  const DURUM_YAZI: Record<string, string> = {
    bekliyor: 'Hazır',
    dinliyor: 'Dinliyorum...',
    isleniyor: 'Düşünüyorum...',
    konusuyor: 'Konuşuyor...',
  }

  return (
    <>
      {/* Mikrofon butonu */}
      {!acik && (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
          {hata && (
            <div className="bg-ember-50 border border-ember-200 rounded-xl px-3 py-2 text-xs text-ember-700 max-w-[200px] text-right">
              {hata}
            </div>
          )}
          <button
            onClick={izin ? () => {
              setAcik(true)
              const k = 'Merhaba Mert! Nasıl yardımcı olabilirim?'
              setMesajlar([{ rol: 'assistant', metin: k }])
              setTimeout(() => konuş(k), 300)
            } : izinAl}
            className={`w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 active:scale-95 ${izin ? 'bg-ink-900 hover:bg-ink-700' : 'bg-ember-500 hover:bg-ember-600'}`}
            title={izin ? '"Hey Roberto" deyin veya tıklayın' : 'Mikrofon izni için tıklayın'}
          >
            {izin ? <Mic className="w-6 h-6 text-white" strokeWidth={1.75} /> : <MicOff className="w-6 h-6 text-white" strokeWidth={1.75} />}
          </button>
          {izin && (
            <div className="flex items-center gap-1.5 text-[10px] text-ink-400 font-mono">
              <div className="w-1.5 h-1.5 rounded-full bg-moss-500 animate-pulse" />
              Hey Roberto
            </div>
          )}
        </div>
      )}

      {/* Asistan paneli */}
      {acik && (
        <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl shadow-2xl border border-cream-200 overflow-hidden flex flex-col bg-white" style={{ maxHeight: '65vh' }}>

          {/* Header */}
          <div className="bg-ink-900 px-4 py-3 flex items-center gap-3 shrink-0">
            <div className="relative shrink-0">
              <div className="w-10 h-10 rounded-xl bg-moss-700 flex items-center justify-center text-xl">🥛</div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-ink-900 ${DURUM_RENK[durum]}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-cream-50">Roberto Asistan</div>
              <div className="text-[10px] text-ink-400 font-mono">{DURUM_YAZI[durum]}</div>
            </div>
            <div className="flex items-center gap-1.5">
              {durum === 'konusuyor' && (
                <button onClick={() => window.speechSynthesis.cancel()} className="p-1.5 rounded-lg hover:bg-ink-700 text-ink-400 hover:text-white transition-colors">
                  <Volume2 className="w-3.5 h-3.5" />
                </button>
              )}
              <button onClick={kapat} className="p-1.5 rounded-lg hover:bg-ink-700 text-ink-400 hover:text-white transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Mesajlar */}
          <div ref={mesajlarRef} className="flex-1 overflow-y-auto p-4 space-y-3 bg-cream-50 min-h-0">
            {mesajlar.map((m, i) => (
              <div key={i} className={`flex ${m.rol === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed ${
                  m.rol === 'user'
                    ? 'bg-ink-900 text-cream-50 rounded-br-sm'
                    : 'bg-white border border-cream-200 text-ink-800 rounded-bl-sm shadow-sm'
                }`}>
                  {m.metin}
                </div>
              </div>
            ))}
            {durum === 'isleniyor' && (
              <div className="flex justify-start">
                <div className="bg-white border border-cream-200 px-4 py-2.5 rounded-2xl rounded-bl-sm flex items-center gap-2 shadow-sm">
                  <div className="flex gap-1">
                    {[0,1,2].map(i => (
                      <div key={i} className="w-1.5 h-1.5 rounded-full bg-ink-400 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Alt bar */}
          <div className="px-4 py-3 border-t border-cream-100 bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${DURUM_RENK[durum]}`} />
              <span className="text-xs text-ink-400 font-mono">{DURUM_YAZI[durum]}</span>
            </div>
            {(durum === 'bekliyor' || durum === 'dinliyor') && (
              <button onClick={dinlemeBaslat}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-moss-50 text-moss-700 rounded-xl text-xs font-medium hover:bg-moss-100 transition-colors">
                <Mic className="w-3 h-3" />
                Konuş
              </button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
