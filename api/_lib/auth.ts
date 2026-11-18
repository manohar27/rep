import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { isPasscode, isWeak } from '../../shared/passcode.js'
import { ensureSchema, getDb, type Db } from './db.js'

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>

export const COOKIE = 'rep_session'
const SESSION_DAYS = 90
export const IP_LIMIT = 5 // failed attempts per IP…
const IP_WINDOW_MIN = 15 // …per this many minutes
export const GLOBAL_LIMIT = 30 // failed attempts across all IPs per hour

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } })

// ---------- passcode ----------
export { isPasscode, isWeak }

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

// ---------- sessions ----------
const sha256 = (s: string) => createHash('sha256').update(s).digest('hex')

function readCookie(req: Request, name: string) {
  const raw = req.headers.get('cookie') ?? ''
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return decodeURIComponent(v.join('='))
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
    [sha256(token), SESSION_DAYS, (req.headers.get('user-agent') ?? '').slice(0, 200)],
  )
  return token
}

// Exported for future authenticated endpoints (sync, AI): true for a live session.
export async function isAuthenticated(req: Request, db: Db) {
  const token = readCookie(req, COOKIE)
  if (!token) return false
  const rows = await db.query(`select 1 from sessions where token_hash = $1 and expires_at > now()`, [sha256(token)])
  return rows.length > 0
}

// ---------- rate limiting ----------
const clientIp = (req: Request) =>
  req.headers.get('x-real-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

// Failures for this IP since its last success within the window, plus a global hourly cap so
// rotating IPs can't brute-force the 1,000,000 possible codes either.
async function limitState(db: Db, ip: string) {
  const [ipRow] = await db.query<{ n: number; oldest: string | null }>(
    `select count(*)::int as n, min(at) as oldest from auth_attempts
     where ip = $1 and not ok and at > now() - make_interval(mins => $2)
       and at > coalesce((select max(at) from auth_attempts where ip = $1 and ok), '-infinity'::timestamptz)`,
    [ip, IP_WINDOW_MIN],
  )
  const [g] = await db.query<{ n: number }>(`select count(*)::int as n from auth_attempts where not ok and at > now() - interval '1 hour'`)
  if (ipRow.n >= IP_LIMIT) {
    const retry = ipRow.oldest ? Math.ceil((new Date(ipRow.oldest).getTime() + IP_WINDOW_MIN * 60000 - Date.now()) / 1000) : IP_WINDOW_MIN * 60
    return { blocked: true, retryAfter: Math.max(1, retry), remaining: 0 }
  }
  if (g.n >= GLOBAL_LIMIT) return { blocked: true, retryAfter: 3600, remaining: 0 }
  return { blocked: false, retryAfter: 0, remaining: IP_LIMIT - ipRow.n }
}

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
  const owner = await db.query(`select 1 from owner`)
  return json({ configured: owner.length > 0, authenticated: owner.length > 0 && (await isAuthenticated(req, db)) })
})

export const setup = (req: Request) => withDb(async (db) => {
  const { passcode } = await body(req)
  if (!isPasscode(passcode)) return json({ error: 'invalid' }, 400)
  if (isWeak(passcode)) return json({ error: 'weak' }, 400)
  // Only the first claim wins; afterwards setup is closed for good (reset = delete the owner row).
  const rows = await db.query(`insert into owner (id, passcode_hash) values (1, $1) on conflict (id) do nothing returning id`, [await hashPasscode(passcode)])
  if (!rows.length) return json({ error: 'already_configured' }, 409)
  const token = await createSession(db, req)
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token) })
})

export const login = (req: Request) => withDb(async (db) => {
  const ip = clientIp(req)
  const limit = await limitState(db, ip)
  if (limit.blocked) return json({ error: 'locked', retryAfter: limit.retryAfter }, 429, { 'retry-after': String(limit.retryAfter) })
  const { passcode } = await body(req)
  const [owner] = await db.query<{ passcode_hash: string }>(`select passcode_hash from owner`)
  if (!owner) return json({ error: 'not_configured' }, 409)
  const ok = isPasscode(passcode) && (await verifyPasscode(passcode, owner.passcode_hash))
  await db.query(`insert into auth_attempts (ip, ok) values ($1, $2)`, [ip, ok])
  await db.query(`delete from auth_attempts where at < now() - interval '1 day'`)
  if (!ok) {
    const remaining = limit.remaining - 1
    if (remaining > 0) return json({ error: 'wrong', remaining }, 401)
    return json({ error: 'locked', retryAfter: IP_WINDOW_MIN * 60 }, 429, { 'retry-after': String(IP_WINDOW_MIN * 60) })
  }
  const token = await createSession(db, req)
  return json({ ok: true }, 200, { 'set-cookie': sessionCookie(token) })
})

export const logout = (req: Request) => withDb(async (db) => {
  const token = readCookie(req, COOKIE)
  if (token) await db.query(`delete from sessions where token_hash = $1`, [sha256(token)])
  return json({ ok: true }, 200, { 'set-cookie': clearCookie })
})
