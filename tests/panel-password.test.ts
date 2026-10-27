import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { hashPassword, verifyPassword } from '../lib/panelPassword.ts'

test('scrypt hash doğrulanır, yanlış şifre reddedilir', () => {
  const h = hashPassword('Gizli-123')
  assert.ok(h.startsWith('scrypt$'))
  assert.deepEqual(verifyPassword('Gizli-123', h), { ok: true, upgrade: false })
  assert.equal(verifyPassword('yanlis', h).ok, false)
  assert.notEqual(hashPassword('Gizli-123'), h)
})
test('eski SHA-256 kayıtları kabul edilir ve yükseltme işaretlenir', () => {
  const plain = createHash('sha256').update('eski').digest('hex')
  const salted = createHash('sha256').update('eski' + 'roberto-salt-2024').digest('hex')
  assert.deepEqual(verifyPassword('eski', plain), { ok: true, upgrade: true })
  assert.deepEqual(verifyPassword('eski', salted), { ok: true, upgrade: true })
  assert.equal(verifyPassword('baska', plain).ok, false)
  assert.equal(verifyPassword('x', null).ok, false)
})
