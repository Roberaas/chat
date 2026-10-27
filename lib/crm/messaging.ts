import { createHmac } from 'crypto'

export type Channel = 'sms' | 'whatsapp' | 'email'
export type SendResult = { ok: boolean; id?: string; retry?: boolean; error?: string }
export type Msg = { channel: Channel; to: string; body: string; subject?: string | null; customerId: string; campaignId: string }

const env = (k: string) => (process.env[k] || '').trim()
const TIMEOUT_MS = 10_000

/** Şablon değişkenleri: {{ad}}, {{soyad}}, {{ad_soyad}} */
export function renderTemplate(body: string, p: { first_name?: string | null; last_name?: string | null }) {
  const a = (p.first_name || '').trim(), s = (p.last_name || '').trim()
  return body.replace(/\{\{\s*ad\s*\}\}/gi, a).replace(/\{\{\s*soyad\s*\}\}/gi, s).replace(/\{\{\s*ad_soyad\s*\}\}/gi, `${a} ${s}`.trim()).replace(/[ \t]{2,}/g, ' ').trim()
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))

export function providerFor(channel: Channel): string | null {
  const p = env(`CRM_${channel.toUpperCase()}_PROVIDER`).toLowerCase()
  if (channel === 'email') return p === 'resend' && env('CRM_RESEND_KEY') && env('CRM_EMAIL_FROM') ? 'resend' : p === 'webhook' && env('CRM_EMAIL_WEBHOOK_URL') ? 'webhook' : null
  if (p === 'twilio') {
    const from = channel === 'sms' ? (env('CRM_TWILIO_SMS_FROM') || env('CRM_TWILIO_MESSAGING_SERVICE')) : env('CRM_TWILIO_WHATSAPP_FROM')
    return env('CRM_TWILIO_SID') && env('CRM_TWILIO_TOKEN') && from ? 'twilio' : null
  }
  if (p === 'webhook') return env(`CRM_${channel.toUpperCase()}_WEBHOOK_URL`) ? 'webhook' : null
  return null
}

/** Hangi kanalın hazır olduğu (gizli değer döndürmez) */
export function messagingStatus() {
  return (['sms', 'whatsapp', 'email'] as Channel[]).map(c => ({ channel: c, provider: providerFor(c) }))
}

async function http(url: string, init: RequestInit): Promise<{ status: number; json: any; text: string } | { error: string }> {
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal })
    const text = await r.text(); let json: any = null; try { json = JSON.parse(text) } catch { /* düz metin */ }
    return { status: r.status, json, text }
  } catch (e: any) { return { error: e?.name === 'AbortError' ? 'Zaman aşımı' : (e?.message || 'Ağ hatası') } }
  finally { clearTimeout(t) }
}
// 429 ve 5xx geçici (tekrar denenir), diğer 4xx kalıcı hata
const classify = (status: number, detail: string): SendResult => ({ ok: false, retry: status === 429 || status >= 500, error: `HTTP ${status}: ${detail}`.slice(0, 280) })

export async function sendMessage(m: Msg): Promise<SendResult> {
  const provider = providerFor(m.channel)
  if (!provider) return { ok: false, retry: false, error: `${m.channel.toUpperCase()} sağlayıcısı yapılandırılmamış` }

  if (provider === 'twilio') {
    const sid = env('CRM_TWILIO_SID'), form = new URLSearchParams()
    const waFrom = env('CRM_TWILIO_WHATSAPP_FROM')
    form.set('To', m.channel === 'whatsapp' ? `whatsapp:${m.to}` : m.to)
    if (m.channel === 'whatsapp') form.set('From', waFrom.startsWith('whatsapp:') ? waFrom : `whatsapp:${waFrom}`)
    else if (env('CRM_TWILIO_MESSAGING_SERVICE')) form.set('MessagingServiceSid', env('CRM_TWILIO_MESSAGING_SERVICE'))
    else form.set('From', env('CRM_TWILIO_SMS_FROM'))
    form.set('Body', m.body)
    const r = await http(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST', body: form,
      headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${env('CRM_TWILIO_TOKEN')}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' },
    })
    if ('error' in r) return { ok: false, retry: true, error: r.error }
    return r.status >= 200 && r.status < 300 && r.json?.sid ? { ok: true, id: String(r.json.sid) } : classify(r.status, r.json?.message || r.text.slice(0, 120))
  }

  if (provider === 'resend') {
    const r = await http('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${env('CRM_RESEND_KEY')}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env('CRM_EMAIL_FROM'), to: [m.to], subject: m.subject || 'Roberto Bravo', text: m.body, html: `<div style="white-space:pre-wrap;font-family:Arial,sans-serif">${esc(m.body)}</div>` }),
    })
    if ('error' in r) return { ok: false, retry: true, error: r.error }
    return r.status >= 200 && r.status < 300 && r.json?.id ? { ok: true, id: String(r.json.id) } : classify(r.status, r.json?.message || r.text.slice(0, 120))
  }

  // Genel webhook (n8n, Netgsm/İleti Merkezi köprüsü vb.): JSON gövde, isteğe bağlı HMAC imzası
  const ch = m.channel.toUpperCase(), url = env(`CRM_${ch}_WEBHOOK_URL`), secret = env(`CRM_${ch}_WEBHOOK_SECRET`)
  const payload = JSON.stringify({ channel: m.channel, to: m.to, body: m.body, subject: m.subject || null, customer_id: m.customerId, campaign_id: m.campaignId })
  const ts = String(Math.floor(Date.now() / 1000))
  const headers: Record<string, string> = { 'Content-Type': 'application/json', 'x-crm-timestamp': ts }
  if (secret) headers['x-crm-signature'] = createHmac('sha256', secret).update(`${ts}.${payload}`).digest('hex')
  const r = await http(url, { method: 'POST', headers, body: payload })
  if ('error' in r) return { ok: false, retry: true, error: r.error }
  return r.status >= 200 && r.status < 300 ? { ok: true, id: String(r.json?.id || r.json?.message_id || `wh-${Date.now()}`) } : classify(r.status, r.text.slice(0, 120))
}
