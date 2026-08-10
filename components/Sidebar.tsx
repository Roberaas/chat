'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { LayoutDashboard, MessagesSquare, Headphones, BarChart3, LogOut, X, Users, CheckSquare, CalendarDays, UserCog } from 'lucide-react'

export default function Sidebar({ onClose, dark }: { onClose?: () => void; dark?: boolean }) {
  const pathname = usePathname()
  const router = useRouter()
  const [canliCount, setCanliCount] = useState(0)
  const [konusmalar, setKonusmalar] = useState(0)
  const [mevcutKullanici, setMevcutKullanici] = useState<{ ad: string; rol: string } | null>(null)

  useEffect(() => {
    async function loadCounts() {
      const { data } = await supabase.from('wa_sessions_roberto').select('phone, slack_thread_ts, updated_at')
      const sessions = data || []
      setCanliCount(sessions.filter((s: any) => s.slack_thread_ts && s.slack_thread_ts !== '').length)
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
    { href: '/', label: 'Genel Bakış', icon: LayoutDashboard, badge: null },
    { href: '/konusmalar', label: 'Konuşmalar', icon: MessagesSquare, badge: konusmalar > 0 ? konusmalar : null },
    { href: '/canli-destek', label: 'Canlı Destek', icon: Headphones, badge: canliCount > 0 ? canliCount : null, urgent: canliCount > 0 },
    { href: '/musteriler', label: 'Müşteriler', icon: Users, badge: null },
    { href: '/calisma', label: 'Çalışma', icon: CheckSquare, badge: null },
    { href: '/takvim', label: 'Takvim', icon: CalendarDays, badge: null },
    { href: '/kullanicilar', label: 'Kullanıcılar', icon: UserCog, badge: null },
    { href: '/raporlar', label: 'Raporlar', icon: BarChart3, badge: null },
  ]

  return (
    <aside className="w-64 h-full bg-ink-900 text-cream-100 flex flex-col">
      <div className="px-6 py-5 border-b border-ink-700 flex items-center justify-between">
        <div>
          <div className="font-display text-2xl tracking-tight text-cream-50">roberto<span className="text-moss-300">.</span></div>
          <div className="text-[10px] uppercase tracking-[0.25em] text-ink-300 mt-0.5">admin</div>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden w-8 h-8 flex items-center justify-center text-ink-400 hover:text-cream-50 transition-colors">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {mevcutKullanici && (
        <div className="px-6 py-3 border-b border-ink-700/50 flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-moss-700 flex items-center justify-center text-xs font-bold text-moss-200">
            {mevcutKullanici.ad.slice(0,1).toUpperCase()}
          </div>
          <div>
            <div className="text-xs font-medium text-cream-200">{mevcutKullanici.ad}</div>
            <div className="text-[10px] text-ink-400 font-mono">{mevcutKullanici.rol}</div>
          </div>
        </div>
      )}

      <nav className="flex-1 p-3 overflow-y-auto">
        <ul className="space-y-0.5">
          {items.map((item) => {
            const Icon = item.icon
            const active = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onClose}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all ${active ? 'bg-moss-700 text-cream-50' : 'text-ink-200 hover:bg-ink-700 hover:text-cream-50'}`}
                >
                  <Icon className="w-4 h-4 shrink-0" strokeWidth={1.75} />
                  <span className="text-sm font-medium flex-1">{item.label}</span>
                  {item.badge !== null ? (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${(item as any).urgent ? 'bg-ember-500 text-white animate-pulse' : 'bg-ink-600 text-ink-200'}`}>
                      {item.badge}
                    </span>
                  ) : active ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-moss-300" />
                  ) : null}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      <div className="p-3 border-t border-ink-700">
        <button onClick={logout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-ink-300 hover:text-cream-50 hover:bg-ink-700 transition-all text-sm">
          <LogOut className="w-4 h-4" strokeWidth={1.75} />
          Çıkış Yap
        </button>
      </div>
    </aside>
  )
}
