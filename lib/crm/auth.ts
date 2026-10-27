import { cache } from 'react'
import { redirect } from 'next/navigation'
import { NextResponse } from 'next/server'
import { createCrmServerClient } from './supabase/server'
import { can, type CrmContext } from './types'

// Yetki kaynağı: crm.user_roles / role_permissions / store_memberships (DB).
// user_metadata veya JWT'deki kullanıcı-değiştirebilir alanlar ASLA kullanılmaz.
export const getCrmContext = cache(async (): Promise<CrmContext | null> => {
  const supabase = createCrmServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data, error } = await supabase.rpc('me')
  if (error || !data?.profile) return null
  const roles: string[] = data.roles || []
  return {
    userId: user.id,
    profile: data.profile,
    roles,
    permissions: data.permissions || [],
    storeIds: data.store_ids || [],
    scope: data.scope || 'own',
    isSuperAdmin: roles.includes('super_admin'),
  }
})

// Sayfa (Server Component) koruması
export async function requireCrm(perm?: string): Promise<CrmContext> {
  const ctx = await getCrmContext()
  if (!ctx) redirect('/crm/login')
  if (!ctx.profile.is_active) redirect('/crm/login?e=pasif')
  if (perm && !can(ctx, perm)) redirect('/crm/yetkisiz')
  return ctx
}

// Route handler koruması
export async function apiGuard(perm?: string | { superAdmin: true }):
  Promise<{ ctx: CrmContext } | { res: NextResponse }> {
  const ctx = await getCrmContext()
  if (!ctx) return { res: NextResponse.json({ ok: false, error: 'Oturum gerekli' }, { status: 401 }) }
  if (!ctx.profile.is_active) return { res: NextResponse.json({ ok: false, error: 'Hesap pasif' }, { status: 403 }) }
  if (perm) {
    const allowed = typeof perm === 'string' ? can(ctx, perm) : ctx.isSuperAdmin
    if (!allowed) return { res: NextResponse.json({ ok: false, error: 'Yetkiniz yok' }, { status: 403 }) }
  }
  if (!rateLimit(ctx.userId)) return { res: NextResponse.json({ ok: false, error: 'Çok fazla istek, biraz bekleyin' }, { status: 429 }) }
  return { ctx }
}

// Basit bellek-içi hız sınırı (instance başına). Kalıcı/dağıtık sınır için Aşama 13'te Redis/DB.
const hits = new Map<string, number[]>()
export function rateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now()
  const arr = (hits.get(key) || []).filter(t => now - t < windowMs)
  if (arr.length >= limit) { hits.set(key, arr); return false }
  arr.push(now); hits.set(key, arr)
  if (hits.size > 5000) hits.clear()
  return true
}
