import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: { persistSession: false },
  }
)

export type Session = {
  phone: string
  bulundugu_menu: string
  last_intent: string | null
  pending_action: string | null
  kvkk_onay: boolean
  kvkk_onay_tarihi: string | null
  musteri_yazdigi: string | null
  slack_thread_ts: string | null
  last_products: any
  updated_at: string
  gecmis: string | null
}
