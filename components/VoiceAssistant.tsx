'use client'

import { getSessions } from '@/lib/sessionsApi'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Mic, MicOff, X, Volume2 } from 'lucide-react'

type Mesaj = { rol: 'user' | 'assistant'; metin: string }

const SAYFALAR: Record<string, string> = {
  'konuşma': '/konusmalar', 'konuşmalar': '/konusmalar', 'mesaj': '/konusmalar',
  'destek': '/canli-destek', 'canlı': '/canli-destek',
  'müşteri': '/musteriler', 'müşteriler': '/musteriler',
  'görev': '/calisma', 'çalışma': '/calisma',
  'takvim': '/takvim',
  'rapor': '/raporlar', 'raporlar': '/raporlar',
  'kullanıcı': '/kullanicilar', 'kullanıcılar': '/kullanicilar',
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
  const durumRef = useRef(durum)
  durumRef.current = durum

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

  // WhatsApp bot + görev verisini asistana özetle
  const tumVeriCek = useCallback(async () => {
    try {
      const [sessRes, gorevRes] = await Promise.all([
        getSessions('limit=500'),
        fetch('/api/gorev').then(r => r.json()).catch(() => ({ gorevler: [] })),
      ])
      const sessions: any[] = sessRes.data || []
      const now = new Date()
      const bugun = now.toDateString()
      const haftaOnce = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
      const ikiHaftaOnce = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

      const bugunS = sessions.filter(x => new Date(x.updated_at).toDateString() === bugun)
      const buHafta = sessions.filter(x => new Date(x.updated_at) >= haftaOnce)
      const gecenHafta = sessions.filter(x => { const d = new Date(x.updated_at); return d >= ikiHaftaOnce && d < haftaOnce })
      const canli = sessions.filter(x => x.bulundugu_menu === 'canli')
      const canliTarih = sessions.filter(x => x.last_intent === 'human_handover' || x.bulundugu_menu === 'canli')
      const botOran = sessions.length ? Math.round(((sessions.length - canliTarih.length) / sessions.length) * 100) : 0

      const intentSayac: Record<string, number> = {}
      sessions.forEach(x => { const i = x.last_intent || 'other'; intentSayac[i] = (intentSayac[i] || 0) + 1 })
      const enCokNiyet = Object.entries(intentSayac).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([k, v]) => `${k}(${v})`).join(', ')
      const trend = buHafta.length > gecenHafta.length ? 'artıyor' : buHafta.length < gecenHafta.length ? 'azalıyor' : 'stabil'

      const gorevler = gorevRes.gorevler || []
      const bekleyenGorev = gorevler.filter((g: any) => g.durum === 'bekliyor')
      const acilGorev = bekleyenGorev.filter((g: any) => g.oncelik === 'acil')
      const gecikGorev = bekleyenGorev.filter((g: any) => g.bitis_tarihi && new Date(g.bitis_tarihi) < now)

      return `
=== GÜNCEL PANEL VERİLERİ ===
TARİH: ${now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })}

WHATSAPP BOT:
- Toplam konuşma: ${sessions.length}
- Bugün aktif: ${bugunS.length}
- Bu hafta: ${buHafta.length} (geçen hafta: ${gecenHafta.length}) — trend ${trend}
- Şu an canlı destekte bekleyen: ${canli.length}
- Canlı desteğe düşen toplam: ${canliTarih.length}
- Bot başarı oranı: %${botOran}
- En sık niyetler: ${enCokNiyet || 'veri yok'}

GÖREVLER:
- Bekleyen: ${bekleyenGorev.length}
- Acil: ${acilGorev.length}
- Geciken: ${gecikGorev.length}
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
    bekliyor: 'var(--tx3)',
    dinliyor: 'var(--green)',
    isleniyor: 'var(--amber)',
    konusuyor: 'var(--ac)',
  }
  const DURUM_YAZI: Record<string, string> = {
    bekliyor: 'Hazır',
    dinliyor: 'Dinliyorum...',
    isleniyor: 'Düşünüyorum...',
    konusuyor: 'Konuşuyor...',
  }
  const pulse = durum === 'dinliyor' || durum === 'konusuyor'

  return (
    <>
      {/* Mikrofon butonu */}
      {!acik && (
        <div style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 50, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
          {hata && (
            <div className="toast toast-err" style={{ margin: 0, maxWidth: 220, textAlign: 'right', fontSize: 12 }}>{hata}</div>
          )}
          <button
            onClick={izin ? () => {
              setAcik(true)
              const k = 'Merhaba Mert! Nasıl yardımcı olabilirim?'
              setMesajlar([{ rol: 'assistant', metin: k }])
              setTimeout(() => konuş(k), 300)
            } : izinAl}
            title={izin ? '"Hey Roberto" deyin veya tıklayın' : 'Mikrofon izni için tıklayın'}
            style={{ width: 52, height: 52, borderRadius: '50%', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', cursor: 'pointer', background: izin ? 'linear-gradient(135deg,var(--ac),#5b4de0)' : 'var(--s5)', boxShadow: izin ? '0 6px 20px rgba(124,106,247,.4)' : '0 4px 14px rgba(0,0,0,.25)', transition: 'transform .15s' }}
            onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
            onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
          >
            {izin ? <Mic size={22} strokeWidth={1.75} /> : <MicOff size={22} strokeWidth={1.75} />}
          </button>
          {izin && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace' }}>
              <span className="anim-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)' }} />
              Hey Roberto
            </div>
          )}
        </div>
      )}

      {/* Asistan paneli */}
      {acik && (
        <div className="card anim-pop" style={{ position: 'fixed', bottom: 22, right: 22, zIndex: 50, width: 'min(340px, calc(100vw - 32px))', maxHeight: '65vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,.45)', background: 'var(--s1)' }}>

          <div style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--bdr)', flexShrink: 0 }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: 38, height: 38, borderRadius: 11, background: 'var(--ac2)', color: 'var(--ac)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Mic size={17} /></div>
              <span className={pulse ? 'anim-pulse' : undefined} style={{ position: 'absolute', bottom: -2, right: -2, width: 11, height: 11, borderRadius: '50%', border: '2px solid var(--s1)', background: DURUM_RENK[durum] }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--tx)' }}>Roberto Asistan</div>
              <div style={{ fontSize: 10.5, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace' }}>{DURUM_YAZI[durum]}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {durum === 'konusuyor' && (
                <button onClick={() => window.speechSynthesis.cancel()} title="Sustur" style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6 }}><Volume2 size={14} /></button>
              )}
              <button onClick={kapat} title="Kapat" style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6 }}><X size={14} /></button>
            </div>
          </div>

          <div ref={mesajlarRef} style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0, background: 'var(--bg)' }}>
            {mesajlar.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.rol === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '85%', padding: '9px 13px', fontSize: 13, lineHeight: 1.5,
                  borderRadius: 14, borderBottomRightRadius: m.rol === 'user' ? 4 : 14, borderBottomLeftRadius: m.rol === 'user' ? 14 : 4,
                  background: m.rol === 'user' ? 'var(--ac)' : 'var(--s3)', color: m.rol === 'user' ? '#fff' : 'var(--tx)',
                  border: m.rol === 'user' ? 'none' : '1px solid var(--bdr)',
                }}>{m.metin}</div>
              </div>
            ))}
            {durum === 'isleniyor' && (
              <div style={{ display: 'flex' }}>
                <div style={{ background: 'var(--s3)', border: '1px solid var(--bdr)', padding: '10px 14px', borderRadius: 14, borderBottomLeftRadius: 4, display: 'flex', gap: 4 }}>
                  {[0, 1, 2].map(i => <span key={i} className="anim-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--tx3)', animationDelay: `${i * 0.15}s` }} />)}
                </div>
              </div>
            )}
          </div>

          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: DURUM_RENK[durum] }} />
              <span style={{ fontSize: 11.5, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace' }}>{DURUM_YAZI[durum]}</span>
            </div>
            {(durum === 'bekliyor' || durum === 'dinliyor') && (
              <button className="btn" onClick={dinlemeBaslat} style={{ padding: '6px 12px', fontSize: 12 }}><Mic size={12} /> Konuş</button>
            )}
          </div>
        </div>
      )}
    </>
  )
}
