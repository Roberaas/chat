export type CrmProfile = {
  id: string; organization_id: string; first_name: string; last_name: string; email: string
  phone: string | null; department_id: string | null; is_active: boolean
  last_sign_in_at: string | null; must_change_password: boolean; created_at: string
}
export type CrmContext = {
  userId: string
  profile: CrmProfile
  roles: string[]
  permissions: string[]
  storeIds: string[]
  scope: 'all' | 'stores' | 'own'
  isSuperAdmin: boolean
  disabledModules?: string[]
}
export const ROLE_LABEL: Record<string, string> = {
  super_admin: 'Super Admin', executive: 'Üst Yönetim', crm_marketing: 'CRM / Pazarlama',
  store_manager: 'Mağaza Müdürü', sales_advisor: 'Satış Danışmanı',
  ecommerce_support: 'E-ticaret / Müşteri Hizmetleri', after_sales: 'Satış Sonrası Hizmetler',
  b2b_manager: 'B2B / Bayi Yöneticisi',
  dealer_admin: 'Bayi / Toptancı Yöneticisi', dealer_user: 'Bayi / Toptancı Kullanıcısı',
}
export const can = (ctx: Pick<CrmContext, 'isSuperAdmin' | 'permissions'>, perm: string) =>
  ctx.isSuperAdmin || ctx.permissions.includes(perm)
