// İçe aktarma şablonları: hem sunucu (şablon üretimi) hem istemci (sütun eşleme) kullanır.
export type ImportKind = 'customers' | 'products' | 'b2b_accounts'
export type ImportField = { key: string; label: string; required?: boolean; aliases?: string[]; example: string; note?: string }

export const IMPORT_KINDS: Record<ImportKind, { label: string; perm: string; rpc: string; fields: ImportField[] }> = {
  customers: {
    label: 'Müşteriler', perm: 'customers.write', rpc: 'import_customers',
    fields: [
      { key: 'first_name', label: 'Ad', required: true, aliases: ['isim', 'adı', 'first name', 'name'], example: 'Ayşe' },
      { key: 'last_name', label: 'Soyad', aliases: ['soyadı', 'last name', 'surname'], example: 'Kaya' },
      { key: 'phone', label: 'Telefon', aliases: ['gsm', 'cep', 'cep telefonu', 'tel', 'mobile'], example: '0532 123 45 67', note: 'Telefon veya e-posta zorunlu; mükerrer kontrolü bunlarla yapılır' },
      { key: 'email', label: 'E-posta', aliases: ['eposta', 'mail', 'e-mail', 'email'], example: 'ayse@ornek.com' },
      { key: 'city', label: 'Şehir', aliases: ['il', 'sehir'], example: 'Bursa' },
      { key: 'birth_date', label: 'Doğum Tarihi', aliases: ['doğum', 'dogum tarihi', 'birth date', 'birthday'], example: '1990-05-21', note: 'YYYY-AA-GG' },
      { key: 'source', label: 'Kaynak', aliases: ['kanal', 'source'], example: 'walk_in', note: 'walk_in, whatsapp, ecommerce, referral, event, social, phone, other' },
    ],
  },
  products: {
    label: 'Ürünler', perm: 'products.write', rpc: 'import_products',
    fields: [
      { key: 'sku', label: 'Stok Kodu', required: true, aliases: ['sku', 'kod', 'ürün kodu', 'urun kodu'], example: 'RB-1001' },
      { key: 'name', label: 'Ürün Adı', required: true, aliases: ['ad', 'isim', 'ürün', 'urun', 'name'], example: 'Tek Taş Yüzük' },
      { key: 'category', label: 'Kategori', aliases: ['category'], example: 'Yüzük' },
      { key: 'material', label: 'Malzeme', aliases: ['materyal', 'material'], example: '14K Altın' },
      { key: 'collection', label: 'Koleksiyon', aliases: ['collection'], example: 'Klasik', note: 'Sistemde kayıtlı koleksiyon adı/kodu' },
      { key: 'price', label: 'Fiyat', aliases: ['price', 'tutar'], example: '12500,00' },
      { key: 'status', label: 'Durum', aliases: ['status'], example: 'active', note: 'draft, active, discontinued' },
      { key: 'description', label: 'Açıklama', aliases: ['description', 'detay'], example: '' },
    ],
  },
  b2b_accounts: {
    label: 'B2B Firmalar', perm: 'b2b.write', rpc: 'import_b2b_accounts',
    fields: [
      { key: 'name', label: 'Firma Adı', required: true, aliases: ['firma', 'ünvan', 'unvan', 'name', 'şirket', 'sirket'], example: 'Örnek Kuyumculuk Ltd.' },
      { key: 'type', label: 'Tür', aliases: ['type', 'tip'], example: 'dealer', note: 'dealer, corporate, wholesale' },
      { key: 'status', label: 'Durum', aliases: ['status'], example: 'prospect', note: 'prospect, active, suspended, closed' },
      { key: 'tax_office', label: 'Vergi Dairesi', aliases: ['vd'], example: 'Osmangazi' },
      { key: 'tax_no', label: 'Vergi No', aliases: ['vkn', 'vergi numarası', 'vergi numarasi', 'tckn'], example: '1234567890', note: 'Varsa eşleştirme bununla yapılır' },
      { key: 'city', label: 'Şehir', aliases: ['il'], example: 'Bursa' },
      { key: 'phone', label: 'Telefon', aliases: ['tel', 'gsm'], example: '0224 000 00 00' },
      { key: 'email', label: 'E-posta', aliases: ['mail', 'eposta'], example: 'info@ornek.com' },
      { key: 'notes', label: 'Not', aliases: ['notlar', 'açıklama'], example: '' },
    ],
  },
}

export const normHeader = (s: string) =>
  s.toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Başlıkları alanlara otomatik eşler: sütun indeksi → alan anahtarı */
export function autoMap(headers: string[], kind: ImportKind): Record<string, number> {
  const out: Record<string, number> = {}
  const used = new Set<number>()
  const fields = IMPORT_KINDS[kind].fields
  const hs = headers.map(normHeader)
  for (const f of fields) {
    const names = [f.key, f.label, ...(f.aliases || [])].map(normHeader)
    const idx = hs.findIndex((h, i) => !used.has(i) && names.includes(h))
    if (idx >= 0) { out[f.key] = idx; used.add(idx) }
  }
  return out
}
