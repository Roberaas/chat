'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { LogOut, Search } from 'lucide-react'
import RobertoLogo from './RobertoLogo'
import { NAV, navFor, isActive, ROL_ETIKET } from '@/lib/nav'
import { useMe, useCounts, logout } from '@/lib/hooks'

export default function Sidebar() {
  const pathname = usePathname()
  const me = useMe()
  const { canli, konusmalar } = useCounts()
  const rol = me?.rol || 'admin'
  const groups = me ? navFor(rol) : NAV
  const init = (me?.ad || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  const badgeOf = (b?: string) => b === 'canli' ? canli : b === 'konusmalar' ? konusmalar : 0

  return (
    <aside className="sb">
      <div className="sb-logo">
        <RobertoLogo size={32} />
        <div>
          <p style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-.2px', lineHeight: 1.2 }}>Roberto Bravo</p>
          <p style={{ fontSize: 9.5, color: 'var(--tx3)', marginTop: 2 }}>Yönetim Paneli</p>
        </div>
      </div>

      <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--bdr)' }}>
        <button
          onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
          style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', background: 'var(--s2)', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 12.5, color: 'var(--tx3)', cursor: 'pointer' }}
        >
          <Search size={13} />
          <span style={{ flex: 1, textAlign: 'left' }}>Ara...</span>
          <kbd style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>Ctrl K</kbd>
        </button>
      </div>

      {me && (
        <div style={{ padding: '6px 12px', borderBottom: '1px solid var(--bdr)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'var(--s2)', borderRadius: 7 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: rol === 'admin' ? 'var(--ac)' : rol === 'operasyon' ? 'var(--blue)' : 'var(--green)', flexShrink: 0 }} />
            <span style={{ fontSize: 10.5, color: 'var(--tx2)', fontWeight: 600 }}>{ROL_ETIKET[rol] || rol}</span>
          </div>
        </div>
      )}

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
                  {n > 0 && (
                    <span className={`badge ${badge === 'canli' ? 'badge-red' : 'badge-ac'}`} style={{ padding: '1px 7px', fontSize: 10.5, animation: badge === 'canli' ? 'pulse 1.5s ease-in-out infinite' : undefined }}>
                      {n}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      <div className="sb-user" onClick={logout}>
        <div className="sb-av">{init}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{me?.ad || '...'}</p>
          <p style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 1 }}>Çıkış yap</p>
        </div>
        <LogOut size={13} style={{ color: 'var(--tx3)', flexShrink: 0 }} strokeWidth={1.8} />
      </div>
    </aside>
  )
}
