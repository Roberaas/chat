// Rehber ve entegrasyon şablonlarının içeriği (tek kaynak)
export type Preset = { code: string; kind: string; name: string; secret_env: string; how: string[] }

export const PRESETS: Preset[] = [
  { code: 'pusula', kind: 'erp', name: 'Pusula (ERP)', secret_env: 'CRM_WEBHOOK_SECRET_PUSULA', how: [
    'Pusula ERP yetkili kaynaktır: ürün, stok kodu, fiyat ve mağaza satışları buradan gelir. Gelen değer CRM\'dekini ezer.',
    'Pusula olay (webhook) gönderemiyorsa n8n zamanlayıcı ile değişenleri (son güncelleme tarihinden) çekip bu adrese imzalı POST edin.',
    'Şube/depo kodlarını CRM Mağaza kodlarıyla aynı yapın (store_code).'] },
  { code: 'crealive', kind: 'ecommerce', name: 'Crealive (e-ticaret)', secret_env: 'CRM_WEBHOOK_SECRET_CREALIVE', how: [
    'Crealive her yeni/güncellenen siparişte bu adrese imzalı POST atacak şekilde ayarlanmalı (özel yazılım olduğu için geliştirici ekleyebilir).',
    'Webhook mümkün değilse n8n ile sipariş listesi API\'sini zamanlayıcıyla çekin.',
    'Sipariş gövdesine müşteri telefon/e-posta ve pazarlama izni bilgisini ekletin.'] },
  { code: 'n8n', kind: 'other', name: 'n8n (köprü akışı)', secret_env: 'CRM_WEBHOOK_SECRET_N8N', how: [
    'Pusula/Crealive doğrudan imzalı gönderemiyorsa veriyi toplayıp CRM\'e ileten ara katman.'] },
]

export type ApiReq = { group: string; item: string; why: string; fields: string }
export const API_REQS: { system: string; role: string; asks: ApiReq[] }[] = [
  { system: 'Pusula (ERP)', role: 'Ürün, fiyat, stok ve mağaza satışlarının kaynağı', asks: [
    { group: 'Ürün', item: 'Ürün/stok listesi + "şu tarihten beri değişenler" uç noktası', why: 'Katalog ve fiyatlar CRM\'e otomatik gelir', fields: 'stok kodu, ad, kategori, malzeme, fiyat, para birimi, aktif/pasif, koleksiyon' },
    { group: 'Satış', item: 'Satış fatura/sipariş listesi (mağaza satışları) + değişenler', why: 'Mağaza satışı müşteriye ve danışmana yazılır', fields: 'fatura no, tarih, cari, şube kodu, satış personeli, kalemler (stok kodu, adet, fiyat), toplam' },
    { group: 'Müşteri', item: 'Cari (müşteri/bayi/toptancı) listesi', why: 'Müşteri ve bayi eşleştirme, B2B firmaları', fields: 'cari kodu, ünvan/ad soyad, telefon, e-posta, vergi no, il/ilçe, cari tipi' },
    { group: 'Mağaza', item: 'Şube/depo listesi', why: 'store_code eşlemesi', fields: 'şube kodu, ad, il' },
    { group: 'B2B', item: 'Cari bakiye ve tahsilat/ödeme (isteğe bağlı)', why: 'Toptancı/bayi kartında bakiye gösterimi', fields: 'cari kodu, bakiye, vade' },
    { group: 'Erişim', item: 'Adres (base URL), kimlik doğrulama türü, API anahtarı/kullanıcı, test ortamı, IP kısıtı, istek limiti, dokümantasyon bağlantısı', why: 'Bağlantı kurulumu', fields: 'Pusula teknik destekten veya yazılım sağlayıcıdan istenir' },
  ]},
  { system: 'Crealive (özel e-ticaret yazılımı)', role: 'Online siparişlerin ve üyelerin kaynağı', asks: [
    { group: 'Sipariş', item: 'Yeni/güncellenen sipariş için webhook (tercih) veya sipariş listesi API\'si', why: 'Online satışlar müşteriye otomatik işlenir', fields: 'sipariş id/no, durum, tarih, toplam, kalemler (stok kodu, adet, fiyat), iptal/iade durumu' },
    { group: 'Müşteri', item: 'Üye kaydı bilgisi (sipariş içinde veya ayrı API)', why: 'Müşteri oluşturma ve eşleştirme', fields: 'üye id, ad, soyad, telefon, e-posta' },
    { group: 'İzin', item: 'İletişim izni alanı (SMS/e-posta/WhatsApp onayı ve tarihi)', why: 'Kampanyalar yalnız izinli müşteriye gider (KVKK/İYS)', fields: 'kanal, onay durumu, onay zamanı' },
    { group: 'Ürün', item: 'Ürün kataloğu API\'si (Pusula yetkili değilse)', why: 'Ürün eşleştirme (stok kodu ortak olmalı)', fields: 'stok kodu, ad, kategori, fiyat, durum' },
    { group: 'Erişim', item: 'Webhook imzalama desteği (HMAC-SHA256) veya n8n ile köprü, API anahtarı, test ortamı, dokümantasyon', why: 'Güvenli bağlantı', fields: 'Crealive geliştiricisinden istenir' },
  ]},
]

