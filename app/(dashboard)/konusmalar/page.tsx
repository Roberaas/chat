'use client'

import { useEffect, useState } from 'react'
import { supabase, Session } from '@/lib/supabase'
import { Search, X, MessageSquare, StickyNote, Trash2, Plus, ShoppingCart } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

const INTENT_LABEL: Record<string, string> = {
  greeting: 'Selamlama', products: 'Ürün Listesi', product_detail: 'Ürün Detay',
  order_status: 'Sipariş Durumu', order_create: 'Sipariş Oluştur', subscription: 'Abonelik',
  human_handover: 'Canlı Destek', complaint: 'Şikayet', brand_info: 'Marka Bilgi',
  usage_question: 'Kullanım Sorusu', menu: 'Menü', smalltalk: 'Sohbet', other: 'Diğer',
  shipping: 'Kargo', canli_devam: 'Canlı Devam',
}
type FilterType = 'all' | 'canli' | 'gpt' | 'kvkk' | 'sepet'
type Not = { id: number; icerik: string; created_at: string }

const S = {
  page: { padding: '32px 28px', maxWidth: 1280, margin: '0 auto' },
  card: { background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 12, overflow: 'hidden' as const },
  th: { padding: '12px 18px', textAlign: 'left' as const, fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase' as const, color: '#5A5550', fontWeight: 500, background: 'rgba(201,168,76,0.03)' },
  td: { padding: '14px 18px', fontSize: 12, borderTop: '1px solid rgba(201,168,76,0.05)' },
}

export default function KonusmalarPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Session | null>(null)
  const [notlar, setNotlar] = useState<Not[]>([])
  const [yeniNot, setYeniNot] = useState('')
  const [notEkleniyor, setNotEkleniyor] = useState(false)
  const [etiketler, setEtiketler] = useState<{id:number;etiket:string;renk:string}[]>([])

  useEffect(() => { load() }, [filter])
  useEffect(() => { if (selected) loadNotlar(selected.phone); else setNotlar([]) }, [selected])

  async function load() {
    setLoading(true)
    let q = supabase.from('wa_sessions_roberto').select('*').order('updated_at', { ascending: false }).limit(500)
    if (filter === 'canli') q = q.eq('bulundugu_menu', 'canli')
    else if (filter === 'gpt') q = q.eq('bulundugu_menu', 'bot')
    else if (filter === 'kvkk') q = q.eq('kvkk_onay', false)
    const { data } = await q
    let list = (data || []) as Session[]
    if (filter === 'sepet') list = list.filter(s => s.pending_action && String(s.pending_action).includes('order:'))
    setSessions(list); setLoading(false)
  }

  async function loadNotlar(telefon: string) {
    const [notRes, etiketRes] = await Promise.all([
      fetch(`/api/musteri-notu?telefon=${telefon}`).then(r => r.json()),
      fetch(`/api/etiket?telefon=${telefon}`).then(r => r.json()),
    ])
    setNotlar(notRes.notlar || []); setEtiketler(etiketRes.etiketler || [])
  }

  async function notEkle() {
    if (!yeniNot.trim() || !selected) return
    setNotEkleniyor(true)
    await fetch('/api/musteri-notu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ telefon: selected.phone, icerik: yeniNot.trim() }) })
    setYeniNot(''); await loadNotlar(selected.phone); setNotEkleniyor(false)
  }

  async function notSil(id: number) {
    await fetch(`/api/musteri-notu?id=${id}`, { method: 'DELETE' })
    setNotlar(prev => prev.filter(n => n.id !== id))
  }

  const filtered = sessions.filter(s => !search || s.phone.includes(search) || (s.musteri_yazdigi || '').toLowerCase().includes(search.toLowerCase()))

  const filters = [
    { v: 'all', l: 'Hepsi' }, { v: 'gpt', l: 'Bot' }, { v: 'canli', l: 'Canlı' },
    { v: 'kvkk', l: 'KVKK' }, { v: 'sepet', l: 'Sepet' }
  ]

  return (
    <div style={S.page}>
      {/* Header */}
      <header style={{ marginBottom: 28 }}>
        <p style={{ fontSize: 10, letterSpacing: '0.3em', textTransform: 'uppercase', color: '#5A5550', fontFamily: 'JetBrains Mono, monospace', marginBottom: 6 }}>
          {sessions.length} kayıt
        </p>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 44, fontWeight: 300, color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1 }}>
          Konuşmalar
        </h1>
        <div style={{ height: 1, background: 'linear-gradient(90deg, rgba(201,168,76,0.3), transparent)', marginTop: 16 }} />
      </header>

      {/* Arama + Filtreler */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' as const }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#5A5550' }} />
          <input
            type="text"
            placeholder="Telefon veya mesaj ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="input-premium"
            style={{ paddingLeft: 40, paddingRight: 40, paddingTop: 11, paddingBottom: 11, fontSize: 13 }}
          />
          {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: '#5A5550', background: 'none', border: 'none', cursor: 'pointer' }}><X size={14} /></button>}
        </div>
        <div style={{ display: 'flex', background: 'var(--bg-card)', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8, padding: 4, gap: 2 }}>
          {filters.map(f => (
            <button key={f.v} onClick={() => setFilter(f.v as any)} style={{ padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: filter === f.v ? 600 : 400, background: filter === f.v ? 'rgba(139,105,20,0.15)' : 'transparent', color: filter === f.v ? '#E8D5A3' : 'var(--text-muted)', border: filter === f.v ? '1px solid rgba(201,168,76,0.2)' : '1px solid transparent', cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' as const }}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Tablo */}
      <div style={S.card}>
        {loading ? (
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[1,2,3,4,5].map(i => <div key={i} style={{ height: 44, background: 'var(--bg-card2)', borderRadius: 8, animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Telefon','Son Mesaj','Niyet','Durum','KVKK','Güncelleme'].map(h => (
                  <th key={h} style={S.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.phone} onClick={() => setSelected(s)} style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(201,168,76,0.03)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <td style={{ ...S.td, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text-body)' }}>{s.phone}</td>
                  <td style={{ ...S.td, color: 'var(--text-muted)', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.musteri_yazdigi || '—'}</td>
                  <td style={S.td}>
                    <span style={{ display: 'inline-flex', padding: '3px 8px', borderRadius: 4, fontSize: 10, color: '#C9A84C', background: 'rgba(139,105,20,0.08)', border: '1px solid rgba(201,168,76,0.12)' }}>
                      {INTENT_LABEL[s.last_intent||'other'] || 'Diğer'}
                    </span>
                  </td>
                  <td style={S.td}>
                    {s.bulundugu_menu === 'canli'
                      ? <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#C4364A', fontSize: 12 }}><span style={{ width: 5, height: 5, borderRadius: '50%', background: '#C4364A', display: 'inline-block' }} />Canlı</span>
                      : <span style={{ color: '#5A5550', fontSize: 12 }}>Bot</span>}
                  </td>
                  <td style={S.td}>
                    <span style={{ fontSize: 11, fontWeight: 500, color: s.kvkk_onay ? '#C9A84C' : '#5A5550' }}>
                      {s.kvkk_onay ? '✓ Onaylı' : '✗ Yok'}
                    </span>
                  </td>
                  <td style={{ ...S.td, fontFamily: 'JetBrains Mono, monospace', color: '#5A5550', whiteSpace: 'nowrap' }}>
                    {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true, locale: tr })}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', fontSize: 11, color: '#5A5550', fontFamily: 'JetBrains Mono, monospace' }}>sonuç bulunamadı</td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Profil Drawer */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelected(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }} />
          <div style={{ position: 'relative', width: '100%', maxWidth: 420, background: 'var(--bg-sidebar)', height: '100%', overflowY: 'auto', borderLeft: '1px solid rgba(201,168,76,0.15)' }} onClick={e => e.stopPropagation()}>

            {/* Drawer header */}
            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'rgba(13,11,9,0.95)', backdropFilter: 'blur(12px)', padding: '20px 24px', borderBottom: '1px solid rgba(201,168,76,0.08)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: 'linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05))', border: '1px solid rgba(201,168,76,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'Cormorant Garamond, serif', fontSize: 18, color: '#C9A84C' }}>
                  {selected.phone.slice(-2)}
                </div>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13, color: 'var(--text-body)' }}>{selected.phone}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: selected.bulundugu_menu === 'canli' ? 'rgba(139,38,53,0.2)' : 'rgba(58,55,48,0.3)', color: selected.bulundugu_menu === 'canli' ? '#C4364A' : 'var(--text-muted)', border: `1px solid ${selected.bulundugu_menu === 'canli' ? 'rgba(139,38,53,0.3)' : 'rgba(58,55,48,0.2)'}` }}>
                      {selected.bulundugu_menu === 'canli' ? '⬤ Canlı' : '⬤ Bot'}
                    </span>
                    <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: selected.kvkk_onay ? 'rgba(139,105,20,0.12)' : 'rgba(31,29,23,0.5)', color: selected.kvkk_onay ? '#C9A84C' : '#5A5550', border: `1px solid ${selected.kvkk_onay ? 'rgba(201,168,76,0.2)' : 'rgba(58,55,48,0.2)'}` }}>
                      {selected.kvkk_onay ? '✓ KVKK' : '✗ KVKK'}
                    </span>
                    {etiketler.map(e => <span key={e.id} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, color: '#fff', background: e.renk }}>{e.etiket}</span>)}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} style={{ width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: 'rgba(58,55,48,0.3)', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            </div>

            <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Konuşma Geçmişi */}
              {(() => {
                let gecmis: {role:string;content:string}[] = []
                try {
                  const raw = (selected as any).gecmis
                  console.log('gecmis raw type:', typeof raw, Array.isArray(raw))
                  if (Array.isArray(raw)) gecmis = raw
                  else if (typeof raw === 'string' && raw.trim()) gecmis = JSON.parse(raw)
                  console.log('gecmis length:', gecmis.length)
                } catch(e) { console.error('gecmis error:', e) }
                if (!gecmis.length) return null
                return (
                  <div style={{ background: 'var(--bg-card2)', border: '1px solid rgba(201,168,76,0.08)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                      <MessageSquare size={12} color="#5A5550" strokeWidth={1.5} />
                      <span style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5A5550' }}>Konuşma Geçmişi</span>
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(139,105,20,0.08)', color: '#5A5550', fontFamily: 'JetBrains Mono, monospace' }}>{gecmis.length}</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 400, overflowY: 'auto' }}>
                      {gecmis.map((m, i) => {
                        const isBot = m.role === 'assistant'
                        return (
                          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isBot ? 'flex-start' : 'flex-end', gap: 2 }}>
                            <span style={{ fontSize: 9, color: '#5A5550', letterSpacing: '0.1em' }}>{isBot ? 'Roberto' : 'Müşteri'}</span>
                            <div style={{
                              maxWidth: '85%', padding: '8px 12px', borderRadius: isBot ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                              background: isBot ? 'var(--bg-card)' : 'linear-gradient(135deg,#C9A84C,#8B6914)',
                              border: isBot ? '1px solid rgba(201,168,76,0.1)' : 'none',
                              color: isBot ? '#9A928A' : 'var(--bg-base)', fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                            }}>
                              {m.content}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })()}

              {/* Detaylar */}
              <div style={{ background: 'var(--bg-card2)', border: '1px solid rgba(201,168,76,0.08)', borderRadius: 10, overflow: 'hidden' }}>
                {[
                  { label: 'Son Niyet', value: INTENT_LABEL[selected.last_intent||'other'] || '—' },
                  { label: 'Bekleyen Aksiyon', value: (selected as any).pending_action || '—' },
                  { label: 'KVKK Tarihi', value: (selected as any).kvkk_onay_tarihi ? new Date((selected as any).kvkk_onay_tarihi).toLocaleString('tr') : '—' },
                  { label: 'Son Güncelleme', value: new Date(selected.updated_at).toLocaleString('tr') },
                ].map(({ label, value }, i) => (
                  <div key={label} style={{ padding: '12px 16px', borderTop: i === 0 ? 'none' : '1px solid rgba(201,168,76,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                    <dt style={{ fontSize: 10, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#5A5550', whiteSpace: 'nowrap', marginTop: 1 }}>{label}</dt>
                    <dd style={{ fontSize: 12, color: '#9A928A', textAlign: 'right', wordBreak: 'break-all' }}>{value}</dd>
                  </div>
                ))}
              </div>

              {/* Notlar */}
              <div style={{ background: 'var(--bg-card2)', border: '1px solid rgba(201,168,76,0.08)', borderRadius: 10, padding: '14px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <StickyNote size={12} color="#5A5550" strokeWidth={1.5} />
                  <span style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#5A5550' }}>Notlar</span>
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'rgba(139,105,20,0.08)', color: '#5A5550', fontFamily: 'JetBrains Mono, monospace' }}>{notlar.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, maxHeight: 160, overflowY: 'auto' }}>
                  {notlar.length === 0
                    ? <p style={{ fontSize: 11, color: '#272420', fontFamily: 'JetBrains Mono, monospace' }}>henüz not yok</p>
                    : notlar.map(n => (
                      <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: '#1F1D17', border: '1px solid rgba(201,168,76,0.06)', borderRadius: 8, padding: '8px 12px' }}>
                        <p style={{ fontSize: 12, color: '#9A928A', flex: 1 }}>{n.icerik}</p>
                        <button onClick={() => notSil(n.id)} style={{ background: 'none', border: 'none', color: '#5A5550', cursor: 'pointer', padding: 0, marginTop: 1 }}
                          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#C4364A'}
                          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#5A5550'}>
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))
                  }
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={yeniNot}
                    onChange={e => setYeniNot(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && notEkle()}
                    placeholder="Not ekle... (Enter)"
                    className="input-premium"
                    style={{ flex: 1, padding: '8px 12px', fontSize: 12 }}
                  />
                  <button onClick={notEkle} disabled={notEkleniyor || !yeniNot.trim()}
                    className="btn-gold"
                    style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, flexShrink: 0 }}>
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Sepet */}
              {selected.pending_action && String(selected.pending_action).includes('order:') && (
                <div style={{ background: 'rgba(139,105,20,0.08)', border: '1px solid rgba(201,168,76,0.15)', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                    <ShoppingCart size={12} color="#C9A84C" strokeWidth={1.5} />
                    <span style={{ fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: '#C9A84C' }}>Aktif Sepet</span>
                  </div>
                  <p style={{ fontSize: 11, color: '#9A928A', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>{String(selected.pending_action)}</p>
                </div>
              )}

              {/* Aksiyonlar */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                {selected.slack_thread_ts && (
                  <a href="/canli-destek" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px 0', background: 'rgba(139,38,53,0.15)', border: '1px solid rgba(139,38,53,0.3)', borderRadius: 8, color: '#C4364A', fontSize: 13, fontWeight: 500, textDecoration: 'none' }}>
                    Canlı Destek'te Aç →
                  </a>
                )}
                <button onClick={() => setSelected(null)} style={{ padding: '11px 0', background: '#1F1D17', border: '1px solid rgba(201,168,76,0.1)', borderRadius: 8, color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer' }}>
                  Kapat
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
