import { setup } from '../_lib/auth.js'

export function POST(request: Request) {
  return setup(request)
}
