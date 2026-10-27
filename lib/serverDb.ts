import { createClient } from '@supabase/supabase-js'

// Yalnızca sunucu tarafı (API rotaları). Servis anahtarı tarayıcıya asla gitmez.
export const adminDb = () => createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
