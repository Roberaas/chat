'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

type N = { id: string; title: string; body: string | null; link: string | null; read_at: string | null; created_at: string }

export default function CrmBell() {
  const supabase = createCrmBrowserClient()
  const [items, setItems] = useState<N[]>([])
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('id, title, body, link, read_at, created_at').order('created_at', { ascending: false }).limit(20)
    setItems((data || []) as N[])
  }, [])  // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { load(); const t = setInterval(load, 60000); return () => clearInterval(t) }, [load])
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  const unread = items.filter(i => !i.read_at).length
  async function markAll() {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null)
    load()
  }
  async function markOne(id: string) {
    await supabase.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    load(); setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="btn-ghost" aria-label="Bildirimler" onClick={() => setOpen(o => !o)} style={{ padding: '6px 9px', position: 'relative' }}>
        <Bell size={15} />
        {unread > 0 && <span style={{ position: 'absolute', top: -5, right: -5, background: 'var(--red)', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 9, padding: '1px 5px' }}>{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="card anim-pop" style={{ position: 'absolute', right: 0, top: 40, width: 320, maxHeight: 420, overflowY: 'auto', zIndex: 60, padding: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', fontSize: 12.5, fontWeight: 700, color: 'var(--tx)' }}>
            Bildirimler {unread > 0 && <button onClick={markAll} style={{ background: 'none', border: 'none', color: 'var(--ac)', fontSize: 12, cursor: 'pointer' }}>Tümünü okundu yap</button>}
          </div>
          {items.length === 0 ? <div style={{ padding: 24, textAlign: 'center', fontSize: 12.5, color: 'var(--tx3)' }}>Bildirim yok</div> : items.map(n => {
            const inner = (<div style={{ padding: '8px 10px', borderRadius: 8, background: n.read_at ? 'transparent' : 'var(--ac2)' }}>
              <div style={{ fontSize: 13, color: 'var(--tx)', fontWeight: n.read_at ? 400 : 600 }}>{n.title}</div>
              {n.body && <div style={{ fontSize: 12, color: 'var(--tx2)' }}>{n.body}</div>}
              <div style={{ fontSize: 11, color: 'var(--tx3)' }}>{new Date(n.created_at).toLocaleString('tr-TR', { dateStyle: 'short', timeStyle: 'short' })}</div></div>)
            return n.link ? <Link key={n.id} href={n.link} onClick={() => markOne(n.id)} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>
              : <div key={n.id} onClick={() => markOne(n.id)} style={{ cursor: 'pointer' }}>{inner}</div>
          })}
        </div>
      )}
    </div>
  )
}
