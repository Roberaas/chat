'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase, Session } from '@/lib/supabase'
import { Headphones, Clock, X, Send, RefreshCw, CheckCheck, Bell, BellOff } from 'lucide-react'

type SlackMessage = { ts: string; text: string; user: string; is_bot: boolean; is_admin: boolean; username: string }

function parseSlackText(text: string): string {
  // Müşteri mesajı başlığını temizle: ":speech_balloon: *İsim* (tel)\n" → sadece mesaj
  text = text.replace(/^:speech_balloon:.*?\n/s, '')
  return text
    .replace(/:large_green_circle:/g,'🟢').replace(/:envelope_with_arrow:/g,'📩')
    .replace(/:wave:/g,'👋').replace(/:white_check_mark:/g,'✅').replace(/:x:/g,'❌')
    .replace(/:package:/g,'📦').replace(/:truck:/g,'🚚').replace(/:warning:/g,'⚠️')
    .replace(/\*([^*]+)\*/g,'$1').trim()
}
function isSystemMessage(m: SlackMessage, idx: number): boolean {
  if (idx === 0) return true
  const t = m.text || ''
  return t.includes('Yeni Canlı Destek') || t.includes('was added to') || t.includes('joined the channel') || (m.is_bot && !m.username && (t.includes('Müşteri:') || t.includes('Telefon:')))
}

