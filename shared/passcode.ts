// Shared by the client (instant feedback) and the API (the authority).

export const isPasscode = (p: unknown): p is string => typeof p === 'string' && /^\d{6}$/.test(p)

// Rejects codes an attacker would try first: repeated digits, runs, and common patterns.
export function isWeak(p: string) {
  if (/^(\d)\1{5}$/.test(p)) return true
  if ('01234567890'.includes(p) || '09876543210'.includes(p)) return true
  if (/^(\d\d)\1\1$/.test(p) || /^(\d{3})\1$/.test(p)) return true // 121212, 123123
  return ['112233', '159753', '147258', '696969', '102030'].includes(p)
}
