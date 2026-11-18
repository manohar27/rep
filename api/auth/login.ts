import { login } from '../_lib/auth.js'

export function POST(request: Request) {
  return login(request)
}
