import { parse } from 'hono/utils/cookie'

import { SESSION_COOKIE, type SessionCodec } from '../auth/session.ts'
import type { AuthGuard } from './auth-guard.interface.ts'

/** Reads the session cookie issued at login (`auth/session.ts`). */
export const createSessionAuthGuard = (codec: SessionCodec): AuthGuard => ({
  authenticate: async (request) => {
    const token = parse(request.headers.get('cookie') ?? '', SESSION_COOKIE)[SESSION_COOKIE]
    const claims = token ? await codec.read(token) : null
    return claims && { id: claims.userId, termsVersion: claims.termsVersion }
  },
})
