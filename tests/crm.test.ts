import test from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { isUuid, isEmail, str, optStr, strongPassword, normPhone } from '../lib/crm/validate.ts'
import { verifyWebhookSignature } from '../lib/crm/signature.ts'

test('isUuid', () => {
  assert.ok(isUuid('123e4567-e89b-12d3-a456-426614174000'))
  assert.ok(!isUuid('x'), 'geçersiz'); assert.ok(!isUuid(null))
})
test('isEmail', () => {
  assert.ok(isEmail('a@b.co')); assert.ok(!isEmail('a@b')); assert.ok(!isEmail('a b@c.com'))
})
test('str/optStr', () => {
  assert.equal(str('  x '), 'x'); assert.equal(str('   '), null); assert.equal(str('a'.repeat(201)), null)
  assert.equal(optStr(undefined), undefined); assert.equal(optStr(''), null); assert.equal(optStr(5), undefined)
})
test('strongPassword', () => {
  assert.ok(strongPassword('Abcdefgh1234')); assert.ok(!strongPassword('abcdefgh1234')); assert.ok(!strongPassword('Ab1'))
})
test('normPhone', () => {
  assert.equal(normPhone('0532 123 45 67'), '05321234567'); assert.equal(normPhone('+90 532 123 45 67'), '+905321234567'); assert.equal(normPhone('123'), null)
})

const secret = 's3cret', body = '{"event_id":"1"}', now = 1_800_000_000_000
const sign = (ts: string, b = body, s = secret) => createHmac('sha256', s).update(`${ts}.${b}`).digest('hex')
test('webhook imza: geçerli', () => {
  const ts = String(now / 1000)
  assert.ok(verifyWebhookSignature({ secret, timestamp: ts, signature: sign(ts), rawBody: body, nowMs: now }))
  assert.ok(verifyWebhookSignature({ secret, timestamp: ts, signature: 'sha256=' + sign(ts), rawBody: body, nowMs: now }))
})
test('webhook imza: reddedilir', () => {
  const ts = String(now / 1000)
  assert.ok(!verifyWebhookSignature({ secret, timestamp: ts, signature: sign(ts, body, 'yanlis'), rawBody: body, nowMs: now }), 'yanlış sır')
  assert.ok(!verifyWebhookSignature({ secret, timestamp: ts, signature: sign(ts), rawBody: body + ' ', nowMs: now }), 'gövde değişti')
  const old = String(now / 1000 - 301)
  assert.ok(!verifyWebhookSignature({ secret, timestamp: old, signature: sign(old), rawBody: body, nowMs: now }), 'eski zaman damgası')
  assert.ok(!verifyWebhookSignature({ secret, timestamp: '', signature: '', rawBody: body, nowMs: now }), 'boş')
  assert.ok(!verifyWebhookSignature({ secret, timestamp: 'abc', signature: sign('abc'), rawBody: body, nowMs: now }), 'NaN')
})