export const SAMPLE_ORDER = {
  event_id: 'siparis-10045-v1',
  type: 'order.upsert',
  data: {
    source_id: '10045', order_no: 'SP-10045', status: 'paid', total: 4850, currency: 'TRY', ordered_at: '2026-10-27T10:30:00+03:00',
    store_code: 'ONLINE', advisor_email: 'danisman@robertobravo.com',
    customer: { source_id: 'C-778', first_name: 'Ayşe', last_name: 'Yılmaz', phone: '+905551112233', email: 'ayse@ornek.com' },
    items: [{ sku: 'YZK-001', name: 'Tektaş Yüzük', quantity: 1, unit_price: 4850 }],
  },
}
export const SAMPLE_PRODUCT = {
  event_id: 'urun-YZK-001-v1',
  type: 'product.upsert',
  data: { sku: 'YZK-001', name: 'Tektaş Yüzük', category: 'Yüzük', material: '925 Ayar Gümüş', price: 4850, currency: 'TRY', status: 'active', collection_code: 'TEK', collection_name: 'Tektaş Koleksiyonu' },
}

export const FIELDS: { entity: string; field: string; req: string; desc: string }[] = [
  { entity: 'Sipariş', field: 'source_id', req: 'Evet', desc: 'Kaynak sistemdeki sipariş kimliği (aynı değer tekrar gelirse güncellenir)' },
  { entity: 'Sipariş', field: 'order_no', req: 'Hayır', desc: 'Görünen sipariş numarası' },
  { entity: 'Sipariş', field: 'status', req: 'Hayır', desc: 'Sipariş durumu (varsayılan: paid)' },
  { entity: 'Sipariş', field: 'total / currency', req: 'Hayır', desc: 'Toplam tutar ve para birimi (varsayılan TRY)' },
  { entity: 'Sipariş', field: 'ordered_at', req: 'Hayır', desc: 'Sipariş zamanı (ISO 8601)' },
  { entity: 'Sipariş', field: 'store_code', req: 'Hayır', desc: 'CRM\'deki Mağaza kodu. Boşsa e-ticarette Online, diğerlerinde Merkez mağazasına yazılır' },
  { entity: 'Sipariş', field: 'advisor_email', req: 'Hayır', desc: 'Satışı yapan danışmanın CRM e-postası' },
  { entity: 'Sipariş', field: 'customer.phone / email', req: 'Evet (biri)', desc: 'Müşteri bu bilgilerle eşleşir; yoksa otomatik müşteri açılır' },
  { entity: 'Sipariş', field: 'customer.first_name / last_name / source_id', req: 'Hayır', desc: 'Yeni müşterinin adı ve kaynak sistem kimliği' },
  { entity: 'Sipariş', field: 'items[].sku / name / quantity / unit_price', req: 'Hayır', desc: 'Sipariş kalemleri; sku ürün kataloğuyla eşleşir' },
  { entity: 'Ürün', field: 'sku', req: 'Evet', desc: 'Stok kodu' },
  { entity: 'Ürün', field: 'name', req: 'Evet', desc: 'Ürün adı' },
  { entity: 'Ürün', field: 'category / material', req: 'Hayır', desc: 'Kategori ve malzeme' },
  { entity: 'Ürün', field: 'price / currency / status', req: 'Hayır', desc: 'Fiyat, para birimi, durum (active)' },
  { entity: 'Ürün', field: 'collection_code / collection_name', req: 'Hayır', desc: 'Koleksiyon otomatik oluşturulur' },
]

