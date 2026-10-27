// Panel (WhatsApp) oturumu: HMAC imzalı çerez. Edge (middleware) ve Node'da çalışır (Web Crypto).
export type PanelUser = { id: string; ad: string; rol: string; kullanici_adi: string; exp: number }
export const SESSION_COOKIE = 'rb_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 gün

const enc = new TextEncoder()
const secret = () => process.env.PANEL_SESSION_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || ''

function b64u(buf: ArrayBuffer | Uint8Array): string {
  const b = buf instanceof Uint8Array ? buf : new Uint8Array(buf)
  let s = ''; for (const x of b) s += String.fromCharCode(x)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
function fromB64u(s: string): ArrayBuffer {
  const p = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  const bin = atob(p); const buf = new ArrayBuffer(bin.length); const out = new Uint8Array(buf)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return buf
}
async function key(purpose: string) {
  const s = secret()
  if (!s) throw new Error('Oturum anahtarı tanımlı değil')
  return crypto.subtle.importKey('raw', enc.encode(`panel:${purpose}:${s}`), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

export async function signSession(u: Omit<PanelUser, 'exp'>): Promise<string> {
  const payload: PanelUser = { ...u, exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE }
  const body = b64u(enc.encode(JSON.stringify(payload)))
  const sig = await crypto.subtle.sign('HMAC', await key('session'), enc.encode(body))
  return `${body}.${b64u(sig)}`
}

export async function verifySession(token: string | undefined | null): Promise<PanelUser | null> {
  if (!token || token.length > 2000) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  try {
    const ok = await crypto.subtle.verify('HMAC', await key('session'), fromB64u(sig), enc.encode(body))
    if (!ok) return null
    const u = JSON.parse(new TextDecoder().decode(fromB64u(body))) as PanelUser
    if (!u?.id || !u.rol || typeof u.exp !== 'number' || u.exp < Date.now() / 1000) return null
    return u
  } catch { return null }
}

// Sunucudan sunucuya iç çağrılar (ör. bildirim → push/sms) için imza
export async function internalToken(): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', await key('internal'), enc.encode('internal-call'))
  return b64u(sig)
}
export async function verifyInternal(token: string | null): Promise<boolean> {
  if (!token) return false
  try { return await crypto.subtle.verify('HMAC', await key('internal'), fromB64u(token), enc.encode('internal-call')) } catch { return false }
}
