'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase, Session } from '@/lib/supabase'
import { Headphones, Clock, X, Send, RefreshCw, ChevronRight, CheckCheck, Bell, BellOff } from 'lucide-react'

type SlackMessage = {
  ts: string
  text: string
  user: string
  is_bot: boolean
  username: string
}

function parseSlackText(text: string): string {
  return text
    .replace(/:large_green_circle:/g, '🟢')
    .replace(/:envelope_with_arrow:/g, '📩')
    .replace(/:wave:/g, '👋')
    .replace(/:white_check_mark:/g, '✅')
    .replace(/:x:/g, '❌')
    .replace(/:telephone_receiver:/g, '📞')
    .replace(/:memo:/g, '📝')
    .replace(/:package:/g, '📦')
    .replace(/:truck:/g, '🚚')
    .replace(/:credit_card:/g, '💳')
    .replace(/:warning:/g, '⚠️')
    .replace(/\*([^*]+)\*/g, '$1')
    .trim()
}

function isSystemMessage(m: SlackMessage, idx: number): boolean {
  if (idx === 0) return true
  const text = m.text || ''
  return (
    text.includes('Yeni Canlı Destek Talebi') ||
    text.includes('was added to') ||
    text.includes('joined the channel') ||
    (m.is_bot && !m.username && (text.includes('Müşteri:') || text.includes('Telefon:')))
  )
}

