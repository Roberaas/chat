import {
  LayoutDashboard, MessagesSquare, Headphones, Users, CheckSquare,
  CalendarDays, BarChart3, FileText, UserCog,
} from 'lucide-react'

export type Rol = 'admin' | 'operasyon' | 'destek'

export type NavItem = {
  href: string
  label: string
  Icon: any
  roles: Rol[]
  badge?: 'konusmalar' | 'canli'
}

// Roller middleware.ts ROL_YETKILER ile birebir uyumlu
export const NAV: { g: string; items: NavItem[] }[] = [
  { g: 'Genel', items: [
    { href: '/', label: 'Genel Bakış', Icon: LayoutDashboard, roles: ['admin', 'operasyon', 'destek'] },
  ]},
  { g: 'WhatsApp Bot', items: [
    { href: '/konusmalar',  label: 'Konuşmalar',  Icon: MessagesSquare, roles: ['admin', 'destek'], badge: 'konusmalar' },
    { href: '/canli-destek', label: 'Canlı Destek', Icon: Headphones,    roles: ['admin', 'destek'], badge: 'canli' },
    { href: '/musteriler',  label: 'Müşteriler',  Icon: Users,          roles: ['admin', 'operasyon'] },
  ]},
  { g: 'Ekip', items: [
    { href: '/calisma', label: 'Çalışma', Icon: CheckSquare, roles: ['admin', 'operasyon', 'destek'] },
    { href: '/takvim',  label: 'Takvim',  Icon: CalendarDays, roles: ['admin', 'operasyon', 'destek'] },
  ]},
  { g: 'Raporlama', items: [
    { href: '/raporlar',   label: 'Raporlar',   Icon: BarChart3, roles: ['admin', 'operasyon'] },
    { href: '/rapor-ilet', label: 'Rapor İlet', Icon: FileText,  roles: ['admin'] },
  ]},
  { g: 'Sistem', items: [
    { href: '/kullanicilar', label: 'Kullanıcılar', Icon: UserCog, roles: ['admin'] },
  ]},
]

export const ROL_ETIKET: Record<string, string> = {
  admin: 'Yönetici', operasyon: 'Operasyon', destek: 'Destek',
}

export function navFor(rol: string) {
  return NAV.map(s => ({ ...s, items: s.items.filter(i => i.roles.includes((rol as Rol))) }))
    .filter(s => s.items.length > 0)
}

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname.startsWith(href)
}
