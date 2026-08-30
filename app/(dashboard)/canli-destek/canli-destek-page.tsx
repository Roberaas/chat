'use client'

import { useEffect, useState, useRef } from 'react'
import { supabase, Session } from '@/lib/supabase'
import { Headphones, Clock, X, Send, RefreshCw, ChevronRight } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

type SlackMessage = {
  ts: string
  text: string
  user: string
  is_bot: boolean
  is_admin: boolean
  bot_id?: string
  subtype?: string
  username?: string
}

// Slack emoji kodlarını unicode'a çevir
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
    .replace(/\*([^*]+)\*/g, '$1') // bold *text* → text
}

// Sistem mesajlarını filtrele
function isSystemMessage(m: SlackMessage): boolean {
  const text = m.text || ''
  return (
    text.includes('Yeni Canlı Destek Talebi') ||
    text.includes('Müşteri:') ||
    text.includes('Telefon:') ||
    text.includes('olamazsın') ||
    m.subtype === 'bot_message' && text.includes('Mesaj:')
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
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (selected?.slack_thread_ts) {
      loadMessages(selected.slack_thread_ts)
      const t = setInterval(() => loadMessages(selected.slack_thread_ts!), 10000)
      return () => clearInterval(t)
    }
  }, [selected])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function load() {
    const { data } = await supabase
      .from('wa_sessions_roberto')
      .select('*')
      .not('slack_thread_ts', 'is', null)
      .neq('slack_thread_ts', '')
      .order('updated_at', { ascending: false })
    setSessions((data || []) as Session[])
    setLoading(false)
  }

  async function loadMessages(thread_ts: string) {
    setMsgLoading(true)
    const res = await fetch(`/api/slack/messages?thread_ts=${thread_ts}`)
    const data = await res.json()
    // Sistem mesajlarını filtrele, ilk mesajı (canlı destek bildirimi) atla
    const filtered = (data.messages || [])
      .slice(1) // ilk mesaj her zaman sistem bildirimi
      .filter((m: SlackMessage) => !isSystemMessage(m))
    setMessages(filtered)
    setMsgLoading(false)
  }

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
    await supabase
      .from('wa_sessions_roberto')
      .update({ bulundugu_menu: 'gpt', updated_at: new Date().toISOString() })
      .eq('phone', phone)
    setSelected(null)
    load()
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Sol panel */}
      <div className="w-80 border-r border-gold-subtle flex flex-col bg-obsidian-3 shrink-0">
        <div className="p-6 border-b border-stone/20">
          <p className="text-xs uppercase tracking-[0.3em] text-stone mb-1">{sessions.length} aktif</p>
          <h1 className="font-display text-2xl text-cream">Canlı Destek</h1>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 rounded-full bg-ruby/100 animate-pulse" />
            <span className="text-[10px] font-mono text-stone">otomatik · 15s</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-6 text-stone font-mono text-sm">yükleniyor...</div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center">
              <Headphones className="w-8 h-8 mx-auto text-cream-300 mb-2" strokeWidth={1.5} />
              <p className="text-sm text-stone-light">Kuyruk boş</p>
            </div>
          ) : (
            sessions.map((s) => {
              const waitMinutes = Math.floor((Date.now() - new Date(s.updated_at).getTime()) / 60000)
              const urgent = waitMinutes > 5
              const isSelected = selected?.phone === s.phone
              return (
                <button
                  key={s.phone}
                  onClick={() => setSelected(s)}
                  className={`w-full text-left p-4 border-b border-stone/20 hover:bg-transparent transition-colors flex items-center gap-3 ${isSelected ? 'bg-obsidian-4' : ''}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm text-cream truncate">{s.phone}</div>
                    <div className="text-xs text-stone-light truncate mt-0.5">{s.musteri_yazdigi || '—'}</div>
                    <div className={`text-[10px] font-mono mt-1 ${urgent ? 'text-ruby-light' : 'text-stone'}`}>
                      <Clock className="w-2.5 h-2.5 inline mr-1" />{waitMinutes}dk{urgent && ' · acil'}
                    </div>
                  </div>
                  <ChevronRight className="w-3 h-3 text-stone shrink-0" />
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Sağ panel */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gold-subtle bg-obsidian-3 flex items-center justify-between shrink-0">
            <div>
              <div className="font-mono text-cream">{selected.phone}</div>
              <div className="text-xs text-stone-light mt-0.5">
                {selected.musteri_yazdigi && `"${selected.musteri_yazdigi}"`}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => loadMessages(selected.slack_thread_ts!)}
                className="w-8 h-8 rounded-lg hover:bg-obsidian-4 text-stone hover:text-cream-dim transition-colors flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => endLiveSupport(selected.phone)}
                className="px-3 py-1.5 text-xs bg-ruby/10 text-ruby-light border border-ember-200 rounded-lg hover:bg-ruby/10 transition-colors"
              >
                Bot'a devret
              </button>
              <button
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg hover:bg-obsidian-4 text-stone transition-colors flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Mesajlar */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3 bg-transparent">
            {msgLoading && messages.length === 0 ? (
              <div className="text-center text-stone font-mono text-sm py-8">yükleniyor...</div>
            ) : messages.length === 0 ? (
              <div className="text-center text-stone font-mono text-sm py-8">henüz mesaj yok</div>
            ) : (
              messages.map((m) => {
                // is_admin true ise admin yazmış, değilse müşteriden gelen bot mesajı
                const isCustomer = !m.is_admin
                return (
                  <div key={m.ts} className={`flex ${isCustomer ? 'justify-start' : 'justify-end'}`}>
                    {isCustomer && (
                      <div className="w-6 h-6 rounded-full bg-obsidian-4 text-gold text-[10px] flex items-center justify-center font-medium mr-2 mt-1 shrink-0">
                        M
                      </div>
                    )}
                    <div className={`max-w-sm px-4 py-2.5 rounded-xl text-sm leading-relaxed ${
                      isCustomer
                        ? 'bg-obsidian-3 border border-gold-subtle text-cream-dim rounded-tl-sm'
                        : 'bg-ink-900 text-cream-50 rounded-tr-sm'
                    }`}>
                      {parseSlackText(m.text)}
                      <div className={`text-[10px] mt-1 font-mono ${isCustomer ? 'text-stone' : 'text-cream-400'}`}>
                        {new Date(parseFloat(m.ts) * 1000).toLocaleTimeString('tr', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Mesaj gönder */}
          <div className="p-4 border-t border-gold-subtle bg-obsidian-3 shrink-0">
            <div className="flex items-center gap-3">
              <input
                type="text"
                value={reply}
                onChange={(e) => setReply(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Müşteriye yanıt yaz... (Enter ile gönder)"
                className="flex-1 px-4 py-3 bg-transparent border border-gold-subtle rounded-xl text-sm text-cream-dim placeholder-ink-300 focus:outline-none focus:border-gold-dim transition-colors"
              />
              <button
                onClick={sendMessage}
                disabled={sending || !reply.trim()}
                className="w-11 h-11 rounded-xl bg-ink-900 text-cream-50 flex items-center justify-center hover:bg-stone transition-colors disabled:opacity-40"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[10px] text-stone font-mono mt-2 ml-1">→ Slack thread → n8n → WhatsApp</p>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center bg-transparent">
          <div className="text-center">
            <Headphones className="w-12 h-12 mx-auto text-cream-300 mb-3" strokeWidth={1.5} />
            <p className="text-stone-light text-sm">Soldaki listeden bir konuşma seç</p>
          </div>
        </div>
      )}
    </div>
  )
}
