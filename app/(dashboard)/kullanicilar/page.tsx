'use client'

import { useEffect, useState } from 'react'
import { Users, Plus, X, Trash2, Edit2, Shield, Eye, EyeOff, RefreshCw, LogIn } from 'lucide-react'
import { format, formatDistanceToNow } from 'date-fns'
import { tr } from 'date-fns/locale'
import TopBar from '@/components/TopBar'
import StatCard from '@/components/StatCard'
import ConfirmModal from '@/components/ConfirmModal'

type Kullanici = {
  id: number; ad: string; kullanici_adi: string; rol: string
  aktif: boolean; son_giris: string | null; created_at: string; yetkiler: string[]
}
type Aktivite = {
  id: number; kullanici_adi: string; kullanici_ad: string
  aksiyon: string; sayfa: string; detay: string; created_at: string
}

const ROL_BADGE: Record<string, string> = { admin: 'badge-ac', operasyon: 'badge-blue', destek: 'badge-green' }
const ROL_LABEL: Record<string, string> = { admin: '👑 Admin', operasyon: '⚙️ Operasyon', destek: '💬 Destek' }
const AKSIYON_ICON: Record<string, string> = {
  giris: '🔑', cikis: '👋', sayfa: '📄', siparis_notu: '📝', gorev: '✅', odeme: '💰', bildirim: '📱',
}
const EMPTY_FORM = { show: false, edit: false, id: 0, ad: '', kullanici_adi: '', sifre_hash: '', rol: 'destek', aktif: true }
const mono = 'JetBrains Mono, monospace'

