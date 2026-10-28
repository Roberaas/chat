import { hrefDisabled } from '@/lib/crm/modules'
import {
  LayoutDashboard, Store, UserCog, ScrollText, ShieldCheck, Contact, Target, Gem, CheckSquare, CalendarDays, Filter, Megaphone, Wrench, Building2, Workflow, Plug, BarChart3, FileSpreadsheet, Activity, Bell, BookOpen, Settings, Flag, ShoppingBag, Cake, PieChart, GitMerge, KeyRound, Tags, Wallet, CalendarRange, ListPlus,
} from 'lucide-react'

export type CrmNavItem = { href: string; label: string; Icon: any; perm?: string; anyOf?: string[] }

// Menüde görünmeyen, Ayarlar sayfasından açılan veri ve yönetim sayfaları
export const ADMIN_LINKS: (CrmNavItem & { desc: string })[] = [
  { href: '/crm/musteriler', label: 'Tüm Müşteriler', Icon: Contact, perm: 'customers.read', desc: 'Kanal ayrımı olmadan tüm müşteri listesi' },
  { href: '/crm/rehber', label: 'Rehber', Icon: BookOpen, desc: 'Kullanım kılavuzu' },
  { href: '/crm/b2b', label: 'B2B / Bayi', Icon: Building2, perm: 'b2b.read', desc: 'Bayi ve toptancı firmaları, yetkili kişiler' },
  { href: '/crm/fiyatlar', label: 'Fiyat Listeleri', Icon: Tags, perm: 'pricing.read', desc: 'Bayiye özel fiyat ve iskonto' },
  { href: '/crm/cari', label: 'Cari / Kredi', Icon: Wallet, perm: 'credit.read', desc: 'Bayi bakiyesi, limit ve vade' },
  { href: '/crm/iceaktar', label: 'İçe / Dışa Aktar', Icon: FileSpreadsheet, anyOf: ['data.import', 'customers.export', 'reports.export'], desc: 'Excel ile toplu veri yükleme ve indirme' },
  { href: '/crm/entegrasyonlar', label: 'Entegrasyonlar', Icon: Plug, perm: 'integrations.manage', desc: 'Pusula, Crealive, n8n bağlantıları' },
  { href: '/crm/magazalar', label: 'Mağazalar', Icon: Store, anyOf: ['stores.manage', 'users.read'], desc: 'Mağaza, bayi ve toptancı tanımları' },
  { href: '/crm/kullanicilar', label: 'Kullanıcılar', Icon: UserCog, perm: 'users.read', desc: 'CRM kullanıcıları ve şifre sıfırlama' },
  { href: '/crm/alanlar', label: 'Özel Alanlar / Etiketler', Icon: ListPlus, perm: 'settings.manage', desc: 'Müşteri kartına kendi alanlarınız' },
  { href: '/crm/roller', label: 'Roller ve Yetkiler', Icon: KeyRound, perm: 'settings.manage', desc: 'Kim neyi görür' },
  { href: '/crm/mukerrerler', label: 'Mükerrer Kayıtlar', Icon: GitMerge, perm: 'customers.merge', desc: 'Çift müşteri kayıtlarını birleştirme' },
  { href: '/crm/denetim', label: 'Denetim Kaydı', Icon: ScrollText, perm: 'audit.read', desc: 'Kim neyi değiştirdi' },
  { href: '/crm/guvenlik', label: 'Güvenlik', Icon: ShieldCheck, desc: 'Hesap güvenliği' },
]
const ADMIN_PERMS = ['customers.read', 'orders.read', 'products.read', 'integrations.manage', 'settings.manage', 'b2b.read', 'pricing.read', 'credit.read', 'data.import', 'customers.export', 'reports.export', 'stores.manage', 'users.read', 'customers.merge', 'audit.read']

export function crmItemAllowed(ctx: { isSuperAdmin: boolean; permissions: string[] }, i: CrmNavItem) {
  if (ctx.isSuperAdmin) return true
  if (i.perm) return ctx.permissions.includes(i.perm)
  if (i.anyOf) return i.anyOf.some(p => ctx.permissions.includes(p))
  return true
}

// Yeni modüller tamamlandıkça buraya eklenir (işlevsiz/dekoratif menü bırakılmaz).
export const CRM_NAV: { g: string; items: CrmNavItem[] }[] = [
  { g: 'Genel', items: [
    { href: '/crm', label: 'Dashboard', Icon: LayoutDashboard, perm: 'dashboard.read' },
    { href: '/crm/raporlar', label: 'Raporlar', Icon: BarChart3, perm: 'dashboard.read' },
    { href: '/crm/bayi-raporu', label: 'Müşteri Raporum', Icon: Contact, perm: 'dashboard.read' },
    { href: '/crm/hedefler', label: 'Hedefler', Icon: Flag, perm: 'targets.read' },
    { href: '/crm/bildirimler', label: 'Bildirimler', Icon: Bell },
  ]},
  { g: 'Data', items: [
    { href: '/crm/musteriler?kanal=eticaret', label: 'E-Ticaret', Icon: ShoppingBag, perm: 'customers.read' },
    { href: '/crm/musteriler?kanal=perakende', label: 'Perakende', Icon: Store, perm: 'customers.read' },
    { href: '/crm/musteriler?kanal=toptan', label: 'Toptan', Icon: Building2, perm: 'customers.read' },
    { href: '/crm/iceaktar', label: 'Excel İçe / Dışa Aktar', Icon: FileSpreadsheet, anyOf: ['data.import', 'customers.export', 'reports.export'] },
    { href: '/crm/siparisler', label: 'Siparişler', Icon: ShoppingBag, perm: 'orders.read' },
    { href: '/crm/urunler',    label: 'Ürünler',    Icon: Gem,    perm: 'products.read' },
    { href: '/crm/firsatlar',  label: 'Fırsatlar',  Icon: Target, perm: 'opportunities.read' },
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
  { g: 'Yönetim', items: [
    { href: '/crm/aktivite', label: 'Aktivite İzleme', Icon: Activity, perm: 'activity.read' },
    { href: '/crm/otomasyonlar',   label: 'Otomasyonlar',   Icon: Workflow, perm: 'settings.manage' },
  ]},
  { g: 'Sistem', items: [
    { href: '/crm/ayarlar', label: 'Ayarlar', Icon: Settings, anyOf: ADMIN_PERMS },
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
