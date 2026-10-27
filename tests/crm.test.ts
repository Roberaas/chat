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

import { buildXlsx, parseXlsx, csvCell } from '../lib/crm/xlsx.ts'
import { autoMap, normHeader } from '../lib/crm/import-config.ts'

test('xlsx gidiş-dönüş: yaz, oku', async () => {
  const buf = await buildXlsx([{ name: 'Müşteriler', columns: [{ header: 'Ad *', key: 'a' }, { header: 'Telefon', key: 'b' }, { header: 'Doğum Tarihi', key: 'c' }],
    rows: [{ a: 'Ayşe', b: '0532 111 22 33', c: '1990-05-21' }, { a: '', b: '', c: '' }, { a: 'Çağrı', b: '05551112233', c: new Date('1985-01-02T00:00:00Z') }] }])
  const p = await parseXlsx(buf)
  assert.deepEqual(p.headers, ['Ad *', 'Telefon', 'Doğum Tarihi'])
  assert.equal(p.rows.length, 2, 'boş satır atlanır')
  assert.equal(p.rows[0].cells[0], 'Ayşe'); assert.equal(p.rows[0].row, 2)
  assert.equal(p.rows[1].row, 4, 'Excel satır numarası korunur')
  assert.equal(p.rows[1].cells[2], '1985-01-02', 'tarih ISO metne çevrilir')
})
test('xlsx: satır sınırı', async () => {
  const rows = Array.from({ length: 30 }, (_, i) => ({ a: 'x' + i }))
  const p = await parseXlsx(await buildXlsx([{ name: 'S', columns: [{ header: 'A', key: 'a' }], rows }]), 10)
  assert.equal(p.rows.length, 10); assert.ok(p.tooMany)
})
test('csv formül enjeksiyonu', () => {
  assert.equal(csvCell('=1+1'), `"'=1+1"`); assert.equal(csvCell('+90'), `"'+90"`); assert.equal(csvCell('a"b'), '"a""b"')
})
test('başlık otomatik eşleme (Türkçe, büyük/küçük, eş anlamlı)', () => {
  assert.equal(normHeader('Doğum Tarihi'), 'dogum tarihi'); assert.equal(normHeader('E-POSTA'), 'e posta')
  const m = autoMap(['Adı', 'Soyadı', 'GSM', 'E-Posta', 'İl', 'Alakasız'], 'customers')
  assert.deepEqual(m, { first_name: 0, last_name: 1, phone: 2, email: 3, city: 4 })
  const p = autoMap(['SKU', 'Ürün Adı', 'Fiyat'], 'products'); assert.deepEqual(p, { sku: 0, name: 1, price: 2 })
})
