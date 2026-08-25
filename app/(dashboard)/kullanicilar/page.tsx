'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, X, Trash2, Edit2, Shield, Eye, EyeOff, RefreshCw, Clock, LogIn } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'

type Kullanici = {
  id: number; ad: string; kullanici_adi: string; rol: string
  aktif: boolean; son_giris: string | null; created_at: string; yetkiler: string[]
}
type Aktivite = {
  id: number; kullanici_adi: string; kullanici_ad: string
  aksiyon: string; sayfa: string; detay: string; created_at: string
}

const ROL_COLOR: Record<string, string> = {
  admin: 'bg-[var(--text-primary)] text-[var(--bg-base)]',
  operasyon: 'bg-[var(--bg-card2)] text-gold',
  destek: 'bg-[rgba(201,168,76,0.1)] text-ink-600',
}
const ROL_LABEL: Record<string, string> = {
  admin: '👑 Admin', operasyon: '⚙️ Operasyon', destek: '💬 Destek'
}
const AKSIYON_ICON: Record<string, string> = {
  giris: '🔑', cikis: '👋', sayfa: '📄', siparis_notu: '📝',
  gorev: '✅', odeme: '💰', bildirim: '📱'
}

export default function KullanicilarPage() {
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([])
  const [aktiviteler, setAktiviteler] = useState<Aktivite[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'kullanicilar' | 'log'>('kullanicilar')
  const [form, setForm] = useState({ show: false, edit: false, id: 0, ad: '', kullanici_adi: '', sifre_hash: '', rol: 'destek', aktif: true })
  const [sifreGoster, setSifreGoster] = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    const [k, a] = await Promise.all([
      fetch('/api/kullanici').then(r => r.json()),
      fetch('/api/aktivite').then(r => r.json()),
    ])
    setKullanicilar(k.kullanicilar || [])
    setAktiviteler(a.aktiviteler || [])
    setLoading(false)
  }

  async function kaydet() {
    if (!form.ad || !form.kullanici_adi || (!form.edit && !form.sifre_hash)) return
    if (form.edit) {
      const updates: any = { ad: form.ad, rol: form.rol, aktif: form.aktif }
      if (form.sifre_hash) updates.sifre_hash = form.sifre_hash
      await fetch('/api/kullanici', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: form.id, ...updates }) })
    } else {
      await fetch('/api/kullanici', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ad: form.ad, kullanici_adi: form.kullanici_adi, sifre_hash: form.sifre_hash, rol: form.rol }) })
    }
    setForm({ show: false, edit: false, id: 0, ad: '', kullanici_adi: '', sifre_hash: '', rol: 'destek', aktif: true })
    load()
  }

  async function sil(id: number) {
    if (!confirm('Bu kullanıcıyı silmek istediğinize emin misiniz?')) return
    await fetch(`/api/kullanici?id=${id}`, { method: 'DELETE' })
    load()
  }

  async function durumDegistir(id: number, aktif: boolean) {
    await fetch('/api/kullanici', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, aktif }) })
    load()
  }

  function duzenle(k: Kullanici) {
    setForm({ show: true, edit: true, id: k.id, ad: k.ad, kullanici_adi: k.kullanici_adi, sifre_hash: '', rol: k.rol, aktif: k.aktif })
  }

  const adminSayisi = kullanicilar.filter(k => k.rol === 'admin').length

  return (
    <div style={{ padding: "32px 28px", maxWidth: 1280, margin: "0 auto" }}>
      <header className="mb-6 flex items-baseline justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-[var(--text-muted)] mb-2">ekip yönetimi</p>
          <h1 className="font-display text-4xl md:text-5xl text-[var(--text-primary)] tracking-tight">Kullanıcılar</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="w-9 h-9 flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl text-[var(--text-muted)] hover:text-[var(--text-body)]">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Özet */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Toplam', value: kullanicilar.length, icon: Users, color: 'bg-[var(--bg-card)] border-[var(--border-gold)]' },
          { label: 'Aktif', value: kullanicilar.filter(k => k.aktif).length, icon: Shield, color: 'bg-moss-50 border-moss-200' },
          { label: 'Admin', value: adminSayisi, icon: Shield, color: 'bg-[var(--text-primary)] border-ink-700 text-[var(--bg-base)]' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`border rounded-xl p-4 md:p-6 ${color}`}>
            <div className={`text-[10px] uppercase tracking-[0.2em] mb-3 ${color.includes('ink-900') ? 'text-stone' : 'text-[var(--text-muted)]'}`}>{label}</div>
            <div className={`font-display text-4xl md:text-4xl ${color.includes('ink-900') ? 'text-[var(--bg-base)]' : 'text-cream'}`}>{value}</div>
          </div>
        ))}
      </div>

      {/* Tablar */}
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl p-1 gap-1">
          {[{v:'kullanicilar',l:'👥 Kullanıcılar'},{v:'log',l:'📋 Aktivite Logu'}].map(t => (
            <button key={t.v} onClick={() => setTab(t.v as any)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.v ? 'bg-[var(--text-primary)] text-[var(--bg-base)]' : 'text-[var(--text-muted)] hover:text-[var(--text-body)]'}`}>
              {t.l}
            </button>
          ))}
        </div>
        {tab === 'kullanicilar' && (
          <button onClick={() => setForm({ show: true, edit: false, id: 0, ad: '', kullanici_adi: '', sifre_hash: '', rol: 'destek', aktif: true })}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--text-primary)] text-[var(--bg-base)] rounded-xl text-sm font-medium hover:opacity-80 transition-colors">
            <Plus className="w-4 h-4" />Kullanıcı Ekle
          </button>
        )}
      </div>

      {/* Kullanıcı listesi */}
      {tab === 'kullanicilar' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl overflow-hidden">
          {loading ? <div className="p-4 space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 bg-[var(--bg-card2)] rounded-xl animate-pulse" />)}</div> : (
            <table className="w-full">
              <thead className="bg-transparent">
                <tr>{['Kullanıcı','Kullanıcı Adı','Rol','Durum','Son Giriş','Kayıt',''].map(h => (
                  <th key={h} className="px-5 py-4 text-left text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)]">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {kullanicilar.map(k => (
                  <tr key={k.id} className="border-t border-[var(--border-dim)] hover:bg-transparent transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold ${ROL_COLOR[k.rol]}`}>
                          {k.ad.slice(0,1).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-[var(--text-primary)]">{k.ad}</div>
                          {!k.aktif && <div className="text-[10px] text-ruby-light font-mono">devre dışı</div>}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 font-mono text-sm text-[var(--text-muted)]">@{k.kullanici_adi}</td>
                    <td className="px-5 py-4">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${ROL_COLOR[k.rol]}`}>
                        {ROL_LABEL[k.rol] || k.rol}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <button onClick={() => durumDegistir(k.id, !k.aktif)}
                        className={`w-10 h-5 rounded-full transition-colors relative ${k.aktif ? 'bg-moss-500' : 'bg-[rgba(201,168,76,0.18)]'}`}>
                        <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--bg-card)] shadow transition-transform ${k.aktif ? 'translate-x-5' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--text-muted)] font-mono">
                      {k.son_giris ? formatDistanceToNow(new Date(k.son_giris), { addSuffix: true, locale: tr }) : '—'}
                    </td>
                    <td className="px-5 py-4 text-xs text-[var(--text-muted)] font-mono">
                      {format(new Date(k.created_at), 'd MMM yyyy', { locale: tr })}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <button onClick={() => duzenle(k)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[var(--bg-card2)] text-[var(--text-muted)] hover:text-[var(--text-body)] transition-colors">
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {k.rol !== 'admin' || adminSayisi > 1 ? (
                          <button onClick={() => sil(k.id)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-ruby/10 text-[var(--text-muted)] hover:text-ruby-light transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Aktivite logu */}
      {tab === 'log' && (
        <div className="bg-[var(--bg-card)] border border-[var(--border-gold)] rounded-xl overflow-hidden">
          {loading ? <div className="p-4 space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-[var(--bg-card2)] rounded-xl animate-pulse" />)}</div> : (
            <div className="divide-y divide-cream-100">
              {aktiviteler.map(a => (
                <div key={a.id} className="px-5 py-3 flex items-center gap-4">
                  <span className="text-xl shrink-0">{AKSIYON_ICON[a.aksiyon] || '📌'}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-[var(--text-primary)]">{a.kullanici_ad}</span>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">@{a.kullanici_adi}</span>
                      <span className="text-xs text-[var(--text-muted)]">{a.detay}</span>
                    </div>
                    {a.sayfa && <div className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{a.sayfa}</div>}
                  </div>
                  <div className="text-xs text-[var(--text-muted)] font-mono shrink-0">
                    {formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: tr })}
                  </div>
                </div>
              ))}
              {aktiviteler.length === 0 && (
                <div className="p-12 text-center">
                  <LogIn className="w-10 h-10 mx-auto text-cream-300 mb-3" strokeWidth={1.5} />
                  <p className="text-sm text-[var(--text-muted)]">Henüz aktivite yok</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Kullanıcı form modal */}
      {form.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setForm(f => ({ ...f, show: false }))}>
          <div className="absolute inset-0 bg-[var(--text-primary)]/40 backdrop-blur-sm" />
          <div className="relative bg-[var(--bg-card)] rounded-xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-display text-2xl text-[var(--text-primary)]">{form.edit ? 'Kullanıcı Düzenle' : 'Kullanıcı Ekle'}</h2>
              <button onClick={() => setForm(f => ({ ...f, show: false }))} className="text-[var(--text-muted)] hover:text-[var(--text-body)]"><X className="w-5 h-5" /></button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] block mb-1.5">Ad Soyad *</label>
                <input value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} placeholder="Ali Yılmaz"
                  className="w-full px-3 py-2.5 bg-transparent border border-[var(--border-gold)] rounded-xl text-sm text-[var(--text-body)] focus:outline-none focus:border-gold-dim" />
              </div>
              {!form.edit && (
                <div>
                  <label className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] block mb-1.5">Kullanıcı Adı *</label>
                  <input value={form.kullanici_adi} onChange={e => setForm(f => ({ ...f, kullanici_adi: e.target.value.toLowerCase().replace(/\s/g, '') }))} placeholder="ali.yilmaz"
                    className="w-full px-3 py-2.5 bg-transparent border border-[var(--border-gold)] rounded-xl text-sm text-[var(--text-body)] font-mono focus:outline-none focus:border-gold-dim" />
                </div>
              )}
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] block mb-1.5">{form.edit ? 'Yeni Şifre (boş bırakırsan değişmez)' : 'Şifre *'}</label>
                <div className="relative">
                  <input type={sifreGoster ? 'text' : 'password'} value={form.sifre_hash} onChange={e => setForm(f => ({ ...f, sifre_hash: e.target.value }))} placeholder="••••••••"
                    className="w-full px-3 py-2.5 pr-10 bg-transparent border border-[var(--border-gold)] rounded-xl text-sm text-[var(--text-body)] focus:outline-none focus:border-gold-dim" />
                  <button onClick={() => setSifreGoster(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]">
                    {sifreGoster ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-[0.2em] text-[var(--text-muted)] block mb-1.5">Rol *</label>
                <select value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-transparent border border-[var(--border-gold)] rounded-xl text-sm text-[var(--text-body)] focus:outline-none focus:border-gold-dim">
                  <option value="admin">👑 Admin — Tam yetki</option>
                  <option value="operasyon">⚙️ Operasyon — Siparişler, teslimat, çalışma</option>
                  <option value="destek">💬 Destek — Konuşmalar, canlı destek</option>
                </select>
              </div>

              {/* Rol yetkiler özeti */}
              <div className={`p-3 rounded-xl text-xs space-y-1 ${form.rol === 'admin' ? 'bg-[var(--text-primary)] text-cream-300' : form.rol === 'operasyon' ? 'bg-moss-50 text-gold' : 'bg-[var(--bg-card2)] text-[var(--text-muted)]'}`}>
                <div className="font-medium mb-1">{ROL_LABEL[form.rol]} erişebilir:</div>
                {form.rol === 'admin' && <div>✓ Tüm sayfalar, kullanıcı yönetimi, sistem ayarları</div>}
                {form.rol === 'operasyon' && <>
                  <div>✓ Siparişler, Müşteriler, Satış Analitik</div>
                  <div>✓ Abonelikler, Ödemeler, Muhasebe, Harita</div>
                  <div>✓ Çalışma, Raporlar</div>
                  <div>✗ Kullanıcı yönetimi, Canlı Destek, Reklamlar</div>
                </>}
                {form.rol === 'destek' && <>
                  <div>✓ Konuşmalar, Canlı Destek, Çalışma</div>
                  <div>✗ Siparişler, Ödemeler, Muhasebe ve diğerleri</div>
                </>}
              </div>

              {form.edit && (
                <div className="flex items-center gap-3">
                  <button onClick={() => setForm(f => ({ ...f, aktif: !f.aktif }))}
                    className={`w-10 h-5 rounded-full transition-colors relative ${form.aktif ? 'bg-moss-500' : 'bg-[rgba(201,168,76,0.18)]'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-[var(--bg-card)] shadow transition-transform ${form.aktif ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </button>
                  <span className="text-sm text-ink-600">{form.aktif ? 'Kullanıcı aktif' : 'Kullanıcı devre dışı'}</span>
                </div>
              )}

              <button onClick={kaydet} className="w-full py-3 bg-[var(--text-primary)] text-[var(--bg-base)] rounded-xl text-sm font-medium hover:opacity-80 transition-colors">
                {form.edit ? 'Değişiklikleri Kaydet' : 'Kullanıcı Oluştur'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
