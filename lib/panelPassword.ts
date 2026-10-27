import { scryptSync, randomBytes, timingSafeEqual, createHash } from 'node:crypto'

// Panel kullanıcı şifreleri: scrypt$salt$hash. Eski kayıtlar (SHA-256) girişte otomatik scrypt'e yükseltilir.
export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString('hex')
  return `scrypt$${salt}$${scryptSync(pw, salt, 64).toString('hex')}`
}
const eq = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b))

export function verifyPassword(pw: string, stored: string | null | undefined): { ok: boolean; upgrade: boolean } {
  if (!stored) return { ok: false, upgrade: false }
  if (stored.startsWith('scrypt$')) {
    const [, salt, h] = stored.split('$')
    return { ok: !!salt && !!h && eq(scryptSync(pw, salt, 64).toString('hex'), h), upgrade: false }
  }
  const legacy = [createHash('sha256').update(pw).digest('hex'), createHash('sha256').update(pw + 'roberto-salt-2024').digest('hex')]
  return { ok: legacy.some(l => eq(l, stored)), upgrade: true }
}
