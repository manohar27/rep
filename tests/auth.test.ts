// API auth tests against an in-process Postgres (PGlite). Run: npm test
import { PGlite } from '@electric-sql/pglite'
import assert from 'node:assert/strict'
import { setDbForTests, type Db } from '../api/_lib/db.js'
import { GLOBAL_LIMIT, IP_LIMIT, isWeak, login, logout, setup, status } from '../api/_lib/auth.js'

const KEY = 'test-setup-key-7731'
process.env.REP_SETUP_KEY = KEY
const pg = new PGlite()
const db: Db = { query: async (t, p) => (await pg.query(t, (p ?? []) as unknown[])).rows as never }
setDbForTests(db)

const req = (method: string, body?: unknown, ip = '1.1.1.1', cookie = '') =>
  new Request('http://x/api', { method, headers: { 'content-type': 'application/json', 'x-real-ip': ip, cookie }, body: body ? JSON.stringify(body) : undefined })
const call = async (r: Promise<Response>) => { const res = await r; return { status: res.status, body: (await res.json()) as Record<string, unknown>, cookie: res.headers.get('set-cookie') ?? '' } }
const sessionOf = (setCookie: string) => setCookie.split(';')[0]

const tests: [string, () => Promise<void>][] = []
const test = (name: string, fn: () => Promise<void>) => tests.push([name, fn])
const PASS = '482916'
let cookie = ''

test('weak codes', async () => {
  for (const p of ['000000', '123456', '987654', '121212', '123123', '112233']) assert.equal(isWeak(p), true, p)
  for (const p of ['482916', '730215']) assert.equal(isWeak(p), false, p)
})

test('fresh status: not configured, setup enabled', async () => {
  assert.deepEqual((await call(status(req('GET')))).body, { configured: false, setup: true, authenticated: false })
})

test('setup requires the key', async () => {
  assert.equal((await call(setup(req('POST', { passcode: PASS }, '5.5.5.5')))).body.error, 'bad_key')
  assert.equal((await call(setup(req('POST', { setupKey: 'nope', passcode: PASS }, '5.5.5.5')))).body.error, 'bad_key')
})

test('setup key check without passcode', async () => {
  assert.deepEqual((await call(setup(req('POST', { setupKey: KEY })))).body, { ok: true })
})

test('setup rejects weak / malformed codes', async () => {
  assert.equal((await call(setup(req('POST', { setupKey: KEY, passcode: '123456' })))).body.error, 'weak')
  assert.equal((await call(setup(req('POST', { setupKey: KEY, passcode: '12a456' })))).body.error, 'invalid')
})

test('setup creates owner + secure session cookie', async () => {
  const r = await call(setup(req('POST', { setupKey: KEY, passcode: PASS })))
  assert.equal(r.status, 200)
  for (const flag of ['HttpOnly', 'Secure', 'SameSite=Strict']) assert.ok(r.cookie.includes(flag), flag)
  cookie = sessionOf(r.cookie)
  assert.deepEqual((await call(status(req('GET', undefined, '1.1.1.1', cookie)))).body, { configured: true, setup: false, authenticated: true })
})

test('setup closed once configured', async () => {
  assert.equal((await call(setup(req('POST', { setupKey: KEY, passcode: '730215' }, '6.6.6.6')))).status, 409)
})

test('only a hash is stored', async () => {
  const { rows } = await pg.query<{ passcode_hash: string }>('select passcode_hash from owner')
  assert.ok(rows[0].passcode_hash.startsWith('scrypt$'))
  assert.ok(!rows[0].passcode_hash.includes(PASS))
})

test('malformed cookie is treated as no session', async () => {
  assert.equal((await call(status(req('GET', undefined, '1.1.1.1', 'rep_session=%E0')))).body.authenticated, false)
  assert.equal((await call(logout(req('POST', {}, '1.1.1.1', 'rep_session=%E0')))).status, 200)
})

test('logout revokes the session', async () => {
  assert.equal((await call(logout(req('POST', {}, '1.1.1.1', cookie)))).status, 200)
  assert.equal((await call(status(req('GET', undefined, '1.1.1.1', cookie)))).body.authenticated, false)
})

test('per-IP lockout, even for the right code', async () => {
  for (let i = 1; i < IP_LIMIT; i++) assert.deepEqual((await call(login(req('POST', { passcode: '000001' }, '2.2.2.2')))).body, { error: 'wrong', remaining: IP_LIMIT - i })
  assert.equal((await call(login(req('POST', { passcode: '000001' }, '2.2.2.2')))).status, 429)
  assert.equal((await call(login(req('POST', { passcode: PASS }, '2.2.2.2')))).status, 429)
})

test('success resets the per-IP counter', async () => {
  await call(login(req('POST', { passcode: '000001' }, '4.4.4.4')))
  assert.equal((await call(login(req('POST', { passcode: PASS }, '4.4.4.4')))).status, 200)
  assert.equal((await call(login(req('POST', { passcode: '000001' }, '4.4.4.4')))).body.remaining, IP_LIMIT - 1)
})

test('concurrent burst cannot exceed the per-IP limit', async () => {
  const results = await Promise.all(Array.from({ length: 40 }, () => call(login(req('POST', { passcode: '000003' }, '7.7.7.7')))))
  // Each request records itself before counting, so at most IP_LIMIT - 1 ever reach the passcode check.
  assert.ok(results.filter((r) => r.status === 401).length <= IP_LIMIT - 1)
  assert.equal(results.filter((r) => r.status === 200).length, 0)
})

test('global cap blocks new IPs but never a previously trusted IP', async () => {
  for (let i = 0; i < GLOBAL_LIMIT + 5; i++) await call(login(req('POST', { passcode: '000002' }, `9.9.${i}.1`)))
  const stranger = await call(login(req('POST', { passcode: PASS }, '8.8.8.8')))
  assert.equal(stranger.status, 429)
  assert.equal(stranger.body.global, true)
  assert.equal((await call(login(req('POST', { passcode: PASS }, '4.4.4.4')))).status, 200) // signed in before
})

test('setup disabled without REP_SETUP_KEY', async () => {
  delete process.env.REP_SETUP_KEY
  assert.equal((await call(setup(req('POST', { setupKey: KEY, passcode: PASS })))).status, 403)
  process.env.REP_SETUP_KEY = KEY
})

;(async () => {
  let failed = 0
  for (const [name, fn] of tests) {
    try { await fn(); console.log(`  ✓ ${name}`) } catch (e) { failed++; console.log(`  ✗ ${name}\n    ${(e as Error).message}`) }
  }
  console.log(`\n${tests.length - failed}/${tests.length} passed`)
  process.exit(failed ? 1 : 0)
})()
