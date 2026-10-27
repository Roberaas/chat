import { hrefDisabled } from '@/lib/crm/modules'
import {
  LayoutDashboard, Store, UserCog, ScrollText, ShieldCheck, Contact, Target, Gem, CheckSquare, CalendarDays, Filter, Megaphone, Wrench, Building2, Workflow, Plug, BarChart3, FileSpreadsheet, Activity, Bell, BookOpen, Settings, Flag, ShoppingBag, Cake, PieChart, GitMerge, KeyRound, Tags, Wallet, CalendarRange, ListPlus,
} from 'lucide-react'

export type CrmNavItem = { href: string; label: string; Icon: any; perm?: string; anyOf?: string[] }

// Yeni modüller tamamlandıkça buraya eklenir (işlevsiz/dekoratif menü bırakılmaz).
export const CRM_NAV: { g: string; items: CrmNavItem[] }[] = [
  { g: 'Genel', items: [
    { href: '/crm', label: 'Dashboard', Icon: LayoutDashboard, perm: 'dashboard.read' },
    { href: '/crm/raporlar', label: 'Raporlar', Icon: BarChart3, perm: 'dashboard.read' },
    { href: '/crm/bayi-raporu', label: 'Müşteri Raporum', Icon: Contact, perm: 'dashboard.read' },
    { href: '/crm/hedefler', label: 'Hedefler', Icon: Flag, perm: 'targets.read' },
    { href: '/crm/bildirimler', label: 'Bildirimler', Icon: Bell },
    { href: '/crm/rehber', label: 'Rehber', Icon: BookOpen },
  ]},
  { g: 'Müşteri', items: [
    { href: '/crm/musteriler', label: 'Müşteriler', Icon: Contact, perm: 'customers.read' },
    { href: '/crm/firsatlar',  label: 'Fırsatlar',  Icon: Target, perm: 'opportunities.read' },
    { href: '/crm/siparisler', label: 'Siparişler', Icon: ShoppingBag, perm: 'orders.read' },
    { href: '/crm/urunler',    label: 'Ürünler',    Icon: Gem,    perm: 'products.read' },
    { href: '/crm/ozel-gunler', label: 'Özel Günler', Icon: Cake, perm: 'customers.read' },
    { href: '/crm/gorevler',   label: 'Görevler',   Icon: CheckSquare, perm: 'tasks.read' },
    { href: '/crm/takvim', label: 'Takvim', Icon: CalendarRange, anyOf: ['tasks.read', 'appointments.read'] },
    { href: '/crm/randevular', label: 'Randevular', Icon: CalendarDays, perm: 'appointments.read' },
    { href: '/crm/servis',     label: 'Satış Sonrası', Icon: Wrench, perm: 'service.read' },
  ]},
  { g: 'Pazarlama', items: [
    { href: '/crm/analiz', label: 'Müşteri Analizi', Icon: PieChart, perm: 'reports.read' },
    { href: '/crm/segmentler',  label: 'Segmentler',  Icon: Filter,    perm: 'segments.read' },
    { href: '/crm/kampanyalar', label: 'Kampanyalar', Icon: Megaphone, perm: 'campaigns.read' },
  ]},
  { g: 'Kurumsal', items: [
    { href: '/crm/b2b', label: 'B2B / Bayi', Icon: Building2, perm: 'b2b.read' },
    { href: '/crm/fiyatlar', label: 'Fiyat Listeleri', Icon: Tags, perm: 'pricing.read' },
    { href: '/crm/cari', label: 'Cari / Kredi', Icon: Wallet, perm: 'credit.read' },
  ]},
  { g: 'Yönetim', items: [
    { href: '/crm/aktivite', label: 'Aktivite İzleme', Icon: Activity, perm: 'activity.read' },
    { href: '/crm/iceaktar', label: 'İçe / Dışa Aktar', Icon: FileSpreadsheet, anyOf: ['data.import', 'customers.export', 'reports.export'] },
    { href: '/crm/otomasyonlar',   label: 'Otomasyonlar',   Icon: Workflow, perm: 'settings.manage' },
    { href: '/crm/entegrasyonlar', label: 'Entegrasyonlar', Icon: Plug,     perm: 'integrations.manage' },
    { href: '/crm/ayarlar', label: 'Ayarlar / API', Icon: Settings, perm: 'integrations.manage' },
    { href: '/crm/magazalar',   label: 'Mağazalar',    Icon: Store,      anyOf: ['stores.manage', 'users.read'] },
    { href: '/crm/kullanicilar', label: 'Kullanıcılar', Icon: UserCog,    perm: 'users.read' },
    { href: '/crm/alanlar', label: 'Özel Alanlar / Etiketler', Icon: ListPlus, perm: 'settings.manage' },
    { href: '/crm/roller', label: 'Roller ve Yetkiler', Icon: KeyRound, perm: 'settings.manage' },
    { href: '/crm/mukerrerler', label: 'Mükerrer Kayıtlar', Icon: GitMerge, perm: 'customers.merge' },
    { href: '/crm/denetim',     label: 'Denetim Kaydı', Icon: ScrollText, perm: 'audit.read' },
  ]},
  { g: 'Hesabım', items: [
    { href: '/crm/guvenlik', label: 'Güvenlik', Icon: ShieldCheck },
  ]},
]

export function crmNavFor(ctx: { isSuperAdmin: boolean; permissions: string[]; disabledModules?: string[] }) {
  const ok = (i: CrmNavItem) => {
    if (hrefDisabled(i.href, ctx.disabledModules)) return false
    if (ctx.isSuperAdmin) return true
    if (i.perm) return ctx.permissions.includes(i.perm)
    if (i.anyOf) return i.anyOf.some(p => ctx.permissions.includes(p))
    return true
  }
  return CRM_NAV.map(s => ({ ...s, items: s.items.filter(ok) })).filter(s => s.items.length)
}

export const crmIsActive = (pathname: string, href: string) =>
  href === '/crm' ? pathname === '/crm' : pathname === href || pathname.startsWith(href + '/')
