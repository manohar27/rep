import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { isPasscode, isWeak } from '../../shared/passcode.js'
import { ensureSchema, getDb, type Db } from './db.js'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export const COOKIE = 'rep_session'
const SESSION_DAYS = 90
export const IP_LIMIT = 5 // failed attempts per IP…
const IP_WINDOW_MIN = 15 // …per this many minutes
export const GLOBAL_LIMIT = 30 // failed attempts per hour from IPs that have never signed in
const TRUSTED_DAYS = 90 // an IP with a successful sign-in this recent is exempt from the global cap

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } })

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

// Setup requires REP_SETUP_KEY, a value only the owner knows (set in Vercel → Environment
// Variables), so nobody else can claim the app by reaching it first. Unset = setup disabled.
const setupKey = () => process.env.REP_SETUP_KEY?.trim() || null
const keyMatches = (given: unknown) => {
  const key = setupKey()
  return !!key && typeof given === 'string' && timingSafeEqual(sha256(given.trim()), sha256(key))
}

// ---------- sessions ----------
function readCookie(req: Request, name: string) {
  const raw = req.headers.get('cookie') ?? ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k !== name) continue
    try { return decodeURIComponent(v.join('=')) } catch { return null } // malformed → no session
  }
  return null
}

const sessionCookie = (token: string) =>
  `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}`
const clearCookie = `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0`

async function createSession(db: Db, req: Request) {
  const token = randomBytes(32).toString('base64url')
  await db.query(
    `insert into sessions (token_hash, expires_at, user_agent) values ($1, now() + make_interval(days => $2), $3)`,
    [sha256(token).toString('hex'), SESSION_DAYS, (req.headers.get('user-agent') ?? '').slice(0, 200)],
  )
  return token
}

// Use in every future authenticated endpoint (sync, AI): true for a live session.
export async function isAuthenticated(req: Request, db: Db) {
  const token = readCookie(req, COOKIE)
  if (!token) return false
  const rows = await db.query(`select 1 from sessions where token_hash = $1 and expires_at > now()`, [sha256(token).toString('hex')])
  return rows.length > 0
}

// ---------- rate limiting ----------
const clientIp = (req: Request) =>
  req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

type Gate = { allowed: true; id: number; remaining: number } | { allowed: false; retryAfter: number; global: boolean }

// The attempt is recorded as a failure *before* the secret is checked, then counted. Every request
// therefore sees its own row and all earlier ones, so concurrent bursts can't exceed the limits.
// A correct secret flips the row to ok afterwards (see `succeed`).
async function gate(db: Db, ip: string): Promise<Gate> {
  const [row] = await db.query<{ id: number }>(`insert into auth_attempts (ip, ok) values ($1, false) returning id`, [ip])
  const [c] = await db.query<{ n: number; oldest: string | null; trusted: boolean; global: number }>(
    `select
       (select count(*)::int from auth_attempts where ip = $1 and not ok and at > now() - make_interval(mins => $2)
          and at > coalesce((select max(at) from auth_attempts where ip = $1 and ok), '-infinity'::timestamptz)) as n,
       (select min(at) from auth_attempts where ip = $1 and not ok and at > now() - make_interval(mins => $2)) as oldest,
       exists (select 1 from auth_attempts where ip = $1 and ok and at > now() - make_interval(days => $3)) as trusted,
       (select count(*)::int from auth_attempts where not ok and at > now() - interval '1 hour') as global`,
    [ip, IP_WINDOW_MIN, TRUSTED_DAYS],
  )
  if (Math.random() < 0.05) await db.query(`delete from auth_attempts where at < now() - make_interval(days => $1)`, [TRUSTED_DAYS])
  if (c.n > IP_LIMIT) {
    const retry = c.oldest ? Math.ceil((new Date(c.oldest).getTime() + IP_WINDOW_MIN * 60000 - Date.now()) / 1000) : IP_WINDOW_MIN * 60
    return { allowed: false, retryAfter: Math.max(1, retry), global: false }
  }
  // Global cap (stops brute force from rotating IPs) never applies to IPs that signed in before,
  // so an attacker can't use it to lock the owner out.
  if (!c.trusted && c.global > GLOBAL_LIMIT) return { allowed: false, retryAfter: 3600, global: true }
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
  const configured = (await db.query(`select 1 from owner`)).length > 0
  return json({ configured, setup: !configured && !!setupKey(), authenticated: configured && (await isAuthenticated(req, db)) })
})

// Two calls: { setupKey } alone checks the key (so the UI can fail fast), then { setupKey, passcode }
// creates the owner. Both are rate-limited like login, since the key is a secret too.
export const setup = (req: Request) => withDb(async (db) => {
  if (!setupKey()) return json({ error: 'setup_disabled' }, 403)
  const { passcode, setupKey: given } = await body(req)
  const g = await gate(db, clientIp(req))
  if (!g.allowed) return blocked(g)
  if (!keyMatches(given)) return wrong(g.remaining, 'bad_key')
  await succeed(db, g.id)
  if (passcode === undefined) return json({ ok: true })
  if (!isPasscode(passcode)) return json({ error: 'invalid' }, 400)
  if (isWeak(passcode)) return json({ error: 'weak' }, 400)
  // Only the first claim wins; afterwards setup is closed (reset = delete the owner row).
  const rows = await db.query(`insert into owner (id, passcode_hash) values (1, $1) on conflict (id) do nothing returning id`, [await hashPasscode(passcode)])
  if (!rows.length) return json({ error: 'already_configured' }, 409)
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(await createSession(db, req)) })
})

export const login = (req: Request) => withDb(async (db) => {
  const [owner] = await db.query<{ passcode_hash: string }>(`select passcode_hash from owner`)
  if (!owner) return json({ error: 'not_configured' }, 409)
  const g = await gate(db, clientIp(req))
  if (!g.allowed) return blocked(g)
  const { passcode } = await body(req)
  if (!(isPasscode(passcode) && (await verifyPasscode(passcode, owner.passcode_hash)))) return wrong(g.remaining)
  await succeed(db, g.id)
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(await createSession(db, req)) })
})

export const logout = (req: Request) => withDb(async (db) => {
  const token = readCookie(req, COOKIE)
  if (token) await db.query(`delete from sessions where token_hash = $1`, [sha256(token).toString('hex')])
  return json({ ok: true }, 200, { 'set-cookie': clearCookie })
})
