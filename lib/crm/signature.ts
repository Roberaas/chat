import { createHmac, timingSafeEqual } from 'crypto'

export const SIGNATURE_TOLERANCE_S = 300

/** Webhook imzası: hex HMAC-SHA256(`${ts}.${rawBody}`); zaman damgası ±tolerans içinde olmalı. */
export function verifyWebhookSignature(opts: { secret: string; timestamp: string; signature: string; rawBody: string; nowMs?: number; toleranceS?: number }): boolean {
  const { secret, timestamp, rawBody } = opts
  const sig = opts.signature.replace(/^sha256=/, '')
  const age = Math.abs((opts.nowMs ?? Date.now()) / 1000 - Number(timestamp))
  if (!timestamp || !Number.isFinite(age) || age > (opts.toleranceS ?? SIGNATURE_TOLERANCE_S)) return false
  const expected = createHmac('sha256', secret).update(`${timestamp}.${rawBody}`).digest('hex')
  return sig.length === expected.length && timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
}
