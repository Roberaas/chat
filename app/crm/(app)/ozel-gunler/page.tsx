'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Cake, MessageCircle, Phone } from 'lucide-react'
import CrmTopBar from '@/components/crm/CrmTopBar'
import Empty from '@/components/crm/Empty'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type D = { customer_id: string; name: string; phone: string | null; birth_date: string; next_date: string; days_left: number; turning: number; advisor_name: string | null; store_name: string | null }
const RANGES: [string, string][] = [['7', '7 gün'], ['30', '30 gün'], ['90', '90 gün']]
const waLink = (phone: string, name: string) => {
  let d = phone.replace(/\D/g, ''); if (d.startsWith('0')) d = '9' + d; if (d.length === 10) d = '90' + d
  const first = name.split(' ')[0]
  return `https://wa.me/${d}?text=${encodeURIComponent(`İyi ki doğdunuz ${first}! Roberto Bravo ailesi olarak yeni yaşınızda sağlık ve mutluluklar dileriz.`)}`
}
const when = (n: number) => n === 0 ? 'Bugün' : n === 1 ? 'Yarın' : `${n} gün sonra`
const group = (n: number) => n === 0 ? 'Bugün' : n <= 7 ? 'Bu hafta' : n <= 30 ? 'Bu ay' : 'Daha sonra'

export default function OzelGunlerPage() {
  const supabase = createCrmBrowserClient()
  const [days, setDays] = useState('30')
  const [rows, setRows] = useState<D[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  useEffect(() => {
    setLoading(true)
    supabase.rpc('special_days', { p_days: parseInt(days) }).then(({ data, error }) => { setLoading(false); if (error) setErr(error.message); else { setErr(''); setRows((data || []) as D[]) } })
  }, [days])  // eslint-disable-line react-hooks/exhaustive-deps
  const groups = ['Bugün', 'Bu hafta', 'Bu ay', 'Daha sonra'].map(g => [g, rows.filter(r => group(r.days_left) === g)] as const).filter(([, l]) => l.length)

  return (
    <>
      <CrmTopBar title="Özel Günler" subtitle={`${rows.length} doğum günü`} />
      <div style={{ padding: '24px 28px 40px', maxWidth: 900, width: '100%', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 13, color: 'var(--tx3)', maxWidth: 520 }}>Müşterilerinizin doğum günleri. Danışmana 3 gün önceden ve gün içinde bildirim düşer; buradan tek tıkla arayın veya WhatsApp'tan tebrik edin.</div>
          <div className="seg">{RANGES.map(([k, l]) => <button key={k} className={days === k ? 'on' : ''} onClick={() => setDays(k)}>{l}</button>)}</div>
        </div>
        {err && <div style={{ color: 'var(--red)', fontSize: 13 }}>{err}</div>}
        {!loading && rows.length === 0 && <div className="card"><Empty Icon={Cake} title="Bu aralıkta doğum günü yok" desc="Müşteri kartına doğum tarihi girildikçe ve Excel ile yüklenen müşterilerin doğum tarihleri burada görünür." /></div>}
        {groups.map(([g, list]) => (
          <div key={g} className="card">
            <div style={{ padding: '14px 18px 8px' }}><div className="card-title">{g} <span style={{ color: 'var(--tx3)', fontWeight: 400 }}>· {list.length}</span></div></div>
            {list.map(r => (
              <div key={r.customer_id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 18px', borderTop: '1px solid var(--bdr)' }}>
                <span className="sb-av" style={{ width: 36, height: 36, fontSize: 13 }}>{r.name.split(' ').map(x => x[0]).slice(0, 2).join('').toUpperCase()}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Link href={`/crm/musteriler/${r.customer_id}`} style={{ fontSize: 14, fontWeight: 600, color: 'var(--tx)' }}>{r.name}</Link>
                  <div style={{ fontSize: 12.5, color: 'var(--tx3)' }}>{when(r.days_left)} · {r.turning} yaşına giriyor · {new Date(r.next_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}{r.store_name ? ` · ${r.store_name}` : ''}{r.advisor_name ? ` · ${r.advisor_name}` : ''}</div>
                </div>
                {r.phone && <a className="btn-ghost" href={`tel:${r.phone}`} style={{ textDecoration: 'none' }} aria-label="Ara"><Phone size={14} /></a>}
                {r.phone && <a className="btn" href={waLink(r.phone, r.name)} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}><MessageCircle size={14} /> Tebrik et</a>}
              </div>))}
          </div>))}
      </div>
    </>
  )
}
