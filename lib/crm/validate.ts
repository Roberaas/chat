// Hafif sunucu tarafı doğrulama (ek kütüphane yok)
export const isUuid = (v: unknown): v is string =>
  typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
export const isEmail = (v: unknown): v is string =>
  typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)
export const str = (v: unknown, max = 200): string | null =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max ? v.trim() : null
export const optStr = (v: unknown, max = 200): string | null | undefined => {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  return typeof v === 'string' && v.trim().length <= max ? v.trim() : undefined
}
export const strongPassword = (v: unknown): v is string =>
  typeof v === 'string' && v.length >= 12 && v.length <= 128 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v)
// TR telefon: rakam/+ ve boşluk; 10-15 hane
export const normPhone = (v: unknown): string | null => {
  if (typeof v !== 'string') return null
  const d = v.replace(/[^\d+]/g, '')
  const digits = d.replace(/\D/g, '')
  return digits.length >= 10 && digits.length <= 15 ? (d.startsWith('+') ? '+' + digits : digits) : null
}