export default function CanliDestekPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Session | null>(null)
  const [messages, setMessages] = useState<SlackMessage[]>([])
  const [msgLoading, setMsgLoading] = useState(false)
  const [reply, setReply] = useState('')
  const [sending, setSending] = useState(false)
  const [notifOn, setNotifOn] = useState(false)
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [lastMsgTs, setLastMsgTs] = useState<Record<string, string>>({})
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const prevSessionsRef = useRef<string[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Bildirim iznini iste
  async function requestNotif() {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    setNotifOn(perm === 'granted')
  }

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotifOn(true)
    }
    // Audio element oluştur
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
    audio.volume = 0.5
    audioRef.current = audio
  }, [])

  function notify(title: string, body: string) {
    // Masaüstü bildirim
    if (notifOn && Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/favicon.ico' })
    }
    // Ses
    if (audioRef.current) {
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {
        // Fallback: AudioContext
        try {
          const ctx = new AudioContext()
          const o = ctx.createOscillator()
          const g = ctx.createGain()
          o.connect(g)
          g.connect(ctx.destination)
          o.frequency.value = 880
          g.gain.setValueAtTime(0.4, ctx.currentTime)
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3)
          o.start()
          o.stop(ctx.currentTime + 0.3)
        } catch {}
      })
    }
  }

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('wa_sessions_roberto')
      .select('*')
      .not('slack_thread_ts', 'is', null)
      .neq('slack_thread_ts', '')
      .order('updated_at', { ascending: false })

    const list = (data || []) as Session[]
    const newPhones = list.map(s => s.phone)
    const oldPhones = prevSessionsRef.current
    const hasNew = newPhones.some(p => !oldPhones.includes(p))
    if (hasNew && oldPhones.length > 0) {
      notify('🔔 Yeni Canlı Destek Talebi', 'Yeni bir müşteri canlı desteğe bağlandı')
    }
    prevSessionsRef.current = newPhones
    setSessions(list)
    setLoading(false)
  }, [notifOn])

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [load])

  const loadMessages = useCallback(async (thread_ts: string, silent = false) => {
    if (!silent) setMsgLoading(true)
    const res = await fetch(`/api/slack/messages?thread_ts=${thread_ts}`)
    const data = await res.json()
    const filtered = (data.messages || []).filter((m: SlackMessage, i: number) => !isSystemMessage(m, i))

    const lastTs = filtered.length > 0 ? filtered[filtered.length - 1].ts : null
    setLastMsgTs(prev => {
      const prevTs = prev[thread_ts]
      if (lastTs && prevTs && lastTs !== prevTs) {
        const newMsgs = filtered.filter(
          (m: SlackMessage) => m.ts > prevTs && m.username !== 'roberto-admin'
        )
        if (newMsgs.length > 0) {
          notify('💬 Yeni Mesaj', newMsgs[newMsgs.length - 1].text.slice(0, 60))
          setUnread(u => ({ ...u, [thread_ts]: (u[thread_ts] || 0) + newMsgs.length }))
        }
      }
      return lastTs ? { ...prev, [thread_ts]: lastTs } : prev
    })

    setMessages(filtered)
    if (!silent) setMsgLoading(false)
  }, [notifOn])

  useEffect(() => {
    if (!selected?.slack_thread_ts) return
    setUnread(prev => ({ ...prev, [selected.slack_thread_ts!]: 0 }))
    loadMessages(selected.slack_thread_ts)
    const t = setInterval(() => loadMessages(selected.slack_thread_ts!, true), 8000)

    // SLA kaydı
    fetch('/api/sla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        telefon: selected.phone,
        slack_thread_ts: selected.slack_thread_ts,
        baslangic: new Date().toISOString(),
        ilk_yanit: new Date().toISOString(),
        yanit_suresi_dk: 1,
        durum: 'acik'
      })
    }).catch(() => {})

    return () => clearInterval(t)
  }, [selected])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (selected && sessions.length > 0) {
      const stillExists = sessions.find(s => s.phone === selected.phone)
      if (!stillExists) { setSelected(null); setMessages([]) }
    }
  }, [sessions, selected])

  async function sendMessage() {
    if (!reply.trim() || !selected?.slack_thread_ts) return
    setSending(true)
    const res = await fetch('/api/slack/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ thread_ts: selected.slack_thread_ts, text: reply }),
    })
    const data = await res.json()
    if (data.ok) {
      setReply('')
      await loadMessages(selected.slack_thread_ts)
    } else {
      alert('Mesaj gönderilemedi: ' + data.error)
    }
    setSending(false)
  }

  async function endLiveSupport(phone: string) {
    if (!confirm(`${phone} numaralı müşteriyi bot moduna döndürmek istiyor musunuz?`)) return

    // SLA kapanış kaydı
    if (selected?.slack_thread_ts) {
      const baslangic = new Date(Date.now() - 10 * 60 * 1000)
      const cozumDk = Math.max(1, Math.round((Date.now() - baslangic.getTime()) / 60000))
      fetch('/api/sla', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telefon: phone,
          slack_thread_ts: selected.slack_thread_ts,
          baslangic: baslangic.toISOString(),
          ilk_yanit: new Date().toISOString(),
          kapanis: new Date().toISOString(),
          yanit_suresi_dk: 1,
          cozum_suresi_dk: cozumDk,
          durum: 'kapali'
        })
      }).catch(() => {})
    }

    await supabase
      .from('wa_sessions_roberto')
      .update({ bulundugu_menu: 'gpt', slack_thread_ts: '', updated_at: new Date().toISOString() })
      .eq('phone', phone)
    setSelected(null)
    setMessages([])
    load()
  }

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sol panel */}
      <div className="w-80 border-r border-cream-200 flex flex-col bg-white shrink-0">
        <div className="p-6 border-b border-cream-100">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs uppercase tracking-[0.3em] text-ink-300">
              {sessions.length} aktif
              {totalUnread > 0 && <span className="ml-2 bg-ember-500 text-white text-[9px] px-1.5 py-0.5 rounded-full">{totalUnread}</span>}
            </p>
            <button
              onClick={notifOn ? () => setNotifOn(false) : requestNotif}
              className={`transition-colors ${notifOn ? 'text-moss-500' : 'text-ink-300 hover:text-ink-600'}`}
              title={notifOn ? 'Bildirimleri kapat' : 'Bildirimleri aç'}
            >
              {notifOn ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            </button>
          </div>
          <h1 className="font-display text-2xl text-ink-900">Canlı Destek</h1>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ember-500 animate-pulse" />
            <span className="text-[10px] font-mono text-ink-300">otomatik · 15s</span>
          </div>
          {!notifOn && (
            <button
              onClick={requestNotif}
              className="mt-3 w-full text-xs py-1.5 px-3 bg-cream-100 hover:bg-cream-200 text-ink-500 rounded-lg transition-colors"
            >
              🔔 Bildirimleri etkinleştir
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => (
                <div key={i} className="animate-pulse flex gap-3 p-2">
                  <div className="w-9 h-9 rounded-full bg-cream-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-cream-200 rounded w-3/4" />
                    <div className="h-2.5 bg-cream-100 rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center">
              <Headphones className="w-10 h-10 mx-auto text-cream-300 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-ink-400 font-medium">Kuyruk boş</p>
              <p className="text-xs text-ink-300 mt-1">Canlı destek talebi yok</p>
            </div>
          ) : (
            sessions.map((s) => {
              const waitMinutes = Math.floor((Date.now() - new Date(s.updated_at).getTime()) / 60000)
              const urgent = waitMinutes > 5
              const isSelected = selected?.phone === s.phone
              const sessionUnread = unread[s.slack_thread_ts || ''] || 0
              return (
                <button
                  key={s.phone}
                  onClick={() => setSelected(s)}
                  className={`w-full text-left p-4 border-b border-cream-100 hover:bg-cream-50 transition-colors flex items-center gap-3 ${isSelected ? 'bg-cream-100 border-l-2 border-l-moss-500' : ''}`}
                >
                  <div className="relative shrink-0">
                    <div className="w-9 h-9 rounded-full bg-moss-100 flex items-center justify-center">
                      <span className="text-xs font-medium text-moss-700">WA</span>
                    </div>
                    {sessionUnread > 0 && (
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-ember-500 text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                        {sessionUnread}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-ink-900 truncate">{s.phone}</div>
                    <div className="text-xs text-ink-400 truncate mt-0.5">{s.musteri_yazdigi || '—'}</div>
                    <div className={`text-[10px] font-mono mt-1 flex items-center gap-1 ${urgent ? 'text-ember-500' : 'text-ink-300'}`}>
                      <Clock className="w-2.5 h-2.5" />
                      {waitMinutes < 60 ? `${waitMinutes}dk` : `${Math.floor(waitMinutes/60)}sa`}
                      {urgent && <span className="px-1 py-0.5 bg-ember-100 text-ember-600 rounded text-[9px] font-medium">acil</span>}
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-ink-300 shrink-0" />
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Sağ panel */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          <div className="px-6 py-4 border-b border-cream-200 bg-white flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-moss-100 flex items-center justify-center">
                  <span className="text-xs font-medium text-moss-700">WA</span>
                </div>
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-moss-400 rounded-full border-2 border-white" />
              </div>
              <div>
                <div className="font-mono text-sm text-ink-900">{selected.phone}</div>
                <div className="text-xs text-ink-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-moss-400" />
                  Canlı destek aktif
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => loadMessages(selected.slack_thread_ts!)} className="w-8 h-8 rounded-lg hover:bg-cream-100 text-ink-300 hover:text-ink-700 transition-colors flex items-center justify-center">
                <RefreshCw className="w-4 h-4" />
              </button>
              <button onClick={() => endLiveSupport(selected.phone)} className="px-3 py-1.5 text-xs bg-ember-50 text-ember-600 border border-ember-200 rounded-lg hover:bg-ember-100 transition-colors font-medium flex items-center gap-1.5">
                <CheckCheck className="w-3.5 h-3.5" />
                Sohbeti Bitir
              </button>
              <button onClick={() => { setSelected(null); setMessages([]) }} className="w-8 h-8 rounded-lg hover:bg-cream-100 text-ink-300 transition-colors flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-cream-50">
            {msgLoading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => (
                  <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? 'flex-row-reverse' : ''}`}>
                    <div className="w-7 h-7 rounded-full bg-cream-200 animate-pulse shrink-0" />
                    <div className={`h-10 rounded-2xl animate-pulse ${i % 2 === 0 ? 'bg-ink-200 w-40' : 'bg-white w-52'}`} />
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 rounded-full bg-cream-200 flex items-center justify-center mx-auto mb-3">
                  <Headphones className="w-5 h-5 text-ink-300" strokeWidth={1.5} />
                </div>
                <p className="text-ink-400 text-sm">Henüz mesaj yok</p>
                <p className="text-ink-300 text-xs mt-1">Müşteri mesaj gönderdiğinde burada görünür</p>
              </div>
            ) : (
              messages.map((m) => {
                const isAdmin = m.username === 'roberto-admin'
                return (
                  <div key={m.ts} className={`flex items-end gap-2 ${isAdmin ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mb-1 ${isAdmin ? 'bg-ink-900 text-cream-50' : 'bg-moss-200 text-moss-800'}`}>
                      {isAdmin ? 'A' : 'M'}
                    </div>
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm leading-relaxed ${isAdmin ? 'bg-ink-900 text-cream-50 rounded-br-sm' : 'bg-white border border-cream-200 text-ink-800 rounded-bl-sm shadow-sm'}`}>
                      <p className="whitespace-pre-wrap">{parseSlackText(m.text)}</p>
                      <p className={`text-[10px] mt-1.5 font-mono ${isAdmin ? 'text-cream-400 text-right' : 'text-ink-300'}`}>
                        {new Date(parseFloat(m.ts) * 1000).toLocaleTimeString('tr', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-cream-200 bg-white shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-ink-900 flex items-center justify-center text-[10px] font-bold text-cream-50 shrink-0">A</div>
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Müşteriye yanıt yaz... (Enter ile gönder)"
                className="flex-1 px-4 py-3 bg-cream-50 border border-cream-200 rounded-xl text-sm text-ink-700 placeholder-ink-300 focus:outline-none focus:border-ink-400 transition-colors"
                disabled={sending}
              />
              <button onClick={sendMessage} disabled={sending || !reply.trim()} className="w-11 h-11 rounded-xl bg-ink-900 text-cream-50 flex items-center justify-center hover:bg-ink-700 transition-colors disabled:opacity-40 shrink-0">
                {sending ? <div className="w-4 h-4 border-2 border-cream-400 border-t-transparent rounded-full animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-ink-300 font-mono mt-2 ml-11">→ Slack thread → n8n → WhatsApp müşterisine iletilir</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-cream-50">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-white border border-cream-200 flex items-center justify-center mx-auto mb-4 shadow-sm">
              <Headphones className="w-7 h-7 text-ink-300" strokeWidth={1.5} />
            </div>
            <p className="text-ink-600 font-medium">Konuşma seç</p>
            <p className="text-ink-400 text-sm mt-1">Soldaki listeden bir müşteriyi seç</p>
          </div>
        </div>
      )}
    </div>
  )
}
