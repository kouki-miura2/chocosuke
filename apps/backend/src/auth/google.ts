import { verifyWithJwks } from 'hono/jwt'
import type { HonoJsonWebKey } from 'hono/utils/jwt/jws'

const jwksUri = 'https://www.googleapis.com/oauth2/v3/certs'
/** Fallback cache lifetime when Google's response has no `max-age`. */
const defaultCacheMs = 60 * 60 * 1000

export interface GoogleVerifier {
  /** The Google account id (`sub`) of a valid ID token for this app, or `null`. */
  verify: (idToken: string) => Promise<string | null>
}

/**
 * Verifies Google Identity Services ID tokens: signature against Google's JWKS (cached as long as
 * Google's `Cache-Control` allows, refetched once when a token names an unknown key), issuer,
 * audience (`clientId`) and expiry.
 */
export const createGoogleVerifier = (
  clientId: string,
  fetchJwks: () => Promise<Response> = () => fetch(jwksUri),
  now: () => number = () => Date.now(),
): GoogleVerifier => {
  let cache: { keys: HonoJsonWebKey[]; expiresAt: number } | null = null

  const loadKeys = async (): Promise<HonoJsonWebKey[]> => {
    const response = await fetchJwks()
    if (!response.ok) throw new Error(`failed to fetch Google JWKS: ${response.status}`)
    const maxAge = /max-age=(\d+)/.exec(response.headers.get('cache-control') ?? '')
    const { keys } = (await response.json()) as { keys: HonoJsonWebKey[] }
    cache = { keys, expiresAt: now() + (maxAge ? Number(maxAge[1]) * 1000 : defaultCacheMs) }
    return keys
  }

  const verifyWith = async (idToken: string, keys: HonoJsonWebKey[]) => {
    const payload = await verifyWithJwks(idToken, {
      keys,
      allowedAlgorithms: ['RS256'],
      verification: { iss: /^(https:\/\/)?accounts\.google\.com$/, aud: clientId },
    })
    return typeof payload.sub === 'string' ? payload.sub : null
  }

  return {
    verify: async (idToken) => {
      const cached = cache && cache.expiresAt > now() ? cache.keys : null
      try {
        return await verifyWith(idToken, cached ?? (await loadKeys()))
      } catch {
        if (!cached) return null
        // Google may have rotated its keys since they were cached.
        try {
          return await verifyWith(idToken, await loadKeys())
        } catch {
          return null
        }
      }
    },
  }
}
