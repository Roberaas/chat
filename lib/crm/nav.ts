import {
  LayoutDashboard, Store, UserCog, ScrollText, ShieldCheck, Contact, Target, Gem, CheckSquare, CalendarDays, Filter, Megaphone, Wrench, Building2, Workflow, Plug,
} from 'lucide-react'

export type CrmNavItem = { href: string; label: string; Icon: any; perm?: string; anyOf?: string[] }

// Yeni modüller tamamlandıkça buraya eklenir (işlevsiz/dekoratif menü bırakılmaz).
export const CRM_NAV: { g: string; items: CrmNavItem[] }[] = [
  { g: 'Genel', items: [
    { href: '/crm', label: 'Dashboard', Icon: LayoutDashboard, perm: 'dashboard.read' },
  ]},
  { g: 'Müşteri', items: [
    { href: '/crm/musteriler', label: 'Müşteriler', Icon: Contact, perm: 'customers.read' },
    { href: '/crm/firsatlar',  label: 'Fırsatlar',  Icon: Target, perm: 'opportunities.read' },
    { href: '/crm/urunler',    label: 'Ürünler',    Icon: Gem,    perm: 'products.read' },
    { href: '/crm/gorevler',   label: 'Görevler',   Icon: CheckSquare, perm: 'tasks.read' },
    { href: '/crm/randevular', label: 'Randevular', Icon: CalendarDays, perm: 'appointments.read' },
    { href: '/crm/servis',     label: 'Satış Sonrası', Icon: Wrench, perm: 'service.read' },
  ]},
  { g: 'Pazarlama', items: [
    { href: '/crm/segmentler',  label: 'Segmentler',  Icon: Filter,    perm: 'segments.read' },
    { href: '/crm/kampanyalar', label: 'Kampanyalar', Icon: Megaphone, perm: 'campaigns.read' },
  ]},
  { g: 'Kurumsal', items: [
    { href: '/crm/b2b', label: 'B2B / Bayi', Icon: Building2, perm: 'b2b.read' },
  ]},
  { g: 'Yönetim', items: [
    { href: '/crm/otomasyonlar',   label: 'Otomasyonlar',   Icon: Workflow, perm: 'settings.manage' },
    { href: '/crm/entegrasyonlar', label: 'Entegrasyonlar', Icon: Plug,     perm: 'integrations.manage' },
    { href: '/crm/magazalar',   label: 'Mağazalar',    Icon: Store,      anyOf: ['stores.manage', 'users.read'] },
    { href: '/crm/kullanicilar', label: 'Kullanıcılar', Icon: UserCog,    perm: 'users.read' },
    { href: '/crm/denetim',     label: 'Denetim Kaydı', Icon: ScrollText, perm: 'audit.read' },
  ]},
  { g: 'Hesabım', items: [
    { href: '/crm/guvenlik', label: 'Güvenlik', Icon: ShieldCheck },
  ]},
]

export function crmNavFor(ctx: { isSuperAdmin: boolean; permissions: string[] }) {
  const ok = (i: CrmNavItem) => {
    if (ctx.isSuperAdmin) return true
    if (i.perm) return ctx.permissions.includes(i.perm)
    if (i.anyOf) return i.anyOf.some(p => ctx.permissions.includes(p))
    return true
  }
  return CRM_NAV.map(s => ({ ...s, items: s.items.filter(ok) })).filter(s => s.items.length)
}

export const crmIsActive = (pathname: string, href: string) =>
  href === '/crm' ? pathname === '/crm' : pathname === href || pathname.startsWith(href + '/')
