'use client'

import { useEffect, useState } from 'react'
import { supabase, Session } from '@/lib/supabase'
import { Search, X, MessageSquare, ShoppingCart, StickyNote, Trash2, Plus, Tag } from 'lucide-react'
import { formatDistanceToNow, format } from 'date-fns'
import { tr } from 'date-fns/locale'

const INTENT_LABEL: Record<string, string> = {
  greeting: 'Selamlama', products: 'Ürün Listesi', product_detail: 'Ürün Detay',
  order_status: 'Sipariş Durumu', order_create: 'Sipariş Oluştur', subscription: 'Abonelik',
  human_handover: 'Canlı Destek', complaint: 'Şikayet', brand_info: 'Marka Bilgi',
  usage_question: 'Kullanım Sorusu', menu: 'Menü', smalltalk: 'Sohbet', other: 'Diğer',
}
const TONE: Record<string, string> = {
  greeting: '#7c9059', products: '#a8b885', subscription: '#d97757',
  human_handover: '#c4633f', complaint: '#a64d2e', order_create: '#c4a154', other: '#928c79',
}
type FilterType = 'all' | 'canli' | 'gpt' | 'kvkk' | 'sepet'
type Not = { id: number; icerik: string; created_at: string }

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

  useEffect(() => {
    if (selected) loadNotlar(selected.phone)
    else setNotlar([])
  }, [selected])

  async function load() {
    setLoading(true)
    let q = supabase.from('wa_sessions_roberto').select('*').order('updated_at', { ascending: false }).limit(500)
    if (filter === 'canli') q = q.eq('bulundugu_menu', 'canli')
    else if (filter === 'gpt') q = q.eq('bulundugu_menu', 'gpt')
    else if (filter === 'kvkk') q = q.eq('kvkk_onay', false)
    const { data } = await q
    let list = (data || []) as Session[]
    if (filter === 'sepet') list = list.filter(s => s.pending_action && String(s.pending_action).includes('order:'))
    setSessions(list)
    setLoading(false)
  }

  async function loadNotlar(telefon: string) {
    const [notRes, etiketRes] = await Promise.all([
      fetch(`/api/musteri-notu?telefon=${telefon}`).then(r => r.json()),
      fetch(`/api/etiket?telefon=${telefon}`).then(r => r.json()),
    ])
    setNotlar(notRes.notlar || [])
    setEtiketler(etiketRes.etiketler || [])
  }

  async function notEkle() {
    if (!yeniNot.trim() || !selected) return
    setNotEkleniyor(true)
    await fetch('/api/musteri-notu', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ telefon: selected.phone, icerik: yeniNot.trim() })
    })
    setYeniNot('')
    await loadNotlar(selected.phone)
    setNotEkleniyor(false)
  }

  async function notSil(id: number) {
    await fetch(`/api/musteri-notu?id=${id}`, { method: 'DELETE' })
    setNotlar(prev => prev.filter(n => n.id !== id))
  }

  const filtered = sessions.filter(s => !search || s.phone.includes(search) || (s.musteri_yazdigi || '').toLowerCase().includes(search.toLowerCase()))

  return (
    <div className="p-4 md:p-10 max-w-7xl mx-auto">
      <header className="mb-6 md:mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-ink-300 mb-2">{sessions.length} kayıt</p>
        <h1 className="font-display text-3xl md:text-5xl text-ink-900 tracking-tight">Konuşmalar</h1>
      </header>

      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-300" />
          <input type="text" placeholder="Telefon veya mesaj ara..." value={search} onChange={e => setSearch(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-white border border-cream-200 rounded-xl text-ink-700 placeholder-ink-300 focus:outline-none focus:border-moss-400 text-sm" />
          {search && <button onClick={() => setSearch('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-ink-300"><X className="w-3.5 h-3.5" /></button>}
        </div>
        <div className="flex overflow-x-auto bg-white border border-cream-200 rounded-xl p-1 gap-1 shrink-0">
          {[{v:'all',l:'Hepsi'},{v:'gpt',l:'Bot'},{v:'canli',l:'Canlı'},{v:'kvkk',l:'KVKK'},{v:'sepet',l:'Sepet'}].map(f => (
            <button key={f.v} onClick={() => setFilter(f.v as any)}
              className={`px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${filter === f.v ? 'bg-ink-900 text-cream-50' : 'text-ink-500 hover:text-ink-700'}`}>
              {f.l}
            </button>
          ))}
        </div>
      </div>

      {/* Mobil kart */}
      <div className="md:hidden space-y-2">
        {loading ? [1,2,3,4,5].map(i => <div key={i} className="h-20 bg-cream-100 rounded-2xl animate-pulse" />) :
        filtered.map(s => (
          <div key={s.phone} onClick={() => setSelected(s)} className="bg-white border border-cream-200 rounded-2xl p-4 cursor-pointer hover:border-moss-300 transition-colors">
            <div className="flex items-start justify-between mb-2">
              <span className="font-mono text-sm text-ink-900">{s.phone}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-medium" style={{ background: `${TONE[s.last_intent||'other']}20`, color: TONE[s.last_intent||'other'] }}>
                {INTENT_LABEL[s.last_intent||'other'] || 'Diğer'}
              </span>
            </div>
            <p className="text-xs text-ink-500 truncate mb-2">{s.musteri_yazdigi || '—'}</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {s.bulundugu_menu === 'canli' ? <span className="flex items-center gap-1 text-xs text-ember-600"><span className="w-1.5 h-1.5 rounded-full bg-ember-500 animate-pulse" />Canlı</span> : <span className="text-xs text-moss-500">Bot</span>}
                <span className={`text-xs ${s.kvkk_onay ? 'text-moss-500' : 'text-ember-400'}`}>{s.kvkk_onay ? '✓' : '✗'} KVKK</span>
              </div>
              <span className="text-xs text-ink-300 font-mono">{formatDistanceToNow(new Date(s.updated_at), { addSuffix: true, locale: tr })}</span>
            </div>
          </div>
        ))}
        {!loading && filtered.length === 0 && <div className="p-12 text-center text-ink-300 font-mono text-sm">sonuç bulunamadı</div>}
      </div>

      {/* Masaüstü tablo */}
      <div className="hidden md:block bg-white border border-cream-200 rounded-2xl overflow-hidden">
        {loading ? <div className="p-4 space-y-3">{[1,2,3,4,5].map(i => <div key={i} className="animate-pulse h-12 bg-cream-100 rounded-xl" />)}</div> : (
          <table className="w-full">
            <thead className="bg-cream-50">
              <tr>{['Telefon','Son Mesaj','Niyet','Durum','KVKK','Güncelleme'].map(h => (
                <th key={h} className="px-6 py-4 text-left text-[10px] uppercase tracking-[0.2em] text-ink-300">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {filtered.map(s => (
                <tr key={s.phone} onClick={() => setSelected(s)} className="border-t border-cream-100 hover:bg-cream-50 cursor-pointer transition-colors">
                  <td className="px-6 py-4 font-mono text-sm text-ink-700">{s.phone}</td>
                  <td className="px-6 py-4 text-sm text-ink-500 max-w-xs truncate">{s.musteri_yazdigi || '—'}</td>
                  <td className="px-6 py-4"><span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ background: `${TONE[s.last_intent||'other']}20`, color: TONE[s.last_intent||'other'] }}>{INTENT_LABEL[s.last_intent||'other'] || 'Diğer'}</span></td>
                  <td className="px-6 py-4">{s.bulundugu_menu === 'canli' ? <span className="flex items-center gap-1.5 text-xs text-ember-600"><span className="w-1.5 h-1.5 rounded-full bg-ember-500 animate-pulse" />Canlı</span> : <span className="text-xs text-moss-500">Bot</span>}</td>
                  <td className="px-6 py-4"><span className={`text-xs font-medium ${s.kvkk_onay ? 'text-moss-500' : 'text-ember-400'}`}>{s.kvkk_onay ? '✓ Onaylı' : '✗ Yok'}</span></td>
                  <td className="px-6 py-4 text-xs text-ink-300 font-mono">{formatDistanceToNow(new Date(s.updated_at), { addSuffix: true, locale: tr })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && filtered.length === 0 && <div className="p-12 text-center text-ink-300 font-mono text-sm">sonuç bulunamadı</div>}
      </div>

      {/* Profil Drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={() => setSelected(null)}>
          <div className="absolute inset-0 bg-ink-900/30 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-cream-50 h-full overflow-y-auto shadow-2xl" onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div className="sticky top-0 bg-white border-b border-cream-200 z-10 p-4 md:p-6 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-moss-100 flex items-center justify-center">
                  <span className="text-base font-display text-moss-700">{selected.phone.slice(-2)}</span>
                </div>
                <div>
                  <div className="font-mono text-sm text-ink-900">{selected.phone}</div>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${selected.bulundugu_menu === 'canli' ? 'bg-ember-100 text-ember-700' : 'bg-moss-100 text-moss-700'}`}>
                      {selected.bulundugu_menu === 'canli' ? '🔴 Canlı' : '🤖 Bot'}
                    </span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${selected.kvkk_onay ? 'bg-moss-50 text-moss-600' : 'bg-ember-50 text-ember-600'}`}>
                      {selected.kvkk_onay ? '✓ KVKK' : '✗ KVKK'}
                    </span>
                    {etiketler.map(e => (
                      <span key={e.id} className="text-[10px] px-2 py-0.5 rounded-full font-medium text-white" style={{ background: e.renk }}>
                        {e.etiket}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-cream-100 text-ink-300"><X className="w-4 h-4" /></button>
            </div>

            <div className="p-4 md:p-6 space-y-4">

              {/* Son mesaj */}
              {selected.musteri_yazdigi && (
                <div className="bg-white border border-cream-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2"><MessageSquare className="w-3.5 h-3.5 text-ink-300" strokeWidth={1.5} /><span className="text-[10px] uppercase tracking-[0.2em] text-ink-300">Son Mesaj</span></div>
                  <p className="text-sm text-ink-700 italic">"{selected.musteri_yazdigi}"</p>
                </div>
              )}

              {/* Detaylar */}
              <div className="bg-white border border-cream-200 rounded-xl divide-y divide-cream-100">
                {[
                  { label: 'Son Niyet', value: INTENT_LABEL[selected.last_intent||'other'] || '—', emoji: '🎯' },
                  { label: 'Bekleyen Aksiyon', value: selected.pending_action || '—', emoji: '⏳' },
                  { label: 'KVKK Tarihi', value: selected.kvkk_onay_tarihi ? new Date(selected.kvkk_onay_tarihi).toLocaleString('tr') : '—', emoji: '📋' },
                  { label: 'Son Güncelleme', value: new Date(selected.updated_at).toLocaleString('tr'), emoji: '🕐' },
                ].map(({ label, value, emoji }) => (
                  <div key={label} className="flex items-start gap-3 px-4 py-3">
                    <span className="text-base mt-0.5 shrink-0">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <dt className="text-[10px] uppercase tracking-[0.15em] text-ink-300 mb-0.5">{label}</dt>
                      <dd className="text-sm text-ink-700 break-all">{value}</dd>
                    </div>
                  </div>
                ))}
              </div>

              {/* 2. Müşteri Notları */}
              <div className="bg-white border border-cream-200 rounded-xl p-4">
                <div className="flex items-center gap-2 mb-3">
                  <StickyNote className="w-3.5 h-3.5 text-ink-400" strokeWidth={1.5} />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-ink-300">Notlar</span>
                  <span className="text-[10px] bg-cream-100 text-ink-400 px-1.5 py-0.5 rounded-full font-mono">{notlar.length}</span>
                </div>
                <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                  {notlar.length === 0 ? (
                    <p className="text-xs text-ink-300 font-mono">henüz not yok</p>
                  ) : notlar.map(n => (
                    <div key={n.id} className="flex items-start gap-2 bg-cream-50 border border-cream-200 rounded-lg px-3 py-2">
                      <p className="text-sm text-ink-700 flex-1">{n.icerik}</p>
                      <button onClick={() => notSil(n.id)} className="text-ink-300 hover:text-ember-500 transition-colors shrink-0 mt-0.5">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={yeniNot}
                    onChange={e => setYeniNot(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && notEkle()}
                    placeholder="Not ekle... (Enter)"
                    className="flex-1 px-3 py-2 bg-cream-50 border border-cream-200 rounded-lg text-sm text-ink-700 placeholder-ink-300 focus:outline-none focus:border-moss-400"
                  />
                  <button onClick={notEkle} disabled={notEkleniyor || !yeniNot.trim()}
                    className="w-9 h-9 rounded-lg bg-ink-900 text-cream-50 flex items-center justify-center hover:bg-ink-700 transition-colors disabled:opacity-40">
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Sepet */}
              {selected.pending_action && String(selected.pending_action).includes('order:') && (
                <div className="bg-moss-50 border border-moss-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2"><ShoppingCart className="w-3.5 h-3.5 text-moss-600" strokeWidth={1.5} /><span className="text-[10px] uppercase tracking-[0.2em] text-moss-600">Aktif Sepet</span></div>
                  <p className="text-sm text-moss-700 font-mono break-all">{String(selected.pending_action)}</p>
                </div>
              )}

              {/* Aksiyonlar */}
              <div className="space-y-2 pt-2">
                {selected.slack_thread_ts && <a href="/canli-destek" className="w-full flex items-center justify-center gap-2 py-3 bg-ember-600 text-white rounded-xl text-sm font-medium hover:bg-ember-700 transition-colors">💬 Canlı Destek'te Aç →</a>}
                <button onClick={() => setSelected(null)} className="w-full py-3 bg-ink-900 text-cream-50 rounded-xl text-sm font-medium hover:bg-ink-700 transition-colors">Kapat</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
