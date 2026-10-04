import { sign, verify } from 'hono/jwt'
import { LIMITS } from 'utils'

/** Name of the HttpOnly cookie holding the session token. */
export const SESSION_COOKIE = 'session'

export const sessionMaxAgeSeconds = LIMITS.sessionDays * 24 * 60 * 60

export interface SessionClaims {
  userId: string
  /** The terms version the user had agreed to when the session was issued. */
  termsVersion: string
}

export interface SessionCodec {
  issue: (claims: SessionClaims) => Promise<string>
  /** The claims of a valid, unexpired token, or `null`. */
  read: (token: string) => Promise<SessionClaims | null>
}

/**
 * Stateless sessions: an HS256 JWT signed with `secret`, so authenticating a request reads no DB
 * rows (docs/spec.md "アーキテクチャ > 認証").
 */
export const createSessionCodec = (
  secret: string,
  now: () => number = () => Date.now(),
): SessionCodec => ({
  issue: (claims) =>
    sign(
      {
        sub: claims.userId,
        tv: claims.termsVersion,
        exp: Math.floor(now() / 1000) + sessionMaxAgeSeconds,
      },
      secret,
      'HS256',
    ),
  read: async (token) => {
    try {
      const payload = await verify(token, secret, 'HS256')
      return typeof payload.sub === 'string' && typeof payload.tv === 'string'
        ? { userId: payload.sub, termsVersion: payload.tv }
        : null
    } catch {
      return null
    }
  },
})
