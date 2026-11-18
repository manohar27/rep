import { status } from '../_lib/auth.js'

export function GET(request: Request) {
  return status(request)
}
