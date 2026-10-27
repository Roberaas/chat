'use client'
import { createBrowserClient } from '@supabase/ssr'

// Tarayıcı: yalnızca anon key + kullanıcı oturumu. RLS ile korunur. Service role ASLA burada kullanılmaz.
export function createCrmBrowserClient() {
  return createBrowserClient<any, 'crm'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { db: { schema: 'crm' } }
  )
}
