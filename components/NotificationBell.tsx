'use client'
import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Headphones } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { fmtRelative } from '@/lib/utils'

type Bekleyen = { phone: string; musteri_adi: string | null; musteri_yazdigi: string | null; updated_at: string }

// Canlı destek kuyruğu: bot insana devrettiği oturumlar
export default function NotificationBell() {
  const router = useRouter()
  const [liste, setListe] = useState<Bekleyen[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('wa_sessions_roberto')
        .select('phone, musteri_adi, musteri_yazdigi, updated_at')
        .eq('bulundugu_menu', 'canli')
        .order('updated_at', { ascending: false })
        .limit(20)
      setListe((data as Bekleyen[]) || [])
    }
    load()
    const t = setInterval(load, 20000)
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => { clearInterval(t); document.removeEventListener('mousedown', onDoc) }
  }, [])

  const n = liste.length

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <style>{`
        .nb-dropdown{position:absolute;top:calc(100% + 8px);right:0;width:320px;background:var(--s1);border:1px solid var(--bdr2);border-radius:12px;box-shadow:0 8px 32px rgba(0,0,0,.35);z-index:999;overflow:hidden;animation:popIn .18s ease both}
        .nb-item{display:flex;align-items:flex-start;gap:10px;padding:11px 14px;border-bottom:1px solid var(--bdr);cursor:pointer;transition:background .1s}
        .nb-item:last-child{border-bottom:none}
        .nb-item:hover{background:var(--s2)}
        @media(max-width:480px){.nb-dropdown{width:calc(100vw - 32px);right:-60px}}
      `}</style>

      <button onClick={() => setOpen(!open)} style={{ position: 'relative', background: 'var(--s2)', border: '1px solid var(--bdr)', borderRadius: 9, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
        <Bell size={15} style={{ color: n > 0 ? 'var(--amber)' : 'var(--tx3)' }} strokeWidth={n > 0 ? 2.5 : 1.8} />
        {n > 0 && (
          <div style={{ position: 'absolute', top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 8, background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px', border: '2px solid var(--bg)' }}>
            {n > 9 ? '9+' : n}
          </div>
        )}
      </button>

      {open && (
        <div className="nb-dropdown">
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--bdr)', fontSize: 13, fontWeight: 700 }}>
            Canlı Destek Kuyruğu {n > 0 && <span style={{ color: 'var(--red)', fontSize: 11 }}>({n} bekliyor)</span>}
          </div>
          <div style={{ maxHeight: 360, overflowY: 'auto' }}>
            {n === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--tx3)', fontSize: 13 }}>
                <Bell size={24} style={{ opacity: .2, display: 'block', margin: '0 auto 8px' }} />
                Bekleyen müşteri yok
              </div>
            ) : liste.map(s => (
              <div key={s.phone} className="nb-item" onClick={() => { setOpen(false); router.push('/canli-destek') }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: 'var(--red2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Headphones size={13} style={{ color: 'var(--red)' }} strokeWidth={2} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, marginBottom: 2 }}>{s.musteri_adi || s.phone}</p>
                  {s.musteri_yazdigi && <p style={{ fontSize: 11.5, color: 'var(--tx3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.musteri_yazdigi}</p>}
                  <p style={{ fontSize: 10.5, color: 'var(--tx3)', marginTop: 3 }}>{fmtRelative(s.updated_at)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
