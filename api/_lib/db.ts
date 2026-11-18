import { neon } from '@neondatabase/serverless'

// Minimal query interface so the auth logic can run against Neon in production and an
// in-process Postgres (PGlite) in tests.
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>
}

let db: Db | null = null
let schema: Promise<void> | null = null

export function getDb(): Db | null {
  if (db) return db
  // The Vercel Marketplace Neon integration injects DATABASE_URL (older setups: POSTGRES_URL).
  const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL
  if (!url) return null
  const sql = neon(url)
  db = { query: (text, params) => sql.query(text, params ?? []) as never }
  return db
}

export const setDbForTests = (d: Db) => { db = d; schema = null }

// Idempotent bootstrap, run once per server instance before the first query.
export function ensureSchema(d: Db) {
  schema ??= (async () => {
    await d.query(`create table if not exists owner (
      id int primary key default 1 check (id = 1),
      passcode_hash text not null,
      created_at timestamptz not null default now())`)
    await d.query(`create table if not exists sessions (
      token_hash text primary key,
      created_at timestamptz not null default now(),
      expires_at timestamptz not null,
      user_agent text)`)
    await d.query(`create table if not exists auth_attempts (
      id bigserial primary key,
      ip text not null,
      ok boolean not null,
      at timestamptz not null default now())`)
    await d.query(`create index if not exists auth_attempts_ip_at on auth_attempts (ip, at)`)
  })().catch((e) => { schema = null; throw e })
  return schema
}
