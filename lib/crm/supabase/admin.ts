import { createClient } from '@supabase/supabase-js'

// SADECE sunucu (route handler). RLS'i atlar; çağırmadan önce yetki kontrolü zorunludur.
export function createCrmAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY tanımlı değil')
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: 'crm' },
  })
}
