'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState, type ReactNode } from 'react'
import { LogOut, Menu, X, MessageCircle } from 'lucide-react'
import RobertoLogo from '@/components/RobertoLogo'
import { CrmProvider, useCrm } from './CrmProvider'
import { crmNavFor, crmIsActive } from '@/lib/crm/nav'
import { ROLE_LABEL, type CrmContext } from '@/lib/crm/types'
import { createCrmBrowserClient } from '@/lib/crm/supabase/client'

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const ctx = useCrm()
  const pathname = usePathname()
  const groups = crmNavFor(ctx)
  return (
    <nav className="sb-nav">
      {groups.map(sec => (
        <div key={sec.g}>
          <p className="sb-group">{sec.g}</p>
          {sec.items.map(({ href, label, Icon }) => (
            <Link key={href} href={href} onClick={onNavigate} className={`sb-item ${crmIsActive(pathname, href) ? 'active' : ''}`}>
              <span className="sb-icon"><Icon size={14} strokeWidth={1.8} /></span>
              <span style={{ flex: 1 }}>{label}</span>
            </Link>
          ))}
        </div>
      ))}
      <div>
        <p className="sb-group">Diğer</p>
        <a href="/" className="sb-item">
          <span className="sb-icon"><MessageCircle size={14} strokeWidth={1.8} /></span>
          <span style={{ flex: 1 }}>WhatsApp Paneli</span>
        </a>
      </div>
    </nav>
  )
}

function UserBox() {
  const ctx = useCrm()
  const router = useRouter()
  const name = `${ctx.profile.first_name} ${ctx.profile.last_name}`.trim()
  const init = `${ctx.profile.first_name[0] || ''}${ctx.profile.last_name[0] || ''}`.toUpperCase()
  async function logout() {
    await createCrmBrowserClient().auth.signOut()
    router.replace('/crm/login'); router.refresh()
  }
  return (
    <div className="sb-user" onClick={logout}>
      <div className="sb-av">{init || '?'}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--tx)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</p>
        <p style={{ fontSize: 10, color: 'var(--tx3)', marginTop: 1 }}>{ctx.roles.map(r => ROLE_LABEL[r] || r)[0] || 'Rol atanmamış'} · Çıkış</p>
      </div>
      <LogOut size={13} style={{ color: 'var(--tx3)', flexShrink: 0 }} strokeWidth={1.8} />
    </div>
  )
}

function Brand({ small }: { small?: boolean }) {
  return (
    <>
      <RobertoLogo size={small ? 28 : 32} />
      <div>
        <p style={{ fontSize: small ? 12.5 : 13.5, fontWeight: 700, color: 'var(--tx)', letterSpacing: '-.2px', lineHeight: 1.2 }}>Roberto CRM</p>
        <p style={{ fontSize: 9.5, color: 'var(--tx3)', marginTop: 2 }}>Müşteri İlişkileri</p>
      </div>
    </>
  )
}

function Mobile() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => { setOpen(false) }, [pathname])
  return (
    <>
      <style>{`
        .mm-trigger{position:fixed;top:10px;left:10px;z-index:9998;width:36px;height:36px;border-radius:10px;background:var(--s1);border:1px solid var(--bdr);display:flex;align-items:center;justify-content:center;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.25)}
        .mm-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9998;backdrop-filter:blur(4px)}
        .mm-drawer{position:fixed;top:0;left:0;bottom:0;width:260px;background:var(--s1);border-right:1px solid var(--bdr);z-index:9999;display:flex;flex-direction:column;overflow:hidden}
      `}</style>
      <button className="mm-trigger" onClick={() => setOpen(true)} aria-label="Menü"><Menu size={16} color="var(--tx2)" strokeWidth={2} /></button>
      {open && <div className="mm-backdrop" onClick={() => setOpen(false)} />}
      {open && (
        <div className="mm-drawer">
          <div className="sb-logo" style={{ justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Brand small /></div>
            <button onClick={() => setOpen(false)} style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--s2)', border: '1px solid var(--bdr)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tx3)' }}><X size={13} /></button>
          </div>
          <NavList onNavigate={() => setOpen(false)} />
          <UserBox />
        </div>
      )}
    </>
  )
}

export default function CrmShell({ ctx, children }: { ctx: CrmContext; children: ReactNode }) {
  return (
    <CrmProvider value={ctx}>
      <style>{`
        .dw{display:flex;height:100vh;overflow:hidden;background:var(--bg)}
        .dsb{display:flex}
        .dm{flex:1;display:flex;flex-direction:column;min-width:0;overflow-y:auto;overflow-x:hidden}
        .mm-mobile{display:none}
        @media(max-width:768px){.dw{flex-direction:column}.dsb{display:none}.mm-mobile{display:block}}
      `}</style>
      <div className="dw">
        <div className="dsb">
          <aside className="sb">
            <div className="sb-logo"><Brand /></div>
            <NavList />
            <UserBox />
          </aside>
        </div>
        <div className="mm-mobile"><Mobile /></div>
        <main className="dm">{children}</main>
      </div>
    </CrmProvider>
  )
}
