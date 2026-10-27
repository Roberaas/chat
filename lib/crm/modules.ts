// Kapatılabilir CRM modülleri. Listede olmayan sayfalar (müşteri, sipariş, ürün, B2B, cari, ayarlar...) veri modülleridir ve hep açıktır.
export type CrmModule = { key: string; label: string; desc: string; paths: string[] }

export const CRM_MODULES: CrmModule[] = [
  { key: 'reports', label: 'Raporlama', desc: 'Dashboard, Raporlar, Müşteri Raporum, Hedefler, Müşteri Analizi', paths: ['/crm', '/crm/raporlar', '/crm/bayi-raporu', '/crm/hedefler', '/crm/analiz'] },
  { key: 'sales', label: 'Satış fırsatları ve teklifler', desc: 'Fırsatlar menüsü', paths: ['/crm/firsatlar'] },
  { key: 'tasks', label: 'Görev, takvim ve randevu', desc: 'Görevler, Takvim, Randevular, Bildirimler', paths: ['/crm/gorevler', '/crm/takvim', '/crm/randevular', '/crm/bildirimler'] },
  { key: 'service', label: 'Satış sonrası', desc: 'Servis, tamir ve iade talepleri', paths: ['/crm/servis'] },
  { key: 'marketing', label: 'Pazarlama ve mesaj gönderimi', desc: 'Segmentler, Kampanyalar, Özel Günler (SMS/WhatsApp/e-posta gönderimi dahil)', paths: ['/crm/ozel-gunler', '/crm/segmentler', '/crm/kampanyalar'] },
  { key: 'automation', label: 'Otomasyonlar', desc: 'Otomatik kural ve bildirimler', paths: ['/crm/otomasyonlar'] },
  { key: 'activity', label: 'Aktivite izleme', desc: 'Ekibin canlı akışı', paths: ['/crm/aktivite'] },
]

const match = (path: string, p: string) => (p === '/crm' ? path === '/crm' : path === p || path.startsWith(p + '/'))

export function moduleForPath(path: string): CrmModule | null {
  return CRM_MODULES.find(m => m.paths.some(p => match(path, p))) || null
}
export function hrefDisabled(href: string, disabled: string[] | undefined) {
  if (!disabled?.length) return false
  const m = moduleForPath(href)
  return !!m && disabled.includes(m.key)
}
