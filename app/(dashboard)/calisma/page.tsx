'use client'

import { useEffect, useState } from 'react'
import TopBar from '@/components/TopBar'
import ConfirmModal from '@/components/ConfirmModal'
import { Plus, X, Check, Clock, Phone, MessageSquare, Trash2, AlertCircle, RefreshCw } from 'lucide-react'
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

const ONCELIK_BADGE: Record<string, string> = { dusuk: 'badge-muted', normal: 'badge-blue', yuksek: 'badge-amber', acil: 'badge-red' }
const SONUC_BADGE: Record<string, string> = { tamamlandi: 'badge-green', cevapsiz: 'badge-red', geri_aranacak: 'badge-amber', mesaj_birakildi: 'badge-blue' }
const SONUC_LABEL: Record<string, string> = { tamamlandi: 'Tamamlandı', cevapsiz: 'Cevapsız', geri_aranacak: 'Geri Aranacak', mesaj_birakildi: 'Mesaj Bırakıldı' }

const EMPTY_GOREV = { show: false, baslik: '', aciklama: '', oncelik: 'normal', ilgili_telefon: '', ilgili_siparis: '', bitis_tarihi: '', sms_saati: '', sms_telefon: '' }
const EMPTY_NOT = { show: false, icerik: '', yazan: 'admin', ilgili_telefon: '', ilgili_siparis: '', ilgili_tip: 'genel' }
const EMPTY_ARAMA = { show: false, telefon: '', musteri_adi: '', sure_dakika: '', notlar: '', sonuc: 'tamamlandi', arayan: 'admin' }

