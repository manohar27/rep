# rep — workout logger PWA

## Design principles

Every change must hold to these three. If a feature can't, rethink the feature.

### 1. Minimal
- One primary action per screen. The accent colour (`--accent`, lime) marks it; nothing else gets to be lime.
- No settings for things a sensible default can cover. Add a setting only after the default demonstrably fails people.
- Prefer removing UI over adding it. Every label, icon and border must earn its place.
- Dark, high-contrast, mono numerals (`--mono`) for anything a lifter reads mid-set.
- Copy is short and plain: "Add set", not "Click here to add a new set".

### 2. Micro-interactions
- Every tap gets feedback: a `whileTap` scale, a state change, and `haptic()` where it confirms something.
- Motion explains state, it doesn't decorate: things enter from where they come from, and leave toward where they go.
- Use springs (framer-motion `type: 'spring'`), not linear tweens. Exception: multi-step keyframe gestures a single spring can't express (error shake, check pop) may use short keyframe tweens. Taps and toggles snappy (stiffness 400–600); screen/card/fill transitions softer (250–400). Damping ~30–38, no visible wobble.
- Numbers that change animate (`<Ticker>`). Completions celebrate briefly (check pop, row fill, confetti on finish).
- Respect `prefers-reduced-motion` — `MotionConfig reducedMotion="user"` is set at the root; don't bypass it.

### 3. Friction-free
- Logging a set must take ≤ 2 taps when repeating last time's numbers: previous values are pre-filled / used as placeholders, and ✓ adopts them.
- Never block with a modal when an inline or undoable action works. Confirm only destructive, unrecoverable actions (discarding a session).
- Inputs open the right keyboard (`inputMode="decimal"` for weight, `"numeric"` for reps) and accept what users type (`,` or `.` as decimal separator).
- Large touch targets (≥ 36px), thumb-reachable primary actions at the bottom, sheets dismiss by swipe-down or tapping outside.
- Works offline and survives reloads mid-workout: state persists to localStorage on every change.

## Project

- Stack: Vite + React 18 + TypeScript, framer-motion, zustand (`persist` → localStorage key `rep-store-v1`), vite-plugin-pwa.
- `src/data/exercises.ts` — exercise library. IDs are slugs of `muscle-name`; never rename an existing entry's name/muscle (it changes the ID and orphans history).
- `src/lib/store.ts` — all state and mutations. Persisted shape changes must stay backward compatible (make new fields optional and default them on read) or bump the store key with a migration.
- `src/screens/` — Home and Session. `src/components/` — reusable pieces (Sheet, Toast, Ticker, ExercisePicker, ExerciseCard, RestTimer, Celebrate, PRChip, ExerciseHistory, PRSummary).
- Styling is plain CSS in `src/styles.css` with tokens on `:root`. No CSS framework.

## Server & auth

- `api/` holds Vercel Functions (Web `Request` → `Response` handlers). `api/_lib/` is shared server code (not routed). Relative imports in `api/` use `.js` extensions (NodeNext ESM). `shared/` is code used by both client and server.
- Database: Postgres (Neon via the Vercel Marketplace, env `DATABASE_URL`). `api/_lib/db.ts` exposes a tiny `Db.query` interface; schema is bootstrapped idempotently by `ensureSchema`. Tests swap in PGlite via `setDbForTests`.
- Auth is a single-owner 6-digit passcode (`api/_lib/auth.ts`): scrypt-hashed; session = random token in an `HttpOnly; Secure; SameSite=Strict` cookie (only its SHA-256 stored, 90 days). New server features must check `isAuthenticated(req, db)`.
- Setup needs env `REP_SETUP_KEY` (chosen by the owner in Vercel; never in code or chat). Unset = setup disabled and the app simply opens. Setup closes once an owner exists; reset = delete the `owner` row.
- Rate limits: every attempt (passcode or setup key) is inserted as a failure *before* checking, then counted — this keeps concurrent bursts within limits. 5 failures / IP / 15 min (reset by a success); 30 / hour globally, except IPs with a successful sign-in in the last 90 days (so the cap can't lock the owner out).
- Tests: `npm test` runs `tests/*.test.ts` against PGlite.
- Offline-first wins: the client (`src/lib/auth.ts`) opens the app if the API is unreachable, has no database, or isn't JSON. The lock screen only appears when the server positively says "locked" or "setup". Never put secrets in client code.

## Conventions

- Weight is stored as a string (keeps exactly what the user typed, e.g. `"62.5"`); parse with `parseFloat` only when computing.
- Warm-up sets are logged but excluded from volume and set counts (`volumeOf`, `workingSets`); use `isWarmup`, don't re-check `type` inline.
- Only checked (✓) sets are saved to history on finish. Time-based exercises never count toward kg volume.
- Per-exercise history and records are **derived** from `history` (`src/lib/records.ts`, cached per history array) — don't store a second copy. Each `CompletedSession` stores the `prs` it set at finish time (optional field; older sessions have none).
- PR rules: judged only on checked, non-warm-up sets, in set order, against all prior sessions and earlier blocks of the same exercise in this session. One badge per set, priority Heaviest > nRM (≤ 12 reps; beats the heaviest weight ever done for at least n reps — needs such a prior set) > Best set (kg × reps) > Most reps (bodyweight). Plus one per-exercise session Volume PR. An exercise's first session with a working set is the baseline and awards nothing. Timed exercises have no PRs. Working volume has one definition: `setVolume` in records.ts.
- PR celebrations fire only on the ✓ tap that completes the set (not on later edits): an icon-only gold trophy badge pops into the set row (never text there — it must not overflow), particles burst from it, and an achievement card rises from the row with the full sentence (`announce(el, prTitle(p), p.detail)`), plus haptic. Chips elsewhere use the short `prLabel` (Heavy, 5RM, Best set, Reps, Volume); full sentences use `prTitle`. Toasts queue, so simultaneous ones play in turn. Finishing with PRs shows the PR summary sheet. Gold (`--gold`) is for PRs only.
- `npm run build` (type-checks client and `api/`, then builds) must pass before committing.
- Branches: `feat/*` for work, merged into `main`. Vercel deploys every push; `main` is production.
- Tasks are tracked in GitHub issues; reference them in commits (`#1`).
