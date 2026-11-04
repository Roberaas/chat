'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit2, RefreshCw, FlaskConical } from 'lucide-react'
import TopBar from '@/components/TopBar'
import ConfirmModal from '@/components/ConfirmModal'

type Kural = {
  id: number; ad: string; anahtar_kelimeler: string[]; eslesme: 'icerir' | 'tam'
  eylem: 'sabit_cevap' | 'yonerge' | 'canliya_aktar'; cevap: string | null; yonerge: string | null
  aktif: boolean; oncelik: number
}
const EYLEM: Record<string, string> = { sabit_cevap: 'Sabit cevap', yonerge: 'GPT yönergesi', canliya_aktar: 'Canlı desteğe aktar' }
const EMPTY = { show: false, id: 0, ad: '', kelimeler: '', eslesme: 'icerir', eylem: 'sabit_cevap', cevap: '', yonerge: '', aktif: true, oncelik: 100 }
const mono = 'JetBrains Mono, monospace'

export default function BotKurallariPage() {
  const [kurallar, setKurallar] = useState<Kural[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<any>(EMPTY)
  const [hata, setHata] = useState('')
  const [silinecek, setSilinecek] = useState<number | null>(null)
  const [test, setTest] = useState('')
  const [testSonuc, setTestSonuc] = useState<string>('')

  useEffect(() => { load() }, [])
  async function load() {
    setLoading(true)
    const r = await fetch('/api/bot-kurallari').then(r => r.json()).catch(() => ({}))
    setKurallar(r.kurallar || [])
    setLoading(false)
  }
  const post = (method: string, body: any) => fetch('/api/bot-kurallari', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }).then(r => r.json())

  async function kaydet() {
    setHata('')
    const body = { id: form.id || undefined, ad: form.ad, anahtar_kelimeler: form.kelimeler, eslesme: form.eslesme, eylem: form.eylem, cevap: form.cevap, yonerge: form.yonerge, aktif: form.aktif, oncelik: form.oncelik }
    const r = await post(form.id ? 'PATCH' : 'POST', body)
    if (!r.ok) { setHata(r.error || 'Kaydedilemedi'); return }
    setForm(EMPTY); load()
  }
  async function sil(id: number) { await fetch(`/api/bot-kurallari?id=${id}`, { method: 'DELETE' }); setSilinecek(null); load() }
  async function durum(k: Kural) { await post('PATCH', { id: k.id, aktif: !k.aktif }); load() }
  async function dene() {
    const r = await post('POST', { test })
    setTestSonuc(r.eslesen ? `Eşleşti: "${r.eslesen.ad}" → ${EYLEM[r.eslesen.eylem]}` : 'Hiçbir kural eşleşmedi (bot normal akışla cevap verir).')
  }
  function duzenle(k: Kural) {
    setHata('')
    setForm({ show: true, id: k.id, ad: k.ad, kelimeler: k.anahtar_kelimeler.join('\n'), eslesme: k.eslesme, eylem: k.eylem, cevap: k.cevap || '', yonerge: k.yonerge || '', aktif: k.aktif, oncelik: k.oncelik })
  }

  const toggle = (on: boolean, onClick: () => void) => (
    <button onClick={onClick} aria-pressed={on} style={{ width: 38, height: 20, borderRadius: 999, border: 'none', position: 'relative', background: on ? 'var(--green)' : 'var(--s5)', flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 20 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} />
    </button>
  )
  const lbl: React.CSSProperties = { fontSize: 11.5, color: 'var(--tx3)', display: 'block', marginBottom: 5, marginTop: 12 }
  const inp: React.CSSProperties = { width: '100%', padding: '9px 11px', background: 'var(--s2)', border: '1px solid var(--bdr)', borderRadius: 8, color: 'var(--tx)', fontSize: 13, fontFamily: 'inherit' }

  return (
    <>
      <TopBar title="Bot Kuralları" subtitle="hazır cevaplar ve yönlendirmeler" action={<button className="btn-ghost" onClick={load} title="Yenile" style={{ padding: 8 }}><RefreshCw size={14} /></button>} />
      <div style={{ padding: 22, maxWidth: 1100, width: '100%', margin: '0 auto' }}>
        <p style={{ fontSize: 12.5, color: 'var(--tx3)', marginBottom: 16, lineHeight: 1.6 }}>
          Müşteri mesajı bir kuralın anahtar kelimesini içeriyorsa bot o kuralı uygular; kural yoksa normal akışla devam eder. Değişiklikler kaydedilir kaydedilmez geçerli olur, n8n'de bir şey yapmanız gerekmez. Sıra numarası küçük olan kural önce denenir.
        </p>

        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-h"><span className="card-title">Kural dene</span></div>
          <div style={{ padding: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <input value={test} onChange={e => setTest(e.target.value)} onKeyDown={e => e.key === 'Enter' && dene()} placeholder="Örn: iade nasıl yapılır" style={{ ...inp, flex: 1, minWidth: 220 }} />
            <button className="btn" onClick={dene}><FlaskConical size={14} /> Dene</button>
            {testSonuc && <span style={{ fontSize: 12.5, color: 'var(--tx2)', width: '100%' }}>{testSonuc}</span>}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <span className="card-title">Kurallar</span>
            <button className="btn" onClick={() => { setHata(''); setForm({ ...EMPTY, show: true }) }}><Plus size={14} /> Kural Ekle</button>
          </div>
          {loading ? <div style={{ padding: 16 }}>Yükleniyor…</div> : kurallar.length === 0 ? (
            <div style={{ padding: 24, fontSize: 13, color: 'var(--tx3)' }}>Henüz kural yok. "Kural Ekle" ile başlayın.</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
                <thead><tr>{['Sıra', 'Kural', 'Anahtar kelimeler', 'Ne yapar', 'Açık', ''].map((h, i) => <th key={i} className="kpi-label" style={{ padding: '12px 16px', textAlign: 'left', marginBottom: 0, borderBottom: '1px solid var(--bdr)' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {kurallar.map(k => (
                    <tr key={k.id} style={{ opacity: k.aktif ? 1 : .5 }}>
                      <td style={{ padding: '12px 16px', fontFamily: mono, fontSize: 12, color: 'var(--tx3)', borderBottom: '1px solid var(--bdr)' }}>{k.oncelik}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: 'var(--tx)', borderBottom: '1px solid var(--bdr)' }}>{k.ad}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--tx2)', borderBottom: '1px solid var(--bdr)', maxWidth: 280 }}>{k.anahtar_kelimeler.join(', ')}{k.eslesme === 'tam' ? ' (tam eşleşme)' : ''}</td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--bdr)' }}><span className="badge badge-ac">{EYLEM[k.eylem]}</span></td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--bdr)' }}>{toggle(k.aktif, () => durum(k))}</td>
                      <td style={{ padding: '12px 16px', borderBottom: '1px solid var(--bdr)' }}>
                        <button onClick={() => duzenle(k)} title="Düzenle" style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6 }}><Edit2 size={14} /></button>
                        <button onClick={() => setSilinecek(k.id)} title="Sil" style={{ background: 'none', border: 'none', color: 'var(--tx3)', padding: 6 }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {form.show && (
        <div onClick={() => setForm(EMPTY)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div onClick={e => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 520, maxHeight: '90vh', overflowY: 'auto', padding: 20 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--tx)' }}>{form.id ? 'Kuralı düzenle' : 'Yeni kural'}</h3>
            <label style={lbl}>Kural adı (sadece sizin için)</label>
            <input style={inp} value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="Örn: İade soruları" />
            <label style={lbl}>Anahtar kelime / ifadeler (her satıra bir tane)</label>
            <textarea style={{ ...inp, minHeight: 80 }} value={form.kelimeler} onChange={e => setForm({ ...form, kelimeler: e.target.value })} placeholder={'iade\ndeğişim nasıl'} />
            <label style={lbl}>Eşleşme</label>
            <select style={inp} value={form.eslesme} onChange={e => setForm({ ...form, eslesme: e.target.value })}>
              <option value="icerir">Mesaj bu ifadeyi içeriyorsa</option>
              <option value="tam">Mesaj tam olarak bu ise</option>
            </select>
            <label style={lbl}>Ne yapsın?</label>
            <select style={inp} value={form.eylem} onChange={e => setForm({ ...form, eylem: e.target.value })}>
              <option value="sabit_cevap">Sabit cevap ver (aynen gönderilir)</option>
              <option value="yonerge">GPT'ye yönerge ver (cevabı GPT yazar)</option>
              <option value="canliya_aktar">Canlı desteğe aktar</option>
            </select>
            {form.eylem === 'sabit_cevap' && (<><label style={lbl}>Gönderilecek cevap</label><textarea style={{ ...inp, minHeight: 100 }} value={form.cevap} onChange={e => setForm({ ...form, cevap: e.target.value })} /></>)}
            {form.eylem === 'yonerge' && (<><label style={lbl}>GPT'ye yönerge</label><textarea style={{ ...inp, minHeight: 100 }} value={form.yonerge} onChange={e => setForm({ ...form, yonerge: e.target.value })} placeholder="Örn: İade süresi 14 gündür, kargo ücreti müşteriye aittir. Kısa ve samimi anlat." /></>)}
            <label style={lbl}>Sıra (küçük olan önce denenir)</label>
            <input type="number" style={inp} value={form.oncelik} onChange={e => setForm({ ...form, oncelik: e.target.value })} />
            {hata && <p style={{ color: 'var(--red)', fontSize: 12.5, marginTop: 12 }}>{hata}</p>}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 18 }}>
              <button className="btn-ghost" onClick={() => setForm(EMPTY)}>Vazgeç</button>
              <button className="btn" onClick={kaydet}>Kaydet</button>
            </div>
          </div>
        </div>
      )}
      {silinecek !== null && <ConfirmModal {...({ title: 'Kuralı sil', message: 'Bu kural silinecek. Emin misiniz?', onConfirm: () => sil(silinecek), onCancel: () => setSilinecek(null), onClose: () => setSilinecek(null) } as any)} />}
    </>
  )
}