export default function CalismaPage() {
  const [tab, setTab] = useState<'gorevler' | 'notlar' | 'aramalar'>('gorevler')
  const [gorevler, setGorevler] = useState<Gorev[]>([])
  const [notlar, setNotlar] = useState<EkipNotu[]>([])
  const [aramalar, setAramalar] = useState<AramaLog[]>([])
  const [loading, setLoading] = useState(true)
  const [gorevForm, setGorevForm] = useState(EMPTY_GOREV)
  const [notForm, setNotForm] = useState(EMPTY_NOT)
  const [aramaForm, setAramaForm] = useState(EMPTY_ARAMA)
  const [filter, setFilter] = useState<'all' | 'bekliyor' | 'devam' | 'tamamlandi'>('bekliyor')
  const [silNotId, setSilNotId] = useState<number | null>(null)

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
    setGorevForm(EMPTY_GOREV)
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
    setNotForm(EMPTY_NOT)
    load()
  }

  async function notSil(id: number) {
    await fetch(`/api/ekip-notu?id=${id}`, { method: 'DELETE' })
    setSilNotId(null)
    load()
  }

  async function aramaEkle() {
    if (!aramaForm.telefon.trim()) return
    await fetch('/api/arama-log', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...aramaForm, sure_dakika: parseInt(aramaForm.sure_dakika) || 0 }) })
    setAramaForm(EMPTY_ARAMA)
    load()
  }

  const filteredGorevler = gorevler.filter(g => filter === 'all' || g.durum === filter)
  const bekleyenCount = gorevler.filter(g => g.durum === 'bekliyor').length
  const acilCount = gorevler.filter(g => g.oncelik === 'acil' && g.durum !== 'tamamlandi').length

  const tabs = [
    { v: 'gorevler', l: `Görevler${bekleyenCount > 0 ? ` (${bekleyenCount})` : ''}` },
    { v: 'notlar', l: 'Ekip Notları' },
    { v: 'aramalar', l: 'Arama Logu' },
  ] as const

  return (
    <>
      <TopBar
        title="Çalışma"
        subtitle="iş takibi"
        action={
          <>
            <button className="btn-ghost" onClick={load} title="Yenile" style={{ padding: 8 }}><RefreshCw size={14} /></button>
            <button className="btn" onClick={() => {
              if (tab === 'gorevler') setGorevForm(f => ({ ...f, show: true }))
              if (tab === 'notlar') setNotForm(f => ({ ...f, show: true }))
              if (tab === 'aramalar') setAramaForm(f => ({ ...f, show: true }))
            }}>
              <Plus size={14} /> {tab === 'gorevler' ? 'Görev Ekle' : tab === 'notlar' ? 'Not Ekle' : 'Arama Kaydet'}
            </button>
          </>
        }
      />

      <div className="tabs" style={{ paddingLeft: 12 }}>
        {tabs.map(t => (
          <button key={t.v} className={`tab${tab === t.v ? ' active' : ''}`} onClick={() => setTab(t.v)}>{t.l}</button>
        ))}
      </div>

      <div style={{ padding: 22, maxWidth: 1360, width: '100%', margin: '0 auto' }}>

        {acilCount > 0 && (
          <div className="anim-up" style={{ marginBottom: 14, padding: '11px 16px', background: 'var(--red2)', border: '1px solid rgba(242,87,87,.25)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={15} style={{ color: 'var(--red)', flexShrink: 0 }} />
            <span style={{ color: 'var(--red)', fontSize: 13, fontWeight: 600 }}>{acilCount} acil görev bekliyor</span>
            <button onClick={() => { setTab('gorevler'); setFilter('bekliyor') }} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 12, color: 'var(--red)', textDecoration: 'underline' }}>Göster</button>
          </div>
        )}

        {/* GÖREVLER */}
        {tab === 'gorevler' && (
          <>
            <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
              {[{ v: 'bekliyor', l: 'Bekleyen' }, { v: 'devam', l: 'Devam' }, { v: 'tamamlandi', l: 'Tamamlanan' }, { v: 'all', l: 'Hepsi' }].map(f => (
                <button key={f.v} onClick={() => setFilter(f.v as any)} className={filter === f.v ? 'badge badge-ac' : 'badge badge-muted'} style={{ padding: '6px 13px', fontSize: 12, border: 'none', cursor: 'pointer' }}>{f.l}</button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {loading ? [1, 2, 3].map(i => <div key={i} className="card anim-pulse" style={{ height: 76 }} />) :
                filteredGorevler.map(g => {
                  const gecikmis = g.bitis_tarihi && new Date(g.bitis_tarihi) < new Date() && g.durum !== 'tamamlandi'
                  return (
                    <div key={g.id} className="card" style={{ padding: 16, opacity: g.durum === 'tamamlandi' ? .6 : 1, borderLeft: g.oncelik === 'acil' && g.durum !== 'tamamlandi' ? '2.5px solid var(--red)' : undefined }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                        <button onClick={() => gorevDurumGuncelle(g.id, g.durum === 'tamamlandi' ? 'bekliyor' : 'tamamlandi')}
                          style={{ width: 22, height: 22, borderRadius: '50%', border: `2px solid ${g.durum === 'tamamlandi' ? 'var(--green)' : 'var(--bdr2)'}`, background: g.durum === 'tamamlandi' ? 'var(--green)' : 'transparent', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>
                          {g.durum === 'tamamlandi' && <Check size={12} strokeWidth={3} />}
                        </button>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13.5, fontWeight: 600, color: g.durum === 'tamamlandi' ? 'var(--tx3)' : 'var(--tx)', textDecoration: g.durum === 'tamamlandi' ? 'line-through' : 'none' }}>{g.baslik}</div>
                          {g.aciklama && <div style={{ fontSize: 12.5, color: 'var(--tx2)', marginTop: 3 }}>{g.aciklama}</div>}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 9, flexWrap: 'wrap' }}>
                            <span className={`badge ${ONCELIK_BADGE[g.oncelik] || 'badge-muted'}`}>{g.oncelik}</span>
                            {g.ilgili_telefon && <span style={{ fontSize: 11.5, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'JetBrains Mono, monospace' }}><Phone size={11} />{g.ilgili_telefon}</span>}
                            {g.ilgili_siparis && <span style={{ fontSize: 11.5, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace' }}>{g.ilgili_siparis}</span>}
                            {g.bitis_tarihi && <span style={{ fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 4, color: gecikmis ? 'var(--red)' : 'var(--tx3)' }}><Clock size={11} />{format(new Date(g.bitis_tarihi), 'd MMM', { locale: tr })}</span>}
                            <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{formatDistanceToNow(new Date(g.created_at), { addSuffix: true, locale: tr })}</span>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {g.durum !== 'tamamlandi' && (
                            <button className="btn-ghost" onClick={() => gorevDurumGuncelle(g.id, g.durum === 'devam' ? 'bekliyor' : 'devam')} style={{ padding: '4px 10px', fontSize: 11.5 }}>
                              {g.durum === 'devam' ? 'Duraklat' : 'Başlat'}
                            </button>
                          )}
                          <button onClick={() => gorevSil(g.id)} style={{ width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', color: 'var(--tx3)' }}><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  )
                })}
              {!loading && filteredGorevler.length === 0 && (
                <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                  <Check size={32} style={{ color: 'var(--green)', opacity: .6, margin: '0 auto 10px', display: 'block' }} strokeWidth={1.5} />
                  <p style={{ fontSize: 13, color: 'var(--tx2)' }}>Bekleyen görev yok</p>
                </div>
              )}
            </div>
          </>
        )}

        {/* EKİP NOTLARI */}
        {tab === 'notlar' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {loading ? [1, 2, 3].map(i => <div key={i} className="card anim-pulse" style={{ height: 76 }} />) :
              notlar.map(n => (
                <div key={n.id} className="card" style={{ padding: 16 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                        <span className="badge badge-muted">{n.yazan}</span>
                        <span style={{ fontSize: 11.5, color: 'var(--tx3)' }}>{formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: tr })}</span>
                        {n.ilgili_tip !== 'genel' && <span className="badge badge-ac">{n.ilgili_tip}</span>}
                      </div>
                      <p style={{ fontSize: 13.5, color: 'var(--tx)', lineHeight: 1.55 }}>{n.icerik}</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 8 }}>
                        {n.ilgili_telefon && <span style={{ fontSize: 11.5, color: 'var(--tx3)', display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'JetBrains Mono, monospace' }}><Phone size={11} />{n.ilgili_telefon}</span>}
                        {n.ilgili_siparis && <span style={{ fontSize: 11.5, color: 'var(--tx3)', fontFamily: 'JetBrains Mono, monospace' }}>{n.ilgili_siparis}</span>}
                      </div>
                    </div>
                    <button onClick={() => setSilNotId(n.id)} style={{ background: 'none', border: 'none', color: 'var(--tx3)', flexShrink: 0 }}><Trash2 size={15} /></button>
                  </div>
                </div>
              ))}
            {!loading && notlar.length === 0 && (
              <div className="card" style={{ padding: 48, textAlign: 'center' }}>
                <MessageSquare size={32} style={{ color: 'var(--tx3)', opacity: .5, margin: '0 auto 10px', display: 'block' }} strokeWidth={1.4} />
                <p style={{ fontSize: 13, color: 'var(--tx2)' }}>Henüz ekip notu yok</p>
              </div>
            )}
          </div>
        )}

        {/* ARAMA LOGU */}
        {tab === 'aramalar' && (
          <div className="card">
            {loading ? (
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>{[1, 2, 3].map(i => <div key={i} className="anim-pulse" style={{ height: 44, background: 'var(--s2)', borderRadius: 8 }} />)}</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 720, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>{['Tarih', 'Müşteri', 'Telefon', 'Süre', 'Sonuç', 'Notlar', 'Arayan'].map(h => (
                      <th key={h} className="kpi-label" style={{ padding: '12px 18px', textAlign: 'left', marginBottom: 0, borderBottom: '1px solid var(--bdr)' }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {aramalar.map(a => (
                      <tr key={a.id} className="row" style={{ display: 'table-row' }}>
                        <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--tx3)', whiteSpace: 'nowrap', borderBottom: '1px solid var(--bdr)' }}>{format(new Date(a.created_at), 'd MMM HH:mm', { locale: tr })}</td>
                        <td style={{ padding: '12px 18px', fontSize: 13, borderBottom: '1px solid var(--bdr)' }}>{a.musteri_adi || '—'}</td>
                        <td style={{ padding: '12px 18px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12.5, color: 'var(--tx2)', borderBottom: '1px solid var(--bdr)' }}>{a.telefon}</td>
                        <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--tx3)', borderBottom: '1px solid var(--bdr)' }}>{a.sure_dakika > 0 ? `${a.sure_dakika} dk` : '—'}</td>
                        <td style={{ padding: '12px 18px', borderBottom: '1px solid var(--bdr)' }}><span className={`badge ${SONUC_BADGE[a.sonuc] || 'badge-muted'}`}>{SONUC_LABEL[a.sonuc] || a.sonuc}</span></td>
                        <td style={{ padding: '12px 18px', fontSize: 12.5, color: 'var(--tx2)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderBottom: '1px solid var(--bdr)' }}>{a.notlar || '—'}</td>
                        <td style={{ padding: '12px 18px', fontSize: 12, color: 'var(--tx3)', borderBottom: '1px solid var(--bdr)' }}>{a.arayan}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {!loading && aramalar.length === 0 && (
              <div style={{ padding: 48, textAlign: 'center' }}>
                <Phone size={32} style={{ color: 'var(--tx3)', opacity: .5, margin: '0 auto 10px', display: 'block' }} strokeWidth={1.4} />
                <p style={{ fontSize: 13, color: 'var(--tx2)' }}>Henüz arama kaydı yok</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* GÖREV FORMU */}
      {gorevForm.show && (
        <Modal title="Görev Ekle" onClose={() => setGorevForm(f => ({ ...f, show: false }))}>
          <Field label="Başlık *"><input className="inp" value={gorevForm.baslik} onChange={e => setGorevForm(f => ({ ...f, baslik: e.target.value }))} placeholder="Görevi tanımla..." /></Field>
          <Field label="Açıklama"><textarea className="inp" value={gorevForm.aciklama} onChange={e => setGorevForm(f => ({ ...f, aciklama: e.target.value }))} rows={2} placeholder="Opsiyonel detay..." /></Field>
          <div className="modal-grid">
            <Field label="Öncelik">
              <select className="inp" value={gorevForm.oncelik} onChange={e => setGorevForm(f => ({ ...f, oncelik: e.target.value }))}>
                <option value="dusuk">Düşük</option><option value="normal">Normal</option><option value="yuksek">Yüksek</option><option value="acil">Acil</option>
              </select>
            </Field>
            <Field label="Bitiş Tarihi"><input className="inp" type="date" value={gorevForm.bitis_tarihi} onChange={e => setGorevForm(f => ({ ...f, bitis_tarihi: e.target.value }))} /></Field>
          </div>
          <div className="modal-grid">
            <Field label="SMS Saati (opsiyonel)"><input className="inp" type="time" value={gorevForm.sms_saati} onChange={e => setGorevForm(f => ({ ...f, sms_saati: e.target.value }))} /></Field>
            <Field label="SMS Telefon"><input className="inp" value={gorevForm.sms_telefon} onChange={e => setGorevForm(f => ({ ...f, sms_telefon: e.target.value }))} placeholder="905xx..." /></Field>
          </div>
          <Field label="İlgili Telefon"><input className="inp" value={gorevForm.ilgili_telefon} onChange={e => setGorevForm(f => ({ ...f, ilgili_telefon: e.target.value }))} placeholder="905xx..." /></Field>
          <button className="btn" onClick={gorevEkle} style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }}>Görev Ekle</button>
        </Modal>
      )}

      {/* NOT FORMU */}
      {notForm.show && (
        <Modal title="Ekip Notu Ekle" onClose={() => setNotForm(f => ({ ...f, show: false }))}>
          <Field label="Not *"><textarea className="inp" value={notForm.icerik} onChange={e => setNotForm(f => ({ ...f, icerik: e.target.value }))} rows={3} placeholder="Notu yaz..." /></Field>
          <div className="modal-grid">
            <Field label="Yazan"><input className="inp" value={notForm.yazan} onChange={e => setNotForm(f => ({ ...f, yazan: e.target.value }))} placeholder="admin" /></Field>
            <Field label="Tür">
              <select className="inp" value={notForm.ilgili_tip} onChange={e => setNotForm(f => ({ ...f, ilgili_tip: e.target.value }))}>
                <option value="genel">Genel</option><option value="siparis">Sipariş</option><option value="musteri">Müşteri</option><option value="teslimat">Teslimat</option><option value="sorun">Sorun</option>
              </select>
            </Field>
          </div>
          <div className="modal-grid">
            <Field label="İlgili Telefon"><input className="inp" value={notForm.ilgili_telefon} onChange={e => setNotForm(f => ({ ...f, ilgili_telefon: e.target.value }))} placeholder="905xx..." /></Field>
            <Field label="İlgili Sipariş"><input className="inp" value={notForm.ilgili_siparis} onChange={e => setNotForm(f => ({ ...f, ilgili_siparis: e.target.value }))} placeholder="#1142" /></Field>
          </div>
          <button className="btn" onClick={notEkle} style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }}>Notu Kaydet</button>
        </Modal>
      )}

      {/* ARAMA FORMU */}
      {aramaForm.show && (
        <Modal title="Arama Kaydet" onClose={() => setAramaForm(f => ({ ...f, show: false }))}>
          <div className="modal-grid">
            <Field label="Telefon *"><input className="inp" value={aramaForm.telefon} onChange={e => setAramaForm(f => ({ ...f, telefon: e.target.value }))} placeholder="905xx..." /></Field>
            <Field label="Müşteri Adı"><input className="inp" value={aramaForm.musteri_adi} onChange={e => setAramaForm(f => ({ ...f, musteri_adi: e.target.value }))} placeholder="Ad Soyad" /></Field>
          </div>
          <div className="modal-grid">
            <Field label="Süre (dakika)"><input className="inp" type="number" value={aramaForm.sure_dakika} onChange={e => setAramaForm(f => ({ ...f, sure_dakika: e.target.value }))} placeholder="5" /></Field>
            <Field label="Sonuç">
              <select className="inp" value={aramaForm.sonuc} onChange={e => setAramaForm(f => ({ ...f, sonuc: e.target.value }))}>
                <option value="tamamlandi">Tamamlandı</option><option value="cevapsiz">Cevapsız</option><option value="geri_aranacak">Geri Aranacak</option><option value="mesaj_birakildi">Mesaj Bırakıldı</option>
              </select>
            </Field>
          </div>
          <Field label="Notlar"><textarea className="inp" value={aramaForm.notlar} onChange={e => setAramaForm(f => ({ ...f, notlar: e.target.value }))} rows={3} placeholder="Konuşma özeti..." /></Field>
          <Field label="Arayan"><input className="inp" value={aramaForm.arayan} onChange={e => setAramaForm(f => ({ ...f, arayan: e.target.value }))} placeholder="admin" /></Field>
          <button className="btn" onClick={aramaEkle} style={{ width: '100%', justifyContent: 'center', padding: '11px 0' }}>Aramayı Kaydet</button>
        </Modal>
      )}

      <ConfirmModal
        open={silNotId !== null}
        title="Notu sil"
        message="Bu ekip notunu silmek istediğinize emin misiniz?"
        onConfirm={() => silNotId !== null && notSil(silNotId)}
        onCancel={() => setSilNotId(null)}
      />
    </>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={{ marginBottom: 12 }}><label className="label">{label}</label>{children}</div>
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="overlay" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal anim-pop">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 className="modal-title" style={{ marginBottom: 0 }}>{title}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--tx3)' }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}
