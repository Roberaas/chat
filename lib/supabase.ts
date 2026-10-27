// Tarayıcıdan veritabanına doğrudan bağlantı yok: veri /api/* rotalarından gelir. Burada yalnızca tipler bulunur.
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
