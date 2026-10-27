import {
  LayoutDashboard, Store, UserCog, ScrollText, ShieldCheck, Contact, Target, Gem,
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
  ]},
  { g: 'Yönetim', items: [
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
