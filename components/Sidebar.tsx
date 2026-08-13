'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, MessagesSquare, Headphones, BarChart3, LogOut, X, Users, CheckSquare, CalendarDays, UserCog, FileText } from 'lucide-react'

export default function Sidebar({ onClose }: { onClose?: () => void; dark?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [canliCount, setCanliCount] = useState(0)
  const [konusmalar, setKonusmalar] = useState(0)
  const [mevcutKullanici, setMevcutKullanici] = useState<{ ad: string; rol: string } | null>(null)

  useEffect(() => {
    async function loadCounts() {
      const { data } = await supabase.from('wa_sessions_roberto').select('phone, slack_thread_ts, updated_at, bulundugu_menu')
      const sessions = data || []
      setCanliCount(sessions.filter((s: any) => s.bulundugu_menu === 'canli').length)
      setKonusmalar(sessions.filter((s: any) => new Date(s.updated_at).toDateString() === new Date().toDateString()).length)
    }
    loadCounts()
    const t = setInterval(loadCounts, 30000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    fetch('/api/auth').then(r => r.json()).then(d => {
      if (d.ok && d.kullanici) setMevcutKullanici(d.kullanici)
    })
  }, [])

  async function logout() {
    await fetch('/api/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  const items = [
    { href: '/', label: 'Genel Bakış', icon: LayoutDashboard },
    { href: '/konusmalar', label: 'Konuşmalar', icon: MessagesSquare, badge: konusmalar > 0 ? konusmalar : null },
    { href: '/canli-destek', label: 'Canlı Destek', icon: Headphones, badge: canliCount > 0 ? canliCount : null, urgent: canliCount > 0 },
    { href: '/musteriler', label: 'Müşteriler', icon: Users },
    { href: '/calisma', label: 'Çalışma', icon: CheckSquare },
    { href: '/takvim', label: 'Takvim', icon: CalendarDays },
    { href: '/kullanicilar', label: 'Kullanıcılar', icon: UserCog },
    { href: '/rapor-ilet', label: 'Rapor İlet', icon: FileText },
    { href: '/raporlar', label: 'Raporlar', icon: BarChart3 },
  ]

  return (
    <aside style={{ background: '#120F0C', borderRight: '1px solid rgba(201,168,76,0.1)' }} className="w-60 h-full flex flex-col">
      {/* Logo */}
      <div className="px-6 py-6" style={{ borderBottom: '1px solid rgba(201,168,76,0.08)' }}>
        <div className="flex items-center justify-between">
          <div>
            <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 22, fontWeight: 500, letterSpacing: '-0.02em', color: '#EDE8DF' }}>
              roberto<span style={{ color: '#C9A84C' }}>.</span>
            </div>
            <div style={{ fontSize: 9, letterSpacing: '0.3em', color: '#7A7468', marginTop: 2, textTransform: 'uppercase' }}>
              admin panel
            </div>
          </div>
          {onClose && (
            <button onClick={onClose} className="lg:hidden" style={{ color: '#7A7468' }}>
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      {/* User */}
      {mevcutKullanici && (
        <div className="px-4 py-3 mx-3 mt-3 rounded-lg" style={{ background: 'rgba(201,168,76,0.06)', border: '1px solid rgba(201,168,76,0.1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold" style={{ background: 'linear-gradient(135deg, #C9A84C, #8B6914)', color: '#0A0908' }}>
              {mevcutKullanici.ad.slice(0,1).toUpperCase()}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 500, color: '#E8D5A3' }}>{mevcutKullanici.ad}</div>
              <div style={{ fontSize: 10, color: '#7A7468', fontFamily: 'JetBrains Mono, monospace' }}>{mevcutKullanici.rol}</div>
            </div>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 p-3 overflow-y-auto mt-2">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
                  style={active ? {
                    background: 'linear-gradient(135deg, rgba(201,168,76,0.12), rgba(201,168,76,0.04))',
                    border: '1px solid rgba(201,168,76,0.18)',
                    color: '#E8D5A3',
                  } : {
                    color: '#7A7468',
                    border: '1px solid transparent',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#C8C0B0' }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.color = '#7A7468' }}
                >
                  <Icon size={15} strokeWidth={1.75} />
                  <span style={{ fontSize: 13, fontWeight: active ? 500 : 400, flex: 1 }}>{item.label}</span>
                  {(item as any).badge != null ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full font-bold" style={
                      (item as any).urgent
                        ? { background: '#8B2635', color: '#fff', animation: 'urgentPulse 1.5s ease-in-out infinite' }
                        : { background: 'rgba(201,168,76,0.15)', color: '#C9A84C' }
                    }>
                      {(item as any).badge}
                    </span>
                  ) : active ? (
                    <span className="w-1 h-1 rounded-full" style={{ background: '#C9A84C' }} />
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-3" style={{ borderTop: '1px solid rgba(201,168,76,0.08)' }}>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all"
          style={{ color: '#5A5550', fontSize: 13 }}
          onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#C8C0B0'}
          onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#5A5550'}
        >
          <LogOut size={15} strokeWidth={1.75} />
          Çıkış Yap
        </button>
      </div>
    </aside>
  )
}
