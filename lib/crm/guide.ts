// Rehber ve entegrasyon şablonlarının içeriği (tek kaynak)
export type Preset = { code: string; kind: string; name: string; secret_env: string; how: string[] }

export const PRESETS: Preset[] = [
  { code: 'ideasoft', kind: 'ecommerce', name: 'Ideasoft (e-ticaret)', secret_env: 'CRM_WEBHOOK_SECRET_IDEASOFT', how: [
    'Ideasoft yönetim panelinden sipariş/ürün bildirimi (webhook veya API) tanımlayın; doğrudan imza atamıyorsa araya n8n koyun.',
    'n8n akışı: Ideasoft tetikleyicisi → "Code" düğümü (aşağıdaki örnek imza kodu) → HTTP Request ile CRM adresine POST.',
    'Gövdeyi "Sipariş" ve "Ürün" örneklerindeki alan adlarına çevirin (veya Alan eşlemeleri bölümünü kullanın).'] },
  { code: 'tsoft', kind: 'ecommerce', name: 'T-Soft (e-ticaret)', secret_env: 'CRM_WEBHOOK_SECRET_TSOFT', how: [
    'T-Soft API/webhook çıktısını n8n ile alın, örnek alan adlarına çevirin.',
    'İmzayı n8n "Code" düğümünde hesaplayıp CRM adresine POST edin.'] },
  { code: 'ticimax', kind: 'ecommerce', name: 'Ticimax (e-ticaret)', secret_env: 'CRM_WEBHOOK_SECRET_TICIMAX', how: [
    'Ticimax sipariş/ürün servisinden veriyi n8n ile çekin (zamanlayıcı), örnek alan adlarına çevirin ve imzalı POST edin.'] },
  { code: 'kalimero', kind: 'pos', name: 'Kalimero (POS / mağaza satışı)', secret_env: 'CRM_WEBHOOK_SECRET_KALIMERO', how: [
    'Kalimero satış olaylarını n8n üzerinden alın; mağaza kodunu (store_code) ve danışman e-postasını (advisor_email) ekleyin.',
    'Böylece mağaza satışı doğru mağazaya ve danışmana yazılır.'] },
  { code: 'erp', kind: 'erp', name: 'ERP (genel)', secret_env: 'CRM_WEBHOOK_SECRET_ERP', how: [
    'ERP ürün ve sipariş değişikliklerini bu adrese imzalı POST etsin. ERP yetkili kaynaktır: gelen değer CRM\'dekini ezer.'] },
  { code: 'n8n', kind: 'other', name: 'n8n (köprü akışı)', secret_env: 'CRM_WEBHOOK_SECRET_N8N', how: [
    'Başka sistemlerden gelen veriyi tek noktada toplayıp CRM\'e göndermek için kullanın.'] },
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
