'use client'

import { useEffect, useState } from 'react'
import type { Session } from '@/lib/supabase'
import { getSessions } from '@/lib/sessionsApi'
import TopBar from '@/components/TopBar'
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

const FILTERS: { v: FilterType; l: string }[] = [
  { v: 'all', l: 'Hepsi' }, { v: 'gpt', l: 'Bot' }, { v: 'canli', l: 'Canlı' },
  { v: 'kvkk', l: 'KVKK Yok' }, { v: 'sepet', l: 'Sepet' },
]

export default function KonusmalarPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Session | null>(null)
  const [notlar, setNotlar] = useState<Not[]>([])
  const [yeniNot, setYeniNot] = useState('')
  const [notEkleniyor, setNotEkleniyor] = useState(false)
  const [etiketler, setEtiketler] = useState<{ id: number; etiket: string; renk: string }[]>([])

  useEffect(() => { load() }, [filter])
  useEffect(() => { if (selected) loadNotlar(selected.phone); else setNotlar([]) }, [selected])

  async function load() {
    setLoading(true)
    const qs = new URLSearchParams({ limit: '500' })
    if (filter === 'canli') qs.set('menu', 'canli')
    else if (filter === 'gpt') qs.set('menu', 'bot')
    else if (filter === 'kvkk') qs.set('kvkk', '0')
    const { data } = await getSessions(qs.toString())
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

  let gecmis: { role: string; content: string }[] = []
  if (selected) {
    try {
      const raw = (selected as any).gecmis
      if (Array.isArray(raw)) gecmis = raw
      else if (typeof raw === 'string' && raw.trim()) gecmis = JSON.parse(raw)
    } catch {}
  }

  return (
    <>
      <TopBar title="Konuşmalar" subtitle={`${sessions.length} kayıt`} />
      <div style={{ padding: 22, maxWidth: 1360, width: '100%', margin: '0 auto' }}>

        <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 220 }}>
            <Search size={14} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)' }} />
            <input className="inp" placeholder="Telefon veya mesaj ara..." value={search} onChange={e => setSearch(e.target.value)} style={{ paddingLeft: 38, paddingRight: 36 }} />
            {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--tx3)', background: 'none', border: 'none' }}><X size={14} /></button>}
          </div>
          <div style={{ display: 'flex', background: 'var(--s1)', border: '1px solid var(--bdr)', borderRadius: 10, padding: 3, gap: 2 }}>
            {FILTERS.map(f => (
              <button key={f.v} onClick={() => setFilter(f.v)} style={{ padding: '6px 14px', borderRadius: 7, fontSize: 12.5, fontWeight: filter === f.v ? 600 : 500, background: filter === f.v ? 'var(--ac2)' : 'transparent', color: filter === f.v ? 'var(--ac)' : 'var(--tx2)', border: 'none', whiteSpace: 'nowrap' }}>
                {f.l}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {loading ? (
            <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[1, 2, 3, 4, 5].map(i => <div key={i} className="anim-pulse" style={{ height: 44, background: 'var(--s2)', borderRadius: 8 }} />)}
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Telefon', 'Son Mesaj', 'Niyet', 'Durum', 'KVKK', 'Güncelleme'].map(h => (
                      <th key={h} className="kpi-label" style={{ padding: '12px 18px', textAlign: 'left', marginBottom: 0, borderBottom: '1px solid var(--bdr)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.phone} className="row" style={{ display: 'table-row', cursor: 'pointer' }} onClick={() => setSelected(s)}>
                      <td style={{ padding: '13px 18px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: 'var(--tx)', borderBottom: '1px solid var(--bdr)' }}>{s.phone}</td>
                      <td style={{ padding: '13px 18px', fontSize: 12.5, color: 'var(--tx2)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid var(--bdr)' }}>{s.musteri_yazdigi || '—'}</td>
                      <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--bdr)' }}><span className="badge badge-ac">{INTENT_LABEL[s.last_intent || 'other'] || 'Diğer'}</span></td>
                      <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--bdr)' }}>
                        {s.bulundugu_menu === 'canli' ? <span className="badge badge-red">Canlı</span> : <span className="badge badge-muted">Bot</span>}
                      </td>
                      <td style={{ padding: '13px 18px', borderBottom: '1px solid var(--bdr)' }}>
                        <span className={`badge ${s.kvkk_onay ? 'badge-green' : 'badge-muted'}`}>{s.kvkk_onay ? '✓ Onaylı' : 'Yok'}</span>
                      </td>
                      <td style={{ padding: '13px 18px', fontSize: 11.5, color: 'var(--tx3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--bdr)' }}>
                        {formatDistanceToNow(new Date(s.updated_at), { addSuffix: true, locale: tr })}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 40, textAlign: 'center', fontSize: 12.5, color: 'var(--tx3)' }}>sonuç bulunamadı</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Profil drawer */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9990, display: 'flex', justifyContent: 'flex-end' }} onClick={() => setSelected(null)}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.6)', backdropFilter: 'blur(4px)' }} className="anim-fade" />
          <div className="anim-slide-r" style={{ position: 'relative', width: '100%', maxWidth: 440, height: '100vh', overflowY: 'auto', background: 'var(--s1)', borderLeft: '1px solid var(--bdr2)' }} onClick={e => e.stopPropagation()}>

            <div style={{ position: 'sticky', top: 0, zIndex: 10, background: 'var(--topbar-bg)', backdropFilter: 'blur(12px)', padding: '16px 20px', borderBottom: '1px solid var(--bdr)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="sb-av" style={{ width: 40, height: 40, borderRadius: 10, fontSize: 14 }}>{selected.phone.slice(-2)}</div>
                <div>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 13.5, color: 'var(--tx)', fontWeight: 600 }}>{selected.phone}</div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                    <span className={`badge ${selected.bulundugu_menu === 'canli' ? 'badge-red' : 'badge-muted'}`}>{selected.bulundugu_menu === 'canli' ? 'Canlı' : 'Bot'}</span>
                    <span className={`badge ${selected.kvkk_onay ? 'badge-green' : 'badge-muted'}`}>{selected.kvkk_onay ? '✓ KVKK' : 'KVKK yok'}</span>
                    {etiketler.map(e => <span key={e.id} className="badge" style={{ background: e.renk, color: '#fff' }}>{e.etiket}</span>)}
                  </div>
                </div>
              </div>
              <button className="btn-ghost" onClick={() => setSelected(null)} style={{ padding: 7 }}><X size={14} /></button>
            </div>

            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>

              {gecmis.length > 0 && (
                <div className="card" style={{ background: 'var(--s2)' }}>
                  <div className="card-h" style={{ padding: '11px 16px' }}>
                    <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}><MessageSquare size={13} style={{ color: 'var(--tx3)' }} /> Konuşma Geçmişi</span>
                    <span className="badge badge-muted">{gecmis.length}</span>
                  </div>
                  <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 400, overflowY: 'auto' }}>
                    {gecmis.map((m, i) => {
                      const isBot = m.role === 'assistant' || m.role === 'agent'
                      return (
                        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: isBot ? 'flex-start' : 'flex-end', gap: 3 }}>
                          <span style={{ fontSize: 10, color: 'var(--tx3)' }}>{isBot ? 'Roberto' : 'Müşteri'}</span>
                          <div style={{
                            maxWidth: '86%', padding: '8px 12px', borderRadius: isBot ? '4px 12px 12px 12px' : '12px 4px 12px 12px',
                            background: isBot ? 'var(--s3)' : 'var(--ac)', color: isBot ? 'var(--tx)' : '#fff',
                            fontSize: 12.5, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                          }}>{m.content}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="card" style={{ background: 'var(--s2)' }}>
                {[
                  { label: 'Son Niyet', value: INTENT_LABEL[selected.last_intent || 'other'] || '—' },
                  { label: 'Bekleyen Aksiyon', value: selected.pending_action || '—' },
                  { label: 'KVKK Tarihi', value: selected.kvkk_onay_tarihi ? new Date(selected.kvkk_onay_tarihi).toLocaleString('tr') : '—' },
                  { label: 'Son Güncelleme', value: new Date(selected.updated_at).toLocaleString('tr') },
                ].map(({ label, value }) => (
                  <div key={label} className="row" style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: 12, color: 'var(--tx3)', whiteSpace: 'nowrap' }}>{label}</span>
                    <span style={{ fontSize: 12.5, color: 'var(--tx)', textAlign: 'right', wordBreak: 'break-all' }}>{value}</span>
                  </div>
                ))}
              </div>

              <div className="card" style={{ background: 'var(--s2)' }}>
                <div className="card-h" style={{ padding: '11px 16px' }}>
                  <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}><StickyNote size={13} style={{ color: 'var(--tx3)' }} /> Notlar</span>
                  <span className="badge badge-muted">{notlar.length}</span>
                </div>
                <div style={{ padding: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10, maxHeight: 180, overflowY: 'auto' }}>
                    {notlar.length === 0
                      ? <p style={{ fontSize: 12, color: 'var(--tx3)' }}>henüz not yok</p>
                      : notlar.map(n => (
                        <div key={n.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, background: 'var(--s3)', borderRadius: 8, padding: '8px 12px' }}>
                          <p style={{ fontSize: 12.5, color: 'var(--tx)', flex: 1 }}>{n.icerik}</p>
                          <button onClick={() => notSil(n.id)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 0, marginTop: 2 }}><Trash2 size={13} /></button>
                        </div>
                      ))}
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <input className="inp" value={yeniNot} onChange={e => setYeniNot(e.target.value)} onKeyDown={e => e.key === 'Enter' && notEkle()} placeholder="Not ekle... (Enter)" style={{ flex: 1, padding: '8px 12px' }} />
                    <button className="btn" onClick={notEkle} disabled={notEkleniyor || !yeniNot.trim()} style={{ padding: '0 12px' }}><Plus size={14} /></button>
                  </div>
                </div>
              </div>

              {selected.pending_action && String(selected.pending_action).includes('order:') && (
                <div className="card" style={{ background: 'var(--amber2)', borderColor: 'rgba(240,168,67,.25)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                    <ShoppingCart size={13} style={{ color: 'var(--amber)' }} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--amber)' }}>Aktif Sepet</span>
                  </div>
                  <p style={{ fontSize: 11.5, color: 'var(--tx2)', fontFamily: 'JetBrains Mono, monospace', wordBreak: 'break-all' }}>{String(selected.pending_action)}</p>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {selected.slack_thread_ts && (
                  <a href="/canli-destek" className="btn-danger" style={{ justifyContent: 'center', padding: '10px 0' }}>Canlı Destek'te Aç →</a>
                )}
                <button className="btn-ghost" onClick={() => setSelected(null)} style={{ justifyContent: 'center', padding: '10px 0' }}>Kapat</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
