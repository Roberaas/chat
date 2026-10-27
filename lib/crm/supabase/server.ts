import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Sunucu: kullanıcının oturumuyla çalışır (RLS geçerli).
export function createCrmServerClient() {
  const store = cookies()
  return createServerClient<any, 'crm'>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      db: { schema: 'crm' },
      cookies: {
        getAll: () => store.getAll(),
        setAll: (list) => {
          try { list.forEach(({ name, value, options }) => store.set(name, value, options)) } catch { /* Server Component: middleware yeniler */ }
        },
      },
    }
  )
}
