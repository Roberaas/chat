'use client'

import { useEffect, useState } from 'react'
import { Plus, X, Check, Clock, Phone, MessageSquare, Trash2, AlertCircle, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

type Gorev = {
  id: number; baslik: string; aciklama?: string; durum: string
  oncelik: string; ilgili_telefon?: string; ilgili_siparis?: string
  bitis_tarihi?: string; created_at: string
}
type EkipNotu = {
  id: number; yazan: string; icerik: string; ilgili_telefon?: string
  ilgili_siparis?: string; ilgili_tip: string; created_at: string
}
type AramaLog = {
  id: number; telefon: string; musteri_adi?: string; sure_dakika: number
  notlar?: string; sonuc: string; arayan: string; created_at: string
}

const ONCELIK_COLOR: Record<string, string> = {
  dusuk: 'bg-[var(--bg-card2)] text-[var(--text-muted)]',
  normal: 'bg-cream-200 text-ink-600',
  yuksek: 'bg-[rgba(201,168,76,0.12)] text-[var(--gold-dark)]',
  acil: 'bg-ruby/10 text-ember-700',
}
const SONUC_COLOR: Record<string, string> = {
  tamamlandi: 'bg-[var(--bg-card2)] text-[var(--gold)]',
  cevapsiz: 'bg-ruby/10 text-ruby-light',
  geri_aranacak: 'bg-cream-200 text-ink-600',
  mesaj_birakildi: 'bg-cream-200 text-ink-600',
}
const SONUC_LABEL: Record<string, string> = {
  tamamlandi: 'Tamamlandı', cevapsiz: 'Cevapsız',
  geri_aranacak: 'Geri Aranacak', mesaj_birakildi: 'Mesaj Bırakıldı'
}

export default function CalismaPage() {
  const [tab, setTab] = useState<'gorevler' | 'notlar' | 'aramalar'>('gorevler')
  const [gorevler, setGorevler] = useState<Gorev[]>([])
  const [notlar, setNotlar] = useState<EkipNotu[]>([])
  const [aramalar, setAramalar] = useState<AramaLog[]>([])
  const [loading, setLoading] = useState(true)
  const [gorevForm, setGorevForm] = useState({ show: false, baslik: '', aciklama: '', oncelik: 'normal', ilgili_telefon: '', ilgili_siparis: '', bitis_tarihi: '', sms_saati: '', sms_telefon: '905392993103' })
  const [notForm, setNotForm] = useState({ show: false, icerik: '', yazan: 'admin', ilgili_telefon: '', ilgili_siparis: '', ilgili_tip: 'genel' })
  const [aramaForm, setAramaForm] = useState({ show: false, telefon: '', musteri_adi: '', sure_dakika: '', notlar: '', sonuc: 'tamamlandi', arayan: 'admin' })
  const [filter, setFilter] = useState<'all' | 'bekliyor' | 'devam' | 'tamamlandi'>('bekliyor')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [g, n, a] = await Promise.all([
      fetch('/api/gorev').then(r => r.json()),
      fetch('/api/ekip-notu').then(r => r.json()),
      fetch('/api/arama-log').then(r => r.json()),
    ])
    setGorevler(g.gorevler || [])
    setNotlar(n.notlar || [])
    setAramalar(a.aramalar || [])
    setLoading(false)
  }

  async function gorevEkle() {
    if (!gorevForm.baslik.trim()) return
    const { show, ...data } = gorevForm
    await fetch('/api/gorev', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
    setGorevForm({ show: false, baslik: '', aciklama: '', oncelik: 'normal', ilgili_telefon: '', ilgili_siparis: '', bitis_tarihi: '', sms_saati: '', sms_telefon: '905392993103' })
    load()
  }

  async function gorevDurumGuncelle(id: number, durum: string) {
    await fetch('/api/gorev', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, durum }) })
    load()
  }

  async function gorevSil(id: number) {
    await fetch(`/api/gorev?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function notEkle() {
    if (!notForm.icerik.trim()) return
    await fetch('/api/ekip-notu', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(notForm) })
    setNotForm({ show: false, icerik: '', yazan: 'admin', ilgili_telefon: '', ilgili_siparis: '', ilgili_tip: 'genel' })
    load()
  }

  async function notSil(id: number) {
    if (!confirm('Bu notu silmek istediğinize emin misiniz?')) return
    await fetch(`/api/ekip-notu?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function aramaEkle() {
    if (!aramaForm.telefon.trim()) return
    await fetch('/api/arama-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...aramaForm, sure_dakika: parseInt(aramaForm.sure_dakika) || 0 }) })
    setAramaForm({ show: false, telefon: '', musteri_adi: '', sure_dakika: '', notlar: '', sonuc: 'tamamlandi', arayan: 'admin' })
    load()
  }

  const filteredGorevler = gorevler.filter(g => filter === 'all' || g.durum === filter)
  const bekleyenCount = gorevler.filter(g => g.durum === 'bekliyor').length
  const acilCount = gorevler.filter(g => g.oncelik === 'acil' && g.durum !== 'tamamlandi').length

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1280, margin: "0 auto" }}>
      <header className="mb-6">
        <p className="text-xs uppercase tracking-[0.3em] text-stone mb-2">iş takibi</p>
        <div className="flex items-baseline justify-between">
          <h1 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] tracking-tight">Çalışma</h1>
          <button onClick={load} className="w-9 h-9 flex items-center justify-center bg-[var(--bg-card2)] border border-[var(--border-gold)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-body)]">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Acil uyarı */}
      {acilCount > 0 && (
        <div className="mb-4 bg-ruby/10 border border-ember-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertCircle className="w-4 h-4 text-ruby-light shrink-0" strokeWidth={1.5} />
          <span className="text-ember-700 text-sm font-medium">{acilCount} acil görev bekliyor!</span>
          <button onClick={() => { setTab('gorevler'); setFilter('bekliyor') }} className="ml-auto text-xs text-ruby-light underline">Göster</button>
        </div>
      )}

      {/* Tab + Yeni buton */}
      <div className="flex items-center justify-between mb-6 gap-3 flex-wrap">
        <div className="flex bg-[var(--bg-card2)] border border-[var(--border-gold)] rounded-xl p-1 gap-1">
          {[
            { v: 'gorevler', l: `✅ Görevler${bekleyenCount > 0 ? ` (${bekleyenCount})` : ''}` },
            { v: 'notlar', l: `📝 Ekip Notları` },
            { v: 'aramalar', l: `📞 Arama Logu` },
          ].map(t => (
            <button key={t.v} onClick={() => setTab(t.v as any)}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-all ${tab === t.v ? 'bg-[var(--text-primary)] text-[var(--bg-base)]' : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}>
              {t.l}
            </button>
          ))}
        </div>
        <button
          onClick={() => {
            if (tab === 'gorevler') setGorevForm(f => ({ ...f, show: true }))
            if (tab === 'notlar') setNotForm(f => ({ ...f, show: true }))
            if (tab === 'aramalar') setAramaForm(f => ({ ...f, show: true }))
          }}
          className="flex items-center gap-2 px-4 py-2 bg-ink-900 text-cream-50 rounded-xl text-sm font-medium hover:bg-stone transition-colors"
        >
          <Plus className="w-4 h-4" />
          {tab === 'gorevler' ? 'Görev Ekle' : tab === 'notlar' ? 'Not Ekle' : 'Arama Kaydet'}
        </button>
      </div>

      {/* GÖREVLER */}
      {tab === 'gorevler' && (
        <>
          <div className="flex gap-2 mb-4">
            {[{v:'bekliyor',l:'Bekleyen'},{v:'devam',l:'Devam'},{v:'tamamlandi',l:'Tamamlanan'},{v:'all',l:'Hepsi'}].map(f => (
              <button key={f.v} onClick={() => setFilter(f.v as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all ${filter === f.v ? 'bg-[var(--text-primary)] text-[var(--bg-base)]' : 'bg-obsidian-3 border border-gold-subtle text-stone-light'}`}>
                {f.l}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            {loading ? [1,2,3].map(i => <div key={i} className="h-20 bg-[var(--bg-card2)] rounded-xl animate-pulse" />) :
            filteredGorevler.map(g => (
              <div key={g.id} className={`bg-[var(--bg-card)] border rounded-xl p-4 transition-colors ${g.durum === 'tamamlandi' ? 'border-stone/20 opacity-60' : g.oncelik === 'acil' ? 'border-ember-200' : 'border-gold-subtle'}`}>
                <div className="flex items-start gap-3">
                  <button onClick={() => gorevDurumGuncelle(g.id, g.durum === 'tamamlandi' ? 'bekliyor' : 'tamamlandi')}
                    className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${g.durum === 'tamamlandi' ? 'bg-moss-500 border-moss-500 text-white' : 'border-cream-300 hover:border-moss-400'}`}>
                    {g.durum === 'tamamlandi' && <Check className="w-3 h-3" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${g.durum === 'tamamlandi' ? 'line-through text-[var(--text-muted)]' : 'text-[var(--text-primary)]'}`}>{g.baslik}</div>
                    {g.aciklama && <div className="text-xs text-[var(--text-muted)] mt-0.5">{g.aciklama}</div>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ONCELIK_COLOR[g.oncelik]}`}>{g.oncelik}</span>
                      {g.ilgili_telefon && <span className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{g.ilgili_telefon}</span>}
                      {g.ilgili_siparis && <span className="text-[10px] text-stone-light font-mono">{g.ilgili_siparis}</span>}
                      {g.bitis_tarihi && <span className={`text-[10px] font-mono flex items-center gap-1 ${new Date(g.bitis_tarihi) < new Date() && g.durum !== 'tamamlandi' ? 'text-ruby-light' : 'text-[var(--text-muted)]'}`}><Clock className="w-2.5 h-2.5" />{format(new Date(g.bitis_tarihi), 'd MMM', { locale: tr })}</span>}
                      <span className="text-[10px] text-[var(--text-muted)] font-mono">{formatDistanceToNow(new Date(g.created_at), { addSuffix: true, locale: tr })}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {g.durum !== 'tamamlandi' && (
                      <button onClick={() => gorevDurumGuncelle(g.id, g.durum === 'devam' ? 'bekliyor' : 'devam')}
                        className="text-[10px] px-2 py-1 bg-[var(--bg-card2)] text-[var(--text-muted)] rounded-lg hover:bg-[var(--bg-card)] transition-colors">
                        {g.durum === 'devam' ? 'Duraklat' : 'Başlat'}
                      </button>
                    )}
                    <button onClick={() => gorevSil(g.id)} className="w-7 h-7 flex items-center justify-center text-[var(--text-muted)] hover:text-ruby-light transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {!loading && filteredGorevler.length === 0 && (
              <div className="p-12 text-center bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl">
                <Check className="w-10 h-10 mx-auto text-moss-300 mb-3" strokeWidth={1.5} />
                <p className="text-sm text-[var(--text-muted)]">Bekleyen görev yok</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* EKİP NOTLARI */}
      {tab === 'notlar' && (
        <div className="space-y-3">
          {loading ? [1,2,3].map(i => <div key={i} className="h-20 bg-[var(--bg-card2)] rounded-xl animate-pulse" />) :
          notlar.map(n => (
            <div key={n.id} className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-[var(--text-body)] bg-[var(--bg-card2)] px-2 py-0.5 rounded-full">{n.yazan}</span>
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: tr })}</span>
                    {n.ilgili_tip !== 'genel' && <span className="text-[10px] bg-[var(--bg-card2)] text-[var(--gold)] px-1.5 py-0.5 rounded-full font-medium">{n.ilgili_tip}</span>}
                  </div>
                  <p className="text-sm text-[var(--text-body)]">{n.icerik}</p>
                  <div className="flex items-center gap-3 mt-2">
                    {n.ilgili_telefon && <span className="text-[10px] text-[var(--text-muted)] font-mono flex items-center gap-1"><Phone className="w-2.5 h-2.5" />{n.ilgili_telefon}</span>}
                    {n.ilgili_siparis && <span className="text-[10px] text-[var(--text-muted)] font-mono">{n.ilgili_siparis}</span>}
                  </div>
                </div>
                <button onClick={() => notSil(n.id)} className="text-[var(--text-muted)] hover:text-ruby-light transition-colors shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {!loading && notlar.length === 0 && (
            <div className="p-12 text-center bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl">
              <MessageSquare className="w-10 h-10 mx-auto text-cream-300 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-[var(--text-muted)]">Henüz ekip notu yok</p>
            </div>
          )}
        </div>
      )}

      {/* ARAMA LOGU */}
      {tab === 'aramalar' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl overflow-hidden">
          {loading ? <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="h-14 bg-[var(--bg-card2)] rounded-xl animate-pulse" />)}</div> : (
            <table className="w-full">
              <thead className="bg-transparent">
                <tr>{['Tarih','Müşteri','Telefon','Süre','Sonuç','Notlar',''].map(h => (
                  <th key={h} className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {aramalar.map(a => (
                  <tr key={a.id} className="border-t border-[var(--border-dim)] hover:bg-transparent transition-colors">
                    <td className="px-5 py-3 text-xs text-[var(--text-muted)] font-mono">{format(new Date(a.created_at), 'd MMM HH:mm', { locale: tr })}</td>
                    <td className="px-5 py-3 text-sm text-[var(--text-body)]">{a.musteri_adi || '—'}</td>
                    <td className="px-5 py-3 font-mono text-sm text-[var(--text-muted)]">{a.telefon}</td>
                    <td className="px-5 py-3 text-xs text-[var(--text-muted)] font-mono">{a.sure_dakika > 0 ? `${a.sure_dakika} dk` : '—'}</td>
                    <td className="px-5 py-3"><span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${SONUC_COLOR[a.sonuc] || 'bg-[var(--bg-card2)] text-[var(--text-muted)]'}`}>{SONUC_LABEL[a.sonuc] || a.sonuc}</span></td>
                    <td className="px-5 py-3 text-xs text-stone-light max-w-[200px] truncate">{a.notlar || '—'}</td>
                    <td className="px-5 py-3 text-xs text-[var(--text-muted)] font-mono">{a.arayan}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {!loading && aramalar.length === 0 && (
            <div className="p-12 text-center">
              <Phone className="w-10 h-10 mx-auto text-cream-300 mb-3" strokeWidth={1.5} />
              <p className="text-sm text-[var(--text-muted)]">Henüz arama kaydı yok</p>
            </div>
          )}
        </div>
      )}

      {/* GÖREV FORM MODAL */}
      {gorevForm.show && (
        <Modal title="Görev Ekle" onClose={() => setGorevForm(f => ({ ...f, show: false }))}>
          <div className="space-y-3">
            <Field label="Başlık *">
              <input value={gorevForm.baslik} onChange={e => setGorevForm(f => ({ ...f, baslik: e.target.value }))} placeholder="Görevi tanımla..." className={inputCls} />
            </Field>
            <Field label="Açıklama">
              <textarea value={gorevForm.aciklama} onChange={e => setGorevForm(f => ({ ...f, aciklama: e.target.value }))} rows={2} placeholder="Opsiyonel detay..." className={`${inputCls} resize-none`} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Öncelik">
                <select value={gorevForm.oncelik} onChange={e => setGorevForm(f => ({ ...f, oncelik: e.target.value }))} className={inputCls}>
                  <option value="dusuk">Düşük</option>
                  <option value="normal">Normal</option>
                  <option value="yuksek">Yüksek</option>
                  <option value="acil">🔴 Acil</option>
                </select>
              </Field>
              <Field label="Bitiş Tarihi">
                <input type="date" value={gorevForm.bitis_tarihi} onChange={e => setGorevForm(f => ({ ...f, bitis_tarihi: e.target.value }))} className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="SMS Saati (opsiyonel)">
                <input type="time" value={gorevForm.sms_saati} onChange={e => setGorevForm(f => ({ ...f, sms_saati: e.target.value }))} className={inputCls} />
              </Field>
              <Field label="SMS Telefon">
                <input value={gorevForm.sms_telefon} onChange={e => setGorevForm(f => ({ ...f, sms_telefon: e.target.value }))} placeholder="905xx..." className={inputCls} />
              </Field>
            </div>
            <Field label="İlgili Telefon">
              <input value={gorevForm.ilgili_telefon} onChange={e => setGorevForm(f => ({ ...f, ilgili_telefon: e.target.value }))} placeholder="905xx..." className={inputCls} />
            </Field>
            <button onClick={gorevEkle} className="w-full py-3 bg-[var(--text-primary)] text-[var(--bg-base)] rounded-xl text-sm font-medium hover:opacity-80 transition-colors">Görev Ekle</button>
          </div>
        </Modal>
      )}

      {/* NOT FORM MODAL */}
      {notForm.show && (
        <Modal title="Ekip Notu Ekle" onClose={() => setNotForm(f => ({ ...f, show: false }))}>
          <div className="space-y-3">
            <Field label="Not *">
              <textarea value={notForm.icerik} onChange={e => setNotForm(f => ({ ...f, icerik: e.target.value }))} rows={3} placeholder="Notu yaz..." className={`${inputCls} resize-none`} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Yazan">
                <input value={notForm.yazan} onChange={e => setNotForm(f => ({ ...f, yazan: e.target.value }))} placeholder="admin" className={inputCls} />
              </Field>
              <Field label="Tür">
                <select value={notForm.ilgili_tip} onChange={e => setNotForm(f => ({ ...f, ilgili_tip: e.target.value }))} className={inputCls}>
                  <option value="genel">Genel</option>
                  <option value="siparis">Sipariş</option>
                  <option value="musteri">Müşteri</option>
                  <option value="teslimat">Teslimat</option>
                  <option value="sorun">Sorun</option>
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="İlgili Telefon">
                <input value={notForm.ilgili_telefon} onChange={e => setNotForm(f => ({ ...f, ilgili_telefon: e.target.value }))} placeholder="905xx..." className={inputCls} />
              </Field>
              <Field label="İlgili Sipariş">
                <input value={notForm.ilgili_siparis} onChange={e => setNotForm(f => ({ ...f, ilgili_siparis: e.target.value }))} placeholder="#MİL1142" className={inputCls} />
              </Field>
            </div>
            <button onClick={notEkle} className="w-full py-3 bg-[var(--text-primary)] text-[var(--bg-base)] rounded-xl text-sm font-medium hover:opacity-80 transition-colors">Notu Kaydet</button>
          </div>
        </Modal>
      )}

      {/* ARAMA FORM MODAL */}
      {aramaForm.show && (
        <Modal title="Arama Kaydet" onClose={() => setAramaForm(f => ({ ...f, show: false }))}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Telefon *">
                <input value={aramaForm.telefon} onChange={e => setAramaForm(f => ({ ...f, telefon: e.target.value }))} placeholder="905xx..." className={inputCls} />
              </Field>
              <Field label="Müşteri Adı">
                <input value={aramaForm.musteri_adi} onChange={e => setAramaForm(f => ({ ...f, musteri_adi: e.target.value }))} placeholder="Ad Soyad" className={inputCls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Süre (dakika)">
                <input type="number" value={aramaForm.sure_dakika} onChange={e => setAramaForm(f => ({ ...f, sure_dakika: e.target.value }))} placeholder="5" className={inputCls} />
              </Field>
              <Field label="Sonuç">
                <select value={aramaForm.sonuc} onChange={e => setAramaForm(f => ({ ...f, sonuc: e.target.value }))} className={inputCls}>
                  <option value="tamamlandi">Tamamlandı</option>
                  <option value="cevapsiz">Cevapsız</option>
                  <option value="geri_aranacak">Geri Aranacak</option>
                  <option value="mesaj_birakildi">Mesaj Bırakıldı</option>
                </select>
              </Field>
            </div>
            <Field label="Notlar">
              <textarea value={aramaForm.notlar} onChange={e => setAramaForm(f => ({ ...f, notlar: e.target.value }))} rows={3} placeholder="Konuşma özeti..." className={`${inputCls} resize-none`} />
            </Field>
            <Field label="Arayan">
              <input value={aramaForm.arayan} onChange={e => setAramaForm(f => ({ ...f, arayan: e.target.value }))} placeholder="admin" className={inputCls} />
            </Field>
            <button onClick={aramaEkle} className="w-full py-3 bg-[var(--text-primary)] text-[var(--bg-base)] rounded-xl text-sm font-medium hover:opacity-80 transition-colors">Aramayı Kaydet</button>
          </div>
        </Modal>
      )}
    </div>
  )
}

const inputCls = "w-full px-3 py-2.5 bg-transparent border border-[var(--border-gold)] rounded-xl text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--gold)] transition-colors"

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] block mb-1.5">{label}</label>
      {children}
    </div>
  )
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-[rgba(0,0,0,0.4)] backdrop-blur-sm" />
      <div className="relative bg-[var(--bg-card)] rounded-xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="font-display text-2xl text-[var(--text-primary)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-body)]"><X className="w-5 h-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
