import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { isPasscode, isWeak } from '../../shared/passcode.js'
import { ensureSchema, getDb, type Db } from './db.js'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export const COOKIE = 'rep_session'
export const DEVICE_COOKIE = 'rep_device'
const SESSION_DAYS = 90
const DEVICE_DAYS = 400 // browsers cap cookie lifetime around 400 days
export const IP_LIMIT = 5 // failed attempts per IP…
const IP_WINDOW_MIN = 15 // …per this many minutes
export const GLOBAL_LIMIT = 30 // failed attempts per hour from untrusted devices

const json = (body: unknown, status = 200, headers: Headers | Record<string, string> = {}) => {
  const h = new Headers(headers)
  h.set('content-type', 'application/json')
  h.set('cache-control', 'no-store')
  return new Response(JSON.stringify(body), { status, headers: h })
}

export { isPasscode, isWeak }

// ---------- secrets ----------
export async function hashPasscode(p: string) {
  const salt = randomBytes(16)
  const key = await scrypt(p, salt, 32)
  return `scrypt$${salt.toString('base64url')}$${key.toString('base64url')}`
}

export async function verifyPasscode(p: string, stored: string) {
  const [alg, salt, key] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !key) return false
  const expected = Buffer.from(key, 'base64url')
  const actual = await scrypt(p, Buffer.from(salt, 'base64url'), expected.length)
  return timingSafeEqual(actual, expected)
}

const sha256 = (s: string) => createHash('sha256').update(s).digest()
const hex = (s: string) => sha256(s).toString('hex')

// Setup requires REP_SETUP_KEY, a value only the owner knows (set in Vercel → Environment
// Variables), so nobody else can claim the app by reaching it first. Unset = setup disabled.
const setupKey = () => process.env.REP_SETUP_KEY?.trim() || null
const keyMatches = (given: unknown) => {
  const key = setupKey()
  return !!key && typeof given === 'string' && timingSafeEqual(sha256(given.trim()), sha256(key))
}

// ---------- cookies ----------
function readCookie(req: Request, name: string) {
  const raw = req.headers.get('cookie') ?? ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k !== name) continue
    try { return decodeURIComponent(v.join('=')) } catch { return null } // malformed → absent
  }
  return null
}

const cookie = (name: string, value: string, days: number) =>
  `${name}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${days * 86400}`

// Sessions and devices are only valid if created after the current owner — so resetting the
// passcode (deleting the owner row) instantly invalidates every old session and trusted device.
const LIVE_SESSION = `select 1 from sessions s join owner o on s.created_at >= o.created_at where s.token_hash = $1 and s.expires_at > now()`
const knownDevice = (param: string) => `select 1 from devices d join owner o on d.created_at >= o.created_at where d.token_hash = ${param}`

// Use in every future authenticated endpoint (sync, AI): true for a live session.
export async function isAuthenticated(req: Request, db: Db) {
  const token = readCookie(req, COOKIE)
  return !!token && (await db.query(LIVE_SESSION, [hex(token)])).length > 0
}

// On success: a new session, plus a long-lived device token (kept across lock/unlock) that marks
// this browser as the owner's, so the global cap never applies to it whatever network it's on.
async function signIn(db: Db, req: Request) {
  const headers = new Headers()
  const session = randomBytes(32).toString('base64url')
  await db.query(
    `insert into sessions (token_hash, expires_at, user_agent) values ($1, now() + make_interval(days => $2), $3)`,
    [hex(session), SESSION_DAYS, (req.headers.get('user-agent') ?? '').slice(0, 200)],
  )
  headers.append('set-cookie', cookie(COOKIE, session, SESSION_DAYS))
  const existing = readCookie(req, DEVICE_COOKIE)
  const known = existing && (await db.query(knownDevice('$1'), [hex(existing)])).length > 0
  if (!known) {
    const device = randomBytes(32).toString('base64url')
    await db.query(`insert into devices (token_hash) values ($1)`, [hex(device)])
    headers.append('set-cookie', cookie(DEVICE_COOKIE, device, DEVICE_DAYS))
  }
  return headers
}

// ---------- rate limiting ----------
const clientIp = (req: Request) =>
  req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

type Gate = { allowed: true; id: number; remaining: number } | { allowed: false; retryAfter: number; global: boolean }