export default function KullanicilarPage() {
  const [kullanicilar, setKullanicilar] = useState<Kullanici[]>([])
  const [aktiviteler, setAktiviteler] = useState<Aktivite[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'kullanicilar' | 'log'>('kullanicilar')
  const [form, setForm] = useState(EMPTY_FORM)
  const [sifreGoster, setSifreGoster] = useState(false)
  const [silinecek, setSilinecek] = useState<number | null>(null)

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
    setForm(EMPTY_FORM)
    load()
  }

  async function sil(id: number) {
    await fetch(`/api/kullanici?id=${id}`, { method: 'DELETE' })
    setSilinecek(null)
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
  const close = () => setForm(f => ({ ...f, show: false }))

  const toggle = (on: boolean, onClick: () => void) => (
    <button onClick={onClick} aria-pressed={on} style={{ width: 38, height: 20, borderRadius: 999, border: 'none', position: 'relative', background: on ? 'var(--green)' : 'var(--s5)', transition: 'background .15s', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
    </button>
  )

  const th = (h: string, i: number) => <th key={i} className="kpi-label" style={{ padding: '12px 18px', textAlign: 'left', marginBottom: 0, borderBottom: '1px solid var(--bdr)' }}>{h}</th>
  const td: React.CSSProperties = { padding: '12px 18px', borderBottom: '1px solid var(--bdr)' }

  return (
    <>
      <TopBar title="Kullanıcılar" subtitle="ekip yönetimi" action={<button className="btn-ghost" onClick={load} title="Yenile" style={{ padding: 8 }}><RefreshCw size={14} /></button>} />

      <div className="tabs" style={{ paddingLeft: 12 }}>
        <button className={`tab${tab === 'kullanicilar' ? ' active' : ''}`} onClick={() => setTab('kullanicilar')}>Kullanıcılar</button>
        <button className={`tab${tab === 'log' ? ' active' : ''}`} onClick={() => setTab('log')}>Aktivite Logu</button>
      </div>

      <div style={{ padding: 22, maxWidth: 1200, width: '100%', margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(170px,1fr))', gap: 14, marginBottom: 18 }}>
          <StatCard label="Toplam" value={kullanicilar.length} sub="kullanıcı" Icon={Users} accent="var(--ac)" />
          <StatCard label="Aktif" value={kullanicilar.filter(k => k.aktif).length} sub="erişimi açık" Icon={Shield} accent="var(--green)" />
          <StatCard label="Admin" value={adminSayisi} sub="tam yetkili" Icon={Shield} accent="var(--amber)" />
        </div>

        {tab === 'kullanicilar' && (
          <div className="card">
            <div className="card-h">
              <span className="card-title">Ekip</span>
              <button className="btn" onClick={() => setForm({ ...EMPTY_FORM, show: true })}><Plus size={14} /> Kullanıcı Ekle</button>
            </div>
            {loading ? (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>{[1, 2, 3].map(i => <div key={i} className="anim-pulse" style={{ height: 52, background: 'var(--s3)', borderRadius: 10 }} />)}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
                  <thead><tr>{['Kullanıcı', 'Kullanıcı Adı', 'Rol', 'Durum', 'Son Giriş', 'Kayıt', ''].map(th)}</tr></thead>
                  <tbody>
                    {kullanicilar.map(k => (
                      <tr key={k.id} className="row" style={{ display: 'table-row' }}>
                        <td style={td}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                            <div style={{ width: 34, height: 34, borderRadius: 10, background: 'var(--ac2)', color: 'var(--ac)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700 }}>{k.ad.slice(0, 1).toUpperCase()}</div>
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{k.ad}</div>
                              {!k.aktif && <div style={{ fontSize: 10, color: 'var(--red)', fontFamily: mono }}>devre dışı</div>}
                            </div>
                          </div>
                        </td>
                        <td style={{ ...td, fontFamily: mono, fontSize: 12.5, color: 'var(--tx3)' }}>@{k.kullanici_adi}</td>
                        <td style={td}><span className={`badge ${ROL_BADGE[k.rol] || 'badge-muted'}`}>{ROL_LABEL[k.rol] || k.rol}</span></td>
                        <td style={td}>{toggle(k.aktif, () => durumDegistir(k.id, !k.aktif))}</td>
                        <td style={{ ...td, fontSize: 12, color: 'var(--tx3)', fontFamily: mono }}>{k.son_giris ? formatDistanceToNow(new Date(k.son_giris), { addSuffix: true, locale: tr }) : '—'}</td>
                        <td style={{ ...td, fontSize: 12, color: 'var(--tx3)', fontFamily: mono }}>{format(new Date(k.created_at), 'd MMM yyyy', { locale: tr })}</td>
                        <td style={td}>
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button onClick={() => duzenle(k)} title="Düzenle" style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6 }}><Edit2 size={14} /></button>
                            {(k.rol !== 'admin' || adminSayisi > 1) && (
                              <button onClick={() => setSilinecek(k.id)} title="Sil" style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6 }}><Trash2 size={14} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {tab === 'log' && (
          <div className="card">
            <div className="card-h"><span className="card-title">Aktivite Logu</span></div>
            {loading ? (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>{[1, 2, 3, 4, 5].map(i => <div key={i} className="anim-pulse" style={{ height: 44, background: 'var(--s3)', borderRadius: 10 }} />)}</div>
            ) : aktiviteler.length === 0 ? (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <LogIn size={30} style={{ color: 'var(--tx3)', opacity: .5, margin: '0 auto 10px', display: 'block' }} strokeWidth={1.4} />
                <p style={{ fontSize: 13, color: 'var(--tx2)' }}>Henüz aktivite yok</p>
              </div>
            ) : aktiviteler.map(a => (
              <div key={a.id} className="row" style={{ gap: 14 }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>{AKSIYON_ICON[a.aksiyon] || '📌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--tx)' }}>{a.kullanici_ad}</span>
                    <span style={{ fontSize: 10.5, fontFamily: mono, color: 'var(--tx3)' }}>@{a.kullanici_adi}</span>
                    <span style={{ fontSize: 12, color: 'var(--tx2)' }}>{a.detay}</span>
                  </div>
                  {a.sayfa && <div style={{ fontSize: 10.5, color: 'var(--tx3)', fontFamily: mono, marginTop: 2 }}>{a.sayfa}</div>}
                </div>
                <div style={{ fontSize: 11.5, color: 'var(--tx3)', fontFamily: mono, flexShrink: 0 }}>{formatDistanceToNow(new Date(a.created_at), { addSuffix: true, locale: tr })}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {form.show && (
        <div className="overlay" onClick={e => { if (e.target === e.currentTarget) close() }}>
          <div className="modal anim-pop" style={{ maxWidth: 440 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 className="modal-title" style={{ marginBottom: 0 }}>{form.edit ? 'Kullanıcı Düzenle' : 'Kullanıcı Ekle'}</h2>
              <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div><label className="label">Ad Soyad *</label><input className="inp" value={form.ad} onChange={e => setForm(f => ({ ...f, ad: e.target.value }))} placeholder="Ali Yılmaz" /></div>
              {!form.edit && (
                <div><label className="label">Kullanıcı Adı *</label><input className="inp" value={form.kullanici_adi} onChange={e => setForm(f => ({ ...f, kullanici_adi: e.target.value.toLowerCase().replace(/\s/g, '') }))} placeholder="ali.yilmaz" style={{ fontFamily: mono }} /></div>
              )}
              <div>
                <label className="label">{form.edit ? 'Yeni Şifre (boş bırakırsan değişmez)' : 'Şifre *'}</label>
                <div style={{ position: 'relative' }}>
                  <input className="inp" type={sifreGoster ? 'text' : 'password'} value={form.sifre_hash} onChange={e => setForm(f => ({ ...f, sifre_hash: e.target.value }))} placeholder="••••••••" style={{ paddingRight: 40 }} autoComplete="new-password" />
                  <button onClick={() => setSifreGoster(s => !s)} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--tx3)' }}>
                    {sifreGoster ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="label">Rol *</label>
                <select className="inp" value={form.rol} onChange={e => setForm(f => ({ ...f, rol: e.target.value }))}>
                  <option value="admin">👑 Admin — Tam yetki</option>
                  <option value="operasyon">⚙️ Operasyon — Müşteriler, raporlar</option>
                  <option value="destek">💬 Destek — Konuşmalar, canlı destek</option>
                </select>
              </div>

              <div style={{ padding: 12, borderRadius: 10, background: 'var(--s3)', border: '1px solid var(--bdr)', fontSize: 12, color: 'var(--tx2)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                <div style={{ fontWeight: 600, color: 'var(--tx)', marginBottom: 2 }}>{ROL_LABEL[form.rol]} erişebilir:</div>
                {form.rol === 'admin' && <div>✓ Tüm sayfalar, kullanıcı yönetimi, sistem ayarları</div>}
                {form.rol === 'operasyon' && <>
                  <div>✓ Genel Bakış, Müşteriler, Çalışma, Takvim</div>
                  <div>✓ Raporlar</div>
                  <div>✗ Konuşmalar, Canlı Destek, Rapor İlet, Kullanıcılar</div>
                </>}
                {form.rol === 'destek' && <>
                  <div>✓ Genel Bakış, Konuşmalar, Canlı Destek</div>
                  <div>✓ Çalışma, Takvim</div>
                  <div>✗ Müşteriler, Raporlar, Kullanıcılar</div>
                </>}
              </div>

              {form.edit && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {toggle(form.aktif, () => setForm(f => ({ ...f, aktif: !f.aktif })))}
                  <span style={{ fontSize: 13, color: 'var(--tx2)' }}>{form.aktif ? 'Kullanıcı aktif' : 'Kullanıcı devre dışı'}</span>
                </div>
              )}

              <button className="btn" onClick={kaydet} style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }}>{form.edit ? 'Değişiklikleri Kaydet' : 'Kullanıcı Oluştur'}</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={silinecek !== null}
        title="Kullanıcıyı sil"
        message="Bu kullanıcıyı silmek istediğinize emin misiniz?"
        onConfirm={() => silinecek !== null && sil(silinecek)}
        onCancel={() => setSilinecek(null)}
      />
    </>
  )
}
