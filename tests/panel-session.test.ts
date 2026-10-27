import test from 'node:test'
import assert from 'node:assert/strict'
import { signSession, verifySession, internalToken, verifyInternal } from '../lib/panelSession.ts'

process.env.PANEL_SESSION_SECRET = 'test-secret-1'
const u = { id: 'u1', ad: 'Ali', rol: 'admin', kullanici_adi: 'ali' }

test('imzalı oturum doğrulanır', async () => {
  const t = await signSession(u)
  const v = await verifySession(t)
  assert.equal(v?.id, 'u1'); assert.equal(v?.rol, 'admin')
})
test('sahte / imzasız / kurcalanmış çerez reddedilir', async () => {
  const t = await signSession(u)
  assert.equal(await verifySession(Buffer.from(JSON.stringify({ ...u, exp: 9999999999 })).toString('base64')), null)
  assert.equal(await verifySession('abc.def'), null)
  const [b, s] = t.split('.')
  const forged = Buffer.from(JSON.stringify({ ...u, rol: 'admin', id: 'x', exp: 9999999999 })).toString('base64url')
  assert.equal(await verifySession(`${forged}.${s}`), null)
  assert.equal(await verifySession(`${b}.${s.slice(0, -2)}AA`), null)
  assert.equal(await verifySession(undefined), null)
})
test('farklı anahtarla imzalanan geçersiz', async () => {
  const t = await signSession(u)
  process.env.PANEL_SESSION_SECRET = 'other'
  assert.equal(await verifySession(t), null)
  process.env.PANEL_SESSION_SECRET = 'test-secret-1'
})
test('iç çağrı belirteci', async () => {
  assert.equal(await verifyInternal(await internalToken()), true)
  assert.equal(await verifyInternal('x'), false)
  assert.equal(await verifyInternal(null), false)
  assert.equal(await verifySession(await internalToken()), null)
})