// Race-safe: the attempt is recorded as a failure *before* the secret is checked, then counted, so
// every request sees itself and all earlier ones and concurrent bursts can't exceed the limits.
// A refused attempt deletes its own row, so spamming while blocked neither extends the lockout nor
// inflates the global count. A correct secret flips the row to ok (`succeed`).
async function gate(db: Db, req: Request): Promise<Gate> {
  const ip = clientIp(req)
  const device = readCookie(req, DEVICE_COOKIE)
  const [row] = await db.query<{ id: number }>(`insert into auth_attempts (ip, ok) values ($1, false) returning id`, [ip])
  const [c] = await db.query<{ n: number; oldest: string | null; trusted: boolean; global: number }>(
    `with since as (
       select greatest(now() - make_interval(mins => $2),
                       coalesce((select max(at) from auth_attempts where ip = $1 and ok), '-infinity'::timestamptz)) as t)
     select
       (select count(*)::int from auth_attempts, since where ip = $1 and not ok and at > since.t) as n,
       (select min(at) from auth_attempts, since where ip = $1 and not ok and at > since.t) as oldest,
       exists (${knownDevice('$3')}) as trusted,
       (select count(*)::int from auth_attempts where not ok and at > now() - interval '1 hour') as global`,
    [ip, IP_WINDOW_MIN, device ? hex(device) : ''],
  )
  if (Math.random() < 0.05) {
    await db.query(`delete from auth_attempts where at < now() - interval '1 day'`)
    await db.query(`delete from sessions where expires_at < now()`)
  }
  const refuse = async (retryAfter: number, global: boolean): Promise<Gate> => {
    await db.query(`delete from auth_attempts where id = $1`, [row.id])
    return { allowed: false, retryAfter, global }
  }
  if (c.n > IP_LIMIT) {
    const retry = c.oldest ? Math.ceil((new Date(c.oldest).getTime() + IP_WINDOW_MIN * 60000 - Date.now()) / 1000) : IP_WINDOW_MIN * 60
    return refuse(Math.max(1, retry), false)
  }
  // The global cap stops brute force from rotating IPs; the owner's own devices are exempt.
  if (!c.trusted && c.global > GLOBAL_LIMIT) return refuse(3600, true)
  return { allowed: true, id: row.id, remaining: IP_LIMIT - c.n } // tries left if this one fails (n includes it)
}
const succeed = (db: Db, id: number) => db.query(`update auth_attempts set ok = true where id = $1`, [id])
const blocked = (g: Extract<Gate, { allowed: false }>) =>
  json({ error: 'locked', retryAfter: g.retryAfter, global: g.global }, 429, { 'retry-after': String(g.retryAfter) })
const wrong = (remaining: number, error = 'wrong') =>
  remaining > 0 ? json({ error, remaining }, 401) : json({ error: 'locked', retryAfter: IP_WINDOW_MIN * 60 }, 429, { 'retry-after': String(IP_WINDOW_MIN * 60) })

// ---------- handlers ----------
async function withDb(fn: (db: Db) => Promise<Response>) {
  const db = getDb()
  if (!db) return json({ error: 'no_database' }, 503)
  try {
    await ensureSchema(db)
    return await fn(db)
  } catch (e) {
    console.error('auth error', e)
    return json({ error: 'server' }, 500)
  }
}

async function body(req: Request): Promise<Record<string, unknown>> {
  try { return (await req.json()) as Record<string, unknown> } catch { return {} }
}

export const status = (req: Request) => withDb(async (db) => {
  const token = readCookie(req, COOKIE)
  const [r] = await db.query<{ configured: boolean; authenticated: boolean }>(
    `select exists (select 1 from owner) as configured, exists (${LIVE_SESSION}) as authenticated`, [token ? hex(token) : ''])
  return json({ configured: r.configured, setup: !r.configured && !!setupKey(), authenticated: r.authenticated })
})

// Two calls: { setupKey } alone checks the key (so the UI can fail fast), then { setupKey, passcode }
// creates the owner. Both are rate-limited like login, since the key is a secret too.
export const setup = (req: Request) => withDb(async (db) => {
  if (!setupKey()) return json({ error: 'setup_disabled' }, 403)
  const { passcode, setupKey: given } = await body(req)
  const g = await gate(db, req)
  if (!g.allowed) return blocked(g)
  if (!keyMatches(given)) return wrong(g.remaining, 'bad_key')
  await succeed(db, g.id)
  if (passcode === undefined) return json({ ok: true })
  if (!isPasscode(passcode)) return json({ error: 'invalid' }, 400)
  if (isWeak(passcode)) return json({ error: 'weak' }, 400)
  // Only the first claim wins; afterwards setup is closed (reset = delete the owner row).
  const rows = await db.query(`insert into owner (id, passcode_hash) values (1, $1) on conflict (id) do nothing returning id`, [await hashPasscode(passcode)])
  if (!rows.length) return json({ error: 'already_configured' }, 409)
  return json({ ok: true }, 200, await signIn(db, req))
})

export const login = (req: Request) => withDb(async (db) => {
  const [owners, g] = await Promise.all([db.query<{ passcode_hash: string }>(`select passcode_hash from owner`), gate(db, req)])
  if (!owners.length) return json({ error: 'not_configured' }, 409)
  if (!g.allowed) return blocked(g)
  const { passcode } = await body(req)
  if (!(isPasscode(passcode) && (await verifyPasscode(passcode, owners[0].passcode_hash)))) return wrong(g.remaining)
  await succeed(db, g.id)
  return json({ ok: true }, 200, await signIn(db, req))
})

// Ends the session; the device token stays so this browser remains trusted for unlocking.
export const logout = (req: Request) => withDb(async (db) => {
  const token = readCookie(req, COOKIE)
  if (token) await db.query(`delete from sessions where token_hash = $1`, [hex(token)])
  return json({ ok: true }, 200, { 'set-cookie': cookie(COOKIE, '', 0) })
})