export const WHERE: { what: string; where: string; how: string }[] = [
  { what: 'Mağaza / bayi / toptancı', where: 'Yönetim → Mağazalar', how: 'Tür seçerek ekleyin (Mağaza, Bayi, Toptancı, Online, Merkez). Kod benzersizdir.' },
  { what: 'Çalışan, bayi kullanıcısı', where: 'Yönetim → Kullanıcılar', how: 'Rol ve bağlı mağaza seçin. Bayi yöneticisi kendi mağazasına kullanıcı ekleyebilir.' },
  { what: 'Mevcut müşteri listesi (Excel)', where: 'Yönetim → İçe / Dışa Aktar', how: 'Şablonu indirin, doldurun, yükleyin, sütunları eşleyin, önizleyip aktarın.' },
  { what: 'Ürün kataloğu', where: 'İçe / Dışa Aktar (toplu) veya Entegrasyon (otomatik)', how: 'Elle Excel ile ya da e-ticaret/ERP\'den product.upsert olayı ile.' },
  { what: 'Siparişler', where: 'Entegrasyonlar (otomatik)', how: 'e-ticaret/POS/ERP order.upsert gönderir; müşteri otomatik eşleşir veya açılır.' },
  { what: 'Tek müşteri', where: 'Müşteri → Müşteriler → Yeni', how: 'Telefon/e-posta ile mükerrer kontrolü yapılır.' },
  { what: 'Satış fırsatı', where: 'Müşteri → Fırsatlar veya müşteri kartı', how: 'Aşamalar: yeni → görüşme → teklif → randevu → takip → kazanıldı/kaybedildi.' },
  { what: 'Görev / randevu', where: 'Görevler, Randevular', how: 'Elle veya Otomasyonlar ile otomatik oluşur.' },
  { what: 'Servis talebi', where: 'Satış Sonrası', how: 'Müşteri/ürün/sipariş ile bağlanır, SLA takibi vardır.' },
  { what: 'Kampanya', where: 'Pazarlama → Segmentler → Kampanyalar', how: 'Önce segment (filtre) oluşturun, sonra kampanya. İzni olmayan müşteriye gönderilmez.' },
  { what: 'B2B firma (toptan müşteri)', where: 'Kurumsal → B2B / Bayi', how: 'Firma, yetkili kişi ve fırsatları tutar.' },
  { what: 'Duyuru / bildirim', where: 'Genel → Bildirimler', how: 'Yöneticiler role veya mağazaya duyuru gönderir.' },
]

export const ROLES: { role: string; sees: string; can: string }[] = [
  { role: 'Süper Admin', sees: 'Her şey: tüm mağaza, rapor, aktivite, denetim', can: 'Tüm ayar, kullanıcı, entegrasyon, dışa aktarma' },
  { role: 'Mağaza Müdürü', sees: 'Kendi mağazalarının müşteri ve verisi', can: 'Mağazasına kullanıcı ekler, rapor/aktarma' },
  { role: 'Satış Danışmanı', sees: 'Kendine atanan ve mağazasındaki müşteriler', can: 'Müşteri, fırsat, görev, randevu' },
  { role: 'Bayi / Toptancı Yöneticisi', sees: 'Yalnız kendi bayisinin müşterileri ve raporu', can: 'Kendi kullanıcılarını ekler, içe/dışa aktarır' },
  { role: 'Bayi / Toptancı Kullanıcısı', sees: 'Yalnız kendi bayisinin müşterileri', can: 'Müşteri, fırsat, görev' },
]