const P = {
  sidebar: { width: 280, background: '#120F0C', borderRight: '1px solid rgba(201,168,76,0.1)', display: 'flex', flexDirection: 'column' as const, flexShrink: 0 },
  sideHeader: { padding: '20px 20px 16px', borderBottom: '1px solid rgba(201,168,76,0.08)' },
  msgBubbleAdmin: { maxWidth: 320, padding: '12px 16px', borderRadius: '16px 16px 4px 16px', background: 'linear-gradient(135deg, #C9A84C, #8B6914)', color: '#0E0C0A', fontSize: 13, lineHeight: 1.5 },
  msgBubbleClient: { maxWidth: 320, padding: '12px 16px', borderRadius: '16px 16px 16px 4px', background: '#211E18', border: '1px solid rgba(201,168,76,0.1)', color: '#B8B0A0', fontSize: 13, lineHeight: 1.5 },
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

  async function requestNotif() {
    if (!('Notification' in window)) return
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return
    setNotifOn(true)
    try {
      if (!('serviceWorker' in navigator)) return
      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const existing = await reg.pushManager.getSubscription()
      if (existing) return
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: 'BK_8RwwHc67ARkhbheF3XoFgTrB4dpJU_9shn1h-awpesvM-fMJgUaXzR1SmHieqxFhLHnLOX1i3fs6-4XhcPRo'
      })
      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: sub })
      })
    } catch (e) { console.error('Push subscribe hatası:', e) }
  }

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') setNotifOn(true)
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3')
    audio.volume = 0.5; audioRef.current = audio
  }, [])

  function notify(title: string, body: string) {
    if (notifOn && Notification.permission === 'granted') new Notification(title, { body, icon: '/favicon.ico' })
    if (audioRef.current) { audioRef.current.currentTime = 0; audioRef.current.play().catch(() => {}) }
    fetch('/api/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, body, url: '/dashboard/canli-destek', tag: `canli-destek-${Date.now()}` })
    }).catch(() => {})
    fetch('/api/sms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mesaj: `${title}: ${body} - chat.robertobravo.com` })
    }).catch(() => {})
  }

  const load = useCallback(async () => {
    const { data } = await supabase.from('wa_sessions_roberto').select('*').not('slack_thread_ts','is',null).neq('slack_thread_ts','').order('updated_at', { ascending: false })
    const list = (data || []) as Session[]

    // human_handover: bildirim gönderilmemiş olanlar
    const handoverList = list.filter((s: any) => s.last_intent === 'human_handover' && !s.bildirim_gonderildi)
    for (const s of handoverList) {
      notify('🔔 Canlı Destek Talebi', `${(s as any).musteri_adi || s.phone} canlı destek istiyor`)
      await supabase.from('wa_sessions_roberto').update({ bildirim_gonderildi: true }).eq('phone', s.phone)
    }

    const newPhones = list.map(s => s.phone)
    if (newPhones.some(p => !prevSessionsRef.current.includes(p)) && prevSessionsRef.current.length > 0) notify('🔔 Yeni Talep','Yeni bir müşteri canlı desteğe bağlandı')
    prevSessionsRef.current = newPhones
    setSessions(list); setLoading(false)
  }, [notifOn])

  useEffect(() => { load(); const t = setInterval(load,15000); return () => clearInterval(t) }, [load])

  const loadMessages = useCallback(async (thread_ts: string, silent = false, channel_id?: string) => {
    if (!silent) setMsgLoading(true)
    const ch = channel_id || (selected as any)?.channel_id || ''
    const res = await fetch(`/api/slack/messages?thread_ts=${thread_ts}${ch ? '&channel_id=' + ch : ''}`)
    const data = await res.json()
    const filtered = (data.messages || []).filter((m: SlackMessage, i: number) => !isSystemMessage(m, i))
    const lastTs = filtered.length > 0 ? filtered[filtered.length - 1].ts : null
    setLastMsgTs(prev => {
      const prevTs = prev[thread_ts]
      if (lastTs && prevTs && lastTs !== prevTs) {
        const newMsgs = filtered.filter((m: SlackMessage) => m.ts > prevTs && !m.is_admin)
        if (newMsgs.length > 0) { notify('💬 Yeni Mesaj', newMsgs[newMsgs.length-1].text.slice(0,60)); setUnread(u => ({ ...u, [thread_ts]: (u[thread_ts]||0)+newMsgs.length })) }
      }
      return lastTs ? { ...prev, [thread_ts]: lastTs } : prev
    })
    setMessages(filtered); if (!silent) setMsgLoading(false)
  }, [notifOn])

  useEffect(() => {
    if (!selected?.slack_thread_ts) return
    setUnread(prev => ({ ...prev, [selected.slack_thread_ts!]: 0 }))
    loadMessages(selected.slack_thread_ts)
    const t = setInterval(() => loadMessages(selected.slack_thread_ts!, true), 8000)
    return () => clearInterval(t)
  }, [selected?.slack_thread_ts])

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { if (selected && sessions.length > 0 && !sessions.find(s => s.phone === selected.phone)) { setSelected(null); setMessages([]) } }, [sessions, selected])

  async function sendMessage() {
    if (!reply.trim() || !selected?.slack_thread_ts) return
    setSending(true)
    const res = await fetch('/api/slack/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thread_ts: selected.slack_thread_ts, text: reply, phone: selected.phone, channel_id: (selected as any).channel_id || '' }) })
    const data = await res.json()
    if (data.ok) { setReply(''); await loadMessages(selected.slack_thread_ts) } else alert('Hata: ' + data.error)
    setSending(false)
  }

  async function endLiveSupport(phone: string) {
    if (!confirm(`${phone} numaralı müşteriyi bot moduna döndür?`)) return
    await supabase.from('wa_sessions_roberto').update({ bulundugu_menu: 'bot', slack_thread_ts: '', updated_at: new Date().toISOString() }).eq('phone', phone)
    setSelected(null); setMessages([]); load()
  }

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      {/* Sidebar */}
      <div style={P.sidebar}>
        <div style={P.sideHeader}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <p style={{ fontSize: 9, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#5A5550', fontFamily: 'JetBrains Mono, monospace' }}>
              {sessions.length} aktif
              {totalUnread > 0 && <span style={{ marginLeft: 8, background: '#8B2635', color: '#fff', fontSize: 9, padding: '1px 5px', borderRadius: 8 }}>{totalUnread}</span>}
            </p>
            <button onClick={notifOn ? () => setNotifOn(false) : requestNotif} style={{ background: 'none', border: 'none', cursor: 'pointer', color: notifOn ? '#C9A84C' : '#5A5550' }}>
              {notifOn ? <Bell size={14} /> : <BellOff size={14} />}
            </button>
          </div>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 24, fontWeight: 400, color: '#EDE8DF' }}>Canlı Destek</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C4364A', display: 'inline-block', animation: 'urgentPulse 1.5s infinite' }} />
            <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: '#5A5550' }}>otomatik · 15s</span>
          </div>
          {!notifOn && (
            <button onClick={requestNotif} style={{ marginTop: 10, width: '100%', padding: '7px 0', background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.12)', borderRadius: 8, fontSize: 11, color: '#7A7468', cursor: 'pointer' }}>
              🔔 Bildirimleri etkinleştir
            </button>
          )}
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1,2,3].map(i => <div key={i} style={{ height: 72, background: '#211E18', borderRadius: 8 }} />)}
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <Headphones size={32} color="#4A4540" strokeWidth={1} style={{ margin: '0 auto 12px' }} />
              <p style={{ fontSize: 13, color: '#5A5550' }}>Kuyruk boş</p>
              <p style={{ fontSize: 11, color: '#4A4540', marginTop: 4, fontFamily: 'JetBrains Mono, monospace' }}>Canlı destek talebi yok</p>
            </div>
          ) : sessions.map(s => {
            const waitMin = Math.floor((Date.now() - new Date(s.updated_at).getTime()) / 60000)
            const urgent = waitMin > 5
            const isSelected = selected?.phone === s.phone
            const sessionUnread = unread[s.slack_thread_ts || ''] || 0
            return (
              <button key={s.phone} onClick={() => setSelected(s)} style={{ width: '100%', textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid rgba(201,168,76,0.05)', background: isSelected ? 'rgba(201,168,76,0.06)' : 'transparent', borderLeft: isSelected ? '2px solid #C9A84C' : '2px solid transparent', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 12, transition: 'background 0.15s' }}>
                <div style={{ position: 'relative', flexShrink: 0 }}>
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#C9A84C' }}>WA</div>
                  {sessionUnread > 0 && <span style={{ position: 'absolute', top: -2, right: -2, width: 16, height: 16, background: '#8B2635', color: '#fff', fontSize: 9, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}>{sessionUnread}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12, color: '#B8B0A0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.phone}</div>
                  <div style={{ fontSize: 11, color: '#5A5550', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 3 }}>{s.musteri_yazdigi || '—'}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                    <Clock size={9} color={urgent ? '#C4364A' : '#5A5550'} />
                    <span style={{ fontSize: 10, fontFamily: 'JetBrains Mono, monospace', color: urgent ? '#C4364A' : '#5A5550' }}>{waitMin < 60 ? `${waitMin}dk` : `${Math.floor(waitMin/60)}sa`}</span>
                    {urgent && <span style={{ fontSize: 9, padding: '1px 5px', background: 'rgba(139,38,53,0.2)', color: '#C4364A', borderRadius: 4 }}>acil</span>}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Sağ panel */}
      {selected ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {/* Header */}
          <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(201,168,76,0.08)', background: '#120F0C', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ position: 'relative' }}>
                <div style={{ width: 38, height: 38, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#C9A84C', fontWeight: 600 }}>WA</div>
                <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, background: '#C9A84C', borderRadius: '50%', border: '2px solid #120F0C' }} />
              </div>
              <div>
                <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: '#B8B0A0' }}>{selected.phone}</div>
                <div style={{ fontSize: 11, color: '#5A5550', marginTop: 2 }}>Canlı destek aktif</div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => loadMessages(selected.slack_thread_ts!)} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#211E18', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8, color: '#7A7468', cursor: 'pointer' }}>
                <RefreshCw size={13} />
              </button>
              <button onClick={() => endLiveSupport(selected.phone)} style={{ padding: '7px 14px', background: 'rgba(139,38,53,0.15)', border: '1px solid rgba(139,38,53,0.3)', borderRadius: 8, color: '#C4364A', fontSize: 12, fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                <CheckCheck size={13} /> Sohbeti Bitir
              </button>
              <button onClick={() => { setSelected(null); setMessages([]) }} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#211E18', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8, color: '#7A7468', cursor: 'pointer' }}>
                <X size={13} />
              </button>
            </div>
          </div>

          {/* Mesajlar */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px', display: 'flex', flexDirection: 'column', gap: 16, background: '#0E0C0A' }}>
            {msgLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {[1,2,3].map(i => <div key={i} style={{ height: 48, background: '#1A1712', borderRadius: 12, width: i % 2 === 0 ? 200 : 260, alignSelf: i % 2 === 0 ? 'flex-end' : 'flex-start' }} />)}
              </div>
            ) : messages.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div style={{ width: 56, height: 56, borderRadius: 16, background: '#1A1712', border: '1px solid rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Headphones size={24} color="#4A4540" strokeWidth={1} />
                </div>
                <p style={{ color: '#5A5550', fontSize: 13 }}>Henüz mesaj yok</p>
                <p style={{ color: '#4A4540', fontSize: 11, fontFamily: 'JetBrains Mono, monospace' }}>Müşteri mesaj gönderdiğinde burada görünür</p>
              </div>
            ) : messages.map(m => {
              // is_bot:true → admin (bot token ile panelden), is_bot:false → müşteri
              const isAdmin = m.is_admin
              const metin = parseSlackText(m.text)
              if (!metin) return null
              const saat = new Date(parseFloat(m.ts) * 1000).toLocaleTimeString('tr', { hour: '2-digit', minute: '2-digit' })
              return (
                <div key={m.ts} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start', gap: 3 }}>
                  <span style={{ fontSize: 10, color: '#5A5550', fontFamily: 'JetBrains Mono, monospace', paddingLeft: isAdmin ? 0 : 36, paddingRight: isAdmin ? 36 : 0 }}>
                    {isAdmin ? 'Temsilci' : 'Müşteri'}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: isAdmin ? 'row-reverse' : 'row' }}>
                    <div style={{ width: 28, height: 28, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, flexShrink: 0, background: isAdmin ? 'linear-gradient(135deg,#C9A84C,#8B6914)' : '#2E2B25', color: isAdmin ? '#0E0C0A' : '#9A928A', border: isAdmin ? 'none' : '1px solid rgba(201,168,76,0.15)' }}>
                      {isAdmin ? 'T' : 'M'}
                    </div>
                    <div style={isAdmin ? {
                      maxWidth: 340, padding: '11px 15px', borderRadius: '16px 16px 4px 16px',
                      background: 'linear-gradient(135deg, #C9A84C, #A8882A)', color: '#0E0C0A', fontSize: 13, lineHeight: 1.55
                    } : {
                      maxWidth: 340, padding: '11px 15px', borderRadius: '16px 16px 16px 4px',
                      background: '#1A1712', border: '1px solid rgba(201,168,76,0.15)', color: '#EDE8DF', fontSize: 13, lineHeight: 1.55
                    }}>
                      <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{metin}</p>
                      <p style={{ fontSize: 10, marginTop: 5, fontFamily: 'JetBrains Mono, monospace', opacity: 0.55, textAlign: isAdmin ? 'right' : 'left', margin: '5px 0 0' }}>{saat}</p>
                    </div>
                  </div>
                </div>
              )
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(201,168,76,0.08)', background: '#120F0C', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'linear-gradient(135deg,#C9A84C,#8B6914)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#0E0C0A', flexShrink: 0 }}>A</div>
              <input
                type="text" value={reply} onChange={e => setReply(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                placeholder="Müşteriye yanıt yaz... (Enter)"
                className="input-premium" disabled={sending}
                style={{ flex: 1, padding: '11px 16px', fontSize: 13 }}
              />
              <button onClick={sendMessage} disabled={sending || !reply.trim()} className="btn-gold" style={{ width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 10, flexShrink: 0 }}>
                {sending ? <div style={{ width: 14, height: 14, border: '2px solid rgba(0,0,0,0.3)', borderTopColor: '#0E0C0A', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> : <Send size={15} />}
              </button>
            </div>
            <p style={{ fontSize: 10, color: '#4A4540', fontFamily: 'JetBrains Mono, monospace', marginTop: 8, marginLeft: 42 }}>→ Slack thread → n8n → WhatsApp</p>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0E0C0A' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ width: 64, height: 64, borderRadius: 16, background: '#1A1712', border: '1px solid rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <Headphones size={28} color="#4A4540" strokeWidth={1} />
            </div>
            <p style={{ color: '#7A7468', fontSize: 14 }}>Konuşma seç</p>
            <p style={{ color: '#5A5550', fontSize: 12, marginTop: 6, fontFamily: 'JetBrains Mono, monospace' }}>Soldaki listeden bir müşteriyi seç</p>
          </div>
        </div>
      )}
    </div>
  )
}
