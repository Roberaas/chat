'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { LogOut, Menu, X } from 'lucide-react'
import RobertoLogo from './RobertoLogo'
import { NAV, navFor, isActive, ROL_ETIKET } from '@/lib/nav'
import { useMe, useCounts, logout } from '@/lib/hooks'

export default function MobileMenu() {
  const pathname = usePathname()
  const me = useMe()
  const { canli, konusmalar } = useCounts()
  const [open, setOpen] = useState(false)
  const rol = me?.rol || 'admin'
  const groups = me ? navFor(rol) : NAV
  const init = (me?.ad || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  useEffect(() => { setOpen(false) }, [pathname])
  const badgeOf = (b?: string) => b === 'canli' ? canli : b === 'konusmalar' ? konusmalar : 0

  return (
    <>
      <style>{`
        .mm-trigger{position:fixed;top:10px;left:10px;z-index:9998;width:36px;height:36px;border-radius:10px;background:var(--s1);border:1px solid var(--bdr);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.25)}
        .mm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9998;backdrop-filter:blur(4px);animation:fadeIn .2s ease both}
        .mm-drawer{position:fixed;top:0;left:0;bottom:0;width:260px;background:var(--s1);border-right:1px solid var(--bdr);z-index:9999;display:flex;flex-direction:column;overflow:hidden;animation:mmSlideIn .22s cubic-bezier(.22,1,.36,1) both}
        @keyframes mmSlideIn{from{transform:translateX(-100%)}to{transform:translateX(0)}}
      `}</style>

      <button className="mm-trigger" onClick={() => setOpen(true)} aria-label="Menü">
        <Menu size={16} color="var(--tx2)" strokeWidth={2} />
      </button>

      {open && <div className="mm-backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="mm-drawer">
          <div className="sb-logo" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
              <RobertoLogo size={28} />
              <div>
                <p style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--tx)', lineHeight: 1.2 }}>Roberto Bravo</p>
                <p style={{ fontSize: 9, color: 'var(--tx3)', marginTop: 1 }}>{ROL_ETIKET[rol] || 'Yönetim Paneli'}</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--s2)', border: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)' }}>
              <X size={13} strokeWidth={2} />
            </button>
          </div>

          <nav className="sb-nav">
            {groups.map(sec => (
              <div key={sec.g}>
                <p className="sb-group">{sec.g}</p>
                {sec.items.map(({ href, label, Icon, badge }) => {
                  const n = badgeOf(badge)
                  return (
                    <Link key={href} href={href} className={`sb-item ${isActive(pathname, href) ? 'active' : ''}`}>
                      <span className="sb-icon"><Icon size={14} strokeWidth={1.8} /></span>
                      <span style={{ flex: 1 }}>{label}</span>
                      {n > 0 && <span className={`badge ${badge === 'canli' ? 'badge-red' : 'badge-ac'}`} style={{ padding: '1px 7px', fontSize: 10.5 }}>{n}</span>}
                    </Link>
                  )
                })}
              </div>
            ))}
          </nav>

          <div className="sb-user" onClick={logout}>
            <div className="sb-av">{init}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me?.ad || '...'}</p>
              <p style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 1 }}>Çıkış yap</p>
            </div>
            <LogOut size={12} style={{ color: 'var(--tx3)', flexShrink: 0 }} strokeWidth={1.8} />
          </div>
        </div>
      )}
    </>
  )
}
