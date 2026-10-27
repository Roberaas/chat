'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase, Session } from '@/lib/supabase'
import TopBar from '@/components/TopBar'
import ConfirmModal from '@/components/ConfirmModal'
import { Headphones, Clock, X, Send, RefreshCw, CheckCheck, Bell, BellOff, ArrowLeft } from 'lucide-react'

type SlackMessage = { ts: string; text: string; user: string; is_bot: boolean; is_admin: boolean; username: string }

function parseSlackText(text: string): string {
  // Müşteri mesajı başlığını temizle: ":speech_balloon: *İsim* (tel)\n" → sadece mesaj
  text = text.replace(/^:speech_balloon:.*?\n/s, '')
  return text
    .replace(/:large_green_circle:/g, '🟢').replace(/:envelope_with_arrow:/g, '📩')
    .replace(/:wave:/g, '👋').replace(/:white_check_mark:/g, '✅').replace(/:x:/g, '❌')
    .replace(/:package:/g, '📦').replace(/:truck:/g, '🚚').replace(/:warning:/g, '⚠️')
    .replace(/\*([^*]+)\*/g, '$1').trim()
}
function isSystemMessage(m: SlackMessage, idx: number): boolean {
  if (idx === 0) return true
  const t = m.text || ''
  return t.includes('Yeni Canlı Destek') || t.includes('was added to') || t.includes('joined the channel') || (m.is_bot && !m.username && (t.includes('Müşteri:') || t.includes('Telefon:')))
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
  const [confirmPhone, setConfirmPhone] = useState<string | null>(null)
  const [sendError, setSendError] = useState('')
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
      body: JSON.stringify({ title, body, url: '/canli-destek', tag: `canli-destek-${Date.now()}` })
    }).catch(() => {})
  }

  const load = useCallback(async () => {
    const { data } = await supabase.from('wa_sessions_roberto').select('*').not('slack_thread_ts', 'is', null).neq('slack_thread_ts', '').order('updated_at', { ascending: false })
    const list = (data || []) as Session[]

    // human_handover: bildirim gönderilmemiş olanlar
    const handoverList = list.filter((s: any) => s.last_intent === 'human_handover' && !s.bildirim_gonderildi)
    for (const s of handoverList) {
      notify('🔔 Canlı Destek Talebi', `${(s as any).musteri_adi || s.phone} canlı destek istiyor`)
      await supabase.from('wa_sessions_roberto').update({ bildirim_gonderildi: true }).eq('phone', s.phone)
    }

    const newPhones = list.map(s => s.phone)
    if (newPhones.some(p => !prevSessionsRef.current.includes(p)) && prevSessionsRef.current.length > 0) notify('🔔 Yeni Talep', 'Yeni bir müşteri canlı desteğe bağlandı')
    prevSessionsRef.current = newPhones
    setSessions(list); setLoading(false)
  }, [notifOn])

  useEffect(() => { load(); const t = setInterval(load, 15000); return () => clearInterval(t) }, [load])

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
        if (newMsgs.length > 0) { notify('💬 Yeni Mesaj', newMsgs[newMsgs.length - 1].text.slice(0, 60)); setUnread(u => ({ ...u, [thread_ts]: (u[thread_ts] || 0) + newMsgs.length })) }
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
    setSending(true); setSendError('')
    const res = await fetch('/api/slack/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ thread_ts: selected.slack_thread_ts, text: reply, phone: selected.phone, channel_id: (selected as any).channel_id || '' }) })
    const data = await res.json()
    if (data.ok) { setReply(''); await loadMessages(selected.slack_thread_ts) } else setSendError('Gönderilemedi: ' + (data.error || 'bilinmeyen hata'))
    setSending(false)
  }

  async function endLiveSupport(phone: string) {
    await supabase.from('wa_sessions_roberto').update({ bulundugu_menu: 'bot', slack_thread_ts: '', updated_at: new Date().toISOString() }).eq('phone', phone)
    setConfirmPhone(null); setSelected(null); setMessages([]); load()
  }

  const totalUnread = Object.values(unread).reduce((a, b) => a + b, 0)

  return (
    <>
      <style>{`
        .cd{display:flex;height:calc(100vh - 54px);overflow:hidden}
        .cd-list{width:300px;flex-shrink:0;background:var(--s1);border-right:1px solid var(--bdr);display:flex;flex-direction:column}
        .cd-panel{flex:1;display:flex;flex-direction:column;min-width:0}
        .cd-back{display:none}
        @media(max-width:768px){
          .cd-list{width:100%}
          .cd.has-sel .cd-list{display:none}
          .cd:not(.has-sel) .cd-panel{display:none}
          .cd-back{display:flex}
        }
      `}</style>

      <TopBar title="Canlı Destek" subtitle={`${sessions.length} aktif`} />

      <div className={`cd${selected ? ' has-sel' : ''}`}>
        {/* Liste */}
        <div className="cd-list">
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--bdr)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span className="anim-pulse" style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--red)', display: 'inline-block' }} />
                <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>otomatik · 15sn</span>
                {totalUnread > 0 && <span className="badge badge-red" style={{ padding: '1px 7px' }}>{totalUnread} yeni</span>}
              </div>
              <button onClick={notifOn ? () => setNotifOn(false) : requestNotif} title="Bildirimler" style={{ background: 'none', border: 'none', color: notifOn ? 'var(--ac)' : 'var(--tx3)' }}>
                {notifOn ? <Bell size={15} /> : <BellOff size={15} />}
              </button>
            </div>
            {!notifOn && (
              <button className="btn-ghost" onClick={requestNotif} style={{ marginTop: 10, width: '100%', justifyContent: 'center', fontSize: 12 }}>
                <Bell size={12} /> Bildirimleri etkinleştir
              </button>
            )}
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[1, 2, 3].map(i => <div key={i} className="anim-pulse" style={{ height: 68, background: 'var(--s2)', borderRadius: 10 }} />)}
              </div>
            ) : sessions.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <Headphones size={30} style={{ color: 'var(--tx3)', opacity: .5, margin: '0 auto 12px', display: 'block' }} strokeWidth={1.3} />
                <p style={{ fontSize: 13, color: 'var(--tx2)' }}>Kuyruk boş</p>
                <p style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 4 }}>Canlı destek talebi yok</p>
              </div>
            ) : sessions.map(s => {
              const waitMin = Math.floor((Date.now() - new Date(s.updated_at).getTime()) / 60000)
              const urgent = waitMin > 5
              const isSel = selected?.phone === s.phone
              const su = unread[s.slack_thread_ts || ''] || 0
              return (
                <button key={s.phone} onClick={() => setSelected(s)} style={{ width: '100%', textAlign: 'left', padding: '12px 14px', borderBottom: '1px solid var(--bdr)', borderLeft: `2.5px solid ${isSel ? 'var(--ac)' : 'transparent'}`, background: isSel ? 'var(--ac2)' : 'transparent', display: 'flex', alignItems: 'center', gap: 11, cursor: 'pointer', color: 'var(--tx)' }}>
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div className="sb-av" style={{ width: 36, height: 36, fontSize: 10 }}>WA</div>
                    {su > 0 && <span style={{ position: 'absolute', top: -3, right: -3, minWidth: 16, height: 16, background: 'var(--red)', color: '#fff', fontSize: 9, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, padding: '0 3px' }}>{su}</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(s as any).musteri_adi || s.phone}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 2 }}>{s.musteri_yazdigi || '—'}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 4 }}>
                      <Clock size={10} style={{ color: urgent ? 'var(--red)' : 'var(--tx3)' }} />
                      <span style={{ fontSize: 10.5, color: urgent ? 'var(--red)' : 'var(--tx3)' }}>{waitMin < 60 ? `${waitMin}dk` : `${Math.floor(waitMin / 60)}sa`}</span>
                      {urgent && <span className="badge badge-red" style={{ padding: '0 5px', fontSize: 9.5 }}>acil</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Sohbet */}
        <div className="cd-panel" style={{ background: 'var(--bg)' }}>
          {selected ? (
            <>
              <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--bdr)', background: 'var(--s1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
                  <button className="btn-ghost cd-back" onClick={() => { setSelected(null); setMessages([]) }} style={{ padding: 7 }}><ArrowLeft size={14} /></button>
                  <div style={{ position: 'relative' }}>
                    <div className="sb-av" style={{ width: 36, height: 36, fontSize: 10 }}>WA</div>
                    <span style={{ position: 'absolute', bottom: 0, right: 0, width: 9, height: 9, background: 'var(--green)', borderRadius: '50%', border: '2px solid var(--s1)' }} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{selected.phone}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--tx3)', marginTop: 1 }}>Canlı destek aktif</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button className="btn-ghost" onClick={() => loadMessages(selected.slack_thread_ts!)} title="Yenile" style={{ padding: 8 }}><RefreshCw size={13} /></button>
                  <button className="btn-danger" onClick={() => setConfirmPhone(selected.phone)}><CheckCheck size={13} /> Sohbeti Bitir</button>
                  <button className="btn-ghost" onClick={() => { setSelected(null); setMessages([]) }} style={{ padding: 8 }}><X size={13} /></button>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', padding: 22, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {msgLoading ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {[1, 2, 3].map(i => <div key={i} className="anim-pulse" style={{ height: 46, background: 'var(--s1)', borderRadius: 12, width: i % 2 === 0 ? 200 : 260, alignSelf: i % 2 === 0 ? 'flex-end' : 'flex-start' }} />)}
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                    <Headphones size={26} style={{ color: 'var(--tx3)', opacity: .5 }} strokeWidth={1.3} />
                    <p style={{ color: 'var(--tx2)', fontSize: 13 }}>Henüz mesaj yok</p>
                    <p style={{ color: 'var(--tx3)', fontSize: 11.5 }}>Müşteri mesaj gönderdiğinde burada görünür</p>
                  </div>
                ) : messages.map(m => {
                  const isAdmin = m.is_admin
                  const metin = parseSlackText(m.text)
                  if (!metin) return null
                  const saat = new Date(parseFloat(m.ts) * 1000).toLocaleTimeString('tr', { hour: '2-digit', minute: '2-digit' })
                  return (
                    <div key={m.ts} style={{ display: 'flex', flexDirection: 'column', alignItems: isAdmin ? 'flex-end' : 'flex-start', gap: 3 }}>
                      <span style={{ fontSize: 10.5, color: 'var(--tx3)' }}>{isAdmin ? 'Temsilci' : 'Müşteri'}</span>
                      <div style={{
                        maxWidth: 'min(420px, 85%)', padding: '10px 14px', fontSize: 13, lineHeight: 1.55,
                        borderRadius: isAdmin ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                        background: isAdmin ? 'var(--ac)' : 'var(--s1)',
                        border: isAdmin ? 'none' : '1px solid var(--bdr)',
                        color: isAdmin ? '#fff' : 'var(--tx)',
                      }}>
                        <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{metin}</p>
                        <p style={{ fontSize: 10, margin: '5px 0 0', opacity: .6, textAlign: isAdmin ? 'right' : 'left' }}>{saat}</p>
                      </div>
                    </div>
                  )
                })}
                <div ref={messagesEndRef} />
              </div>

              <div style={{ padding: '14px 20px', borderTop: '1px solid var(--bdr)', background: 'var(--s1)', flexShrink: 0 }}>
                {sendError && <div className="toast toast-err" style={{ margin: '0 0 10px' }}>{sendError}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <input
                    className="inp" value={reply} onChange={e => setReply(e.target.value)} disabled={sending}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
                    placeholder="Müşteriye yanıt yaz... (Enter)" style={{ flex: 1 }}
                  />
                  <button className="btn" onClick={sendMessage} disabled={sending || !reply.trim()} style={{ width: 42, height: 42, justifyContent: 'center', padding: 0 }}>
                    {sending ? <div style={{ width: 14, height: 14, border: '2px solid rgba(255,255,255,.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin .6s linear infinite' }} /> : <Send size={15} />}
                  </button>
                </div>
                <p style={{ fontSize: 10.5, color: 'var(--tx3)', marginTop: 8 }}>Panel → Slack thread → n8n → WhatsApp</p>
              </div>
            </>
          ) : (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ width: 60, height: 60, borderRadius: 16, background: 'var(--s1)', border: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <Headphones size={26} style={{ color: 'var(--tx3)' }} strokeWidth={1.3} />
                </div>
                <p style={{ color: 'var(--tx)', fontSize: 14, fontWeight: 600 }}>Konuşma seç</p>
                <p style={{ color: 'var(--tx3)', fontSize: 12.5, marginTop: 5 }}>Soldaki listeden bir müşteriyi seç</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!confirmPhone}
        danger={false}
        title="Sohbeti bitir"
        message={`${confirmPhone} numaralı müşteri bot moduna döndürülsün mü?`}
        confirmText="Evet, bota döndür"
        onConfirm={() => confirmPhone && endLiveSupport(confirmPhone)}
        onCancel={() => setConfirmPhone(null)}
      />
    </>
  )
}
