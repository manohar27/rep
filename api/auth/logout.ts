import { logout } from '../_lib/auth.js'

export function POST(request: Request) {
  return logout(request)
}
