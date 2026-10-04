import { expect, test } from 'vite-plus/test'

import { createSessionCodec } from '../auth/session.ts'
import { createSessionAuthGuard } from './auth-guard.session.ts'

// hono's verify checks `exp` against the real clock, so the tests issue tokens relative to it.
const now = Date.now()
const codec = createSessionCodec('test-secret', () => now)

const requestWithCookie = (cookie?: string) =>
  new Request('http://localhost/api/me', { headers: cookie ? { cookie } : {} })

test('resolves the user from a valid session cookie', async () => {
  const token = await codec.issue({ userId: 'u1', termsVersion: 1 })

  await expect(
    createSessionAuthGuard(codec).authenticate(requestWithCookie(`other=x; session=${token}`)),
  ).resolves.toEqual({ id: 'u1', termsVersion: 1 })
})

test('rejects a missing cookie and a token signed with another secret', async () => {
  const forged = await createSessionCodec('other-secret', () => now).issue({
    userId: 'u1',
    termsVersion: 1,
  })
  const guard = createSessionAuthGuard(codec)

  await expect(guard.authenticate(requestWithCookie())).resolves.toBeNull()
  await expect(guard.authenticate(requestWithCookie(`session=${forged}`))).resolves.toBeNull()
})

test('rejects an expired session', async () => {
  const issuedLongAgo = createSessionCodec('test-secret', () => now - 31 * 24 * 60 * 60 * 1000)
  const token = await issuedLongAgo.issue({ userId: 'u1', termsVersion: 1 })

  await expect(
    createSessionAuthGuard(codec).authenticate(requestWithCookie(`session=${token}`)),
  ).resolves.toBeNull()
})
