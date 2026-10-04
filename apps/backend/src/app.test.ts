import { expect, test, vi } from 'vite-plus/test'

import { type AppDependencies, PUBLIC_PATHS, createApp } from './app.ts'
import { createSessionCodec } from './auth/session.ts'
import { AppError } from './errors.ts'
import type { AuthGuard } from './repository/auth-guard.interface.ts'
import { createSessionAuthGuard } from './repository/auth-guard.session.ts'

const session = createSessionCodec('test-secret')

/** Services that fail loudly unless a test stubs the method it calls. */
const unexpected = () => {
  throw new Error('unexpected service call')
}
const stubs = <T extends object>(overrides: Partial<NoInfer<T>> = {}): T =>
  new Proxy(overrides, { get: (target, key) => target[key as keyof T] ?? unexpected }) as T

const createTestApp = (overrides: Partial<AppDependencies> = {}) =>
  createApp({
    accountService: stubs(),
    scheduleService: stubs(),
    eventService: stubs(),
    imageService: stubs(),
    groupService: stubs(),
    syncService: stubs(),
    pushService: stubs(),
    sampleService: stubs(),
    google: stubs(),
    session,
    auth: { guard: createSessionAuthGuard(session), enabled: true, excludePaths: PUBLIC_PATHS },
    ...overrides,
  })

const cookieFor = async (userId = 'u1', termsVersion = 1) =>
  `session=${await session.issue({ userId, termsVersion })}`

const json = (body: unknown, cookie?: string): RequestInit => ({
  method: 'POST',
  headers: { 'content-type': 'application/json', ...(cookie && { cookie }) },
  body: JSON.stringify(body),
})

test('rejects requests without a session', async () => {
  const res = await createTestApp().request('/api/sync')

  expect(res.status).toBe(401)
  expect(await res.json()).toEqual({ error: 'UNAUTHORIZED' })
})

test('login verifies the Google credential and sets an HttpOnly session cookie', async () => {
  const app = createTestApp({
    google: { verify: vi.fn(async () => 'google-sub') },
    accountService: stubs({ login: vi.fn(async () => ({ userId: 'u1', termsVersion: 0 })) }),
  })

  const res = await app.request('/api/auth/google', json({ credential: 'id-token' }))

  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ needsConsent: true })
  const cookie = res.headers.get('set-cookie') ?? ''
  expect(cookie).toMatch(/^session=[^;]+;/)
  expect(cookie).toContain('HttpOnly')
  expect(cookie).toContain('Secure')
  expect(cookie).toContain('SameSite=Lax')
})

test('login rejects an invalid Google credential', async () => {
  const app = createTestApp({ google: { verify: vi.fn(async () => null) } })

  const res = await app.request('/api/auth/google', json({ credential: 'bad' }))

  expect(res.status).toBe(401)
})

test('asks for consent before anything but the consent-free paths', async () => {
  const getMe = vi.fn(async () => ({ id: 'u1', needsConsent: true, groupId: null }))
  const app = createTestApp({ accountService: stubs({ getMe }) })
  const cookie = await cookieFor('u1', 0)

  const blocked = await app.request('/api/sync', { headers: { cookie } })
  const allowed = await app.request('/api/me', { headers: { cookie } })

  expect(blocked.status).toBe(403)
  expect(await blocked.json()).toEqual({ error: 'CONSENT_REQUIRED' })
  expect(allowed.status).toBe(200)
})

test('maps service errors to their status, with the exceeded limit', async () => {
  const createSchedule = vi.fn(async () => {
    throw new AppError('LIMIT_EXCEEDED', { limit: 'personalSchedules' })
  })
  const app = createTestApp({ scheduleService: stubs({ createSchedule }) })

  const res = await app.request(
    '/api/schedules',
    json({ scope: 'personal', name: '仕事', color: 'blue' }, await cookieFor()),
  )

  expect(res.status).toBe(409)
  expect(await res.json()).toEqual({ error: 'LIMIT_EXCEEDED', limit: 'personalSchedules' })
})

test('rejects invalid bodies before the service, trimming and counting visible characters', async () => {
  const createSchedule = vi.fn(async () => ({ id: 's1' }))
  const app = createTestApp({ scheduleService: stubs({ createSchedule }) })
  const cookie = await cookieFor()

  const blank = await app.request(
    '/api/schedules',
    json({ scope: 'personal', name: '   ', color: 'blue' }, cookie),
  )
  const emoji = await app.request(
    '/api/schedules',
    json({ scope: 'personal', name: ` ${'👨‍👩‍👧'.repeat(20)} `, color: 'blue' }, cookie),
  )

  expect(blank.status).toBe(400)
  expect(await blank.json()).toEqual({ error: 'VALIDATION' })
  expect(emoji.status).toBe(201)
  expect(createSchedule).toHaveBeenCalledWith('u1', {
    scope: 'personal',
    name: '👨‍👩‍👧'.repeat(20),
    color: 'blue',
  })
})

test('hides unexpected errors behind a 500', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {})
  const app = createTestApp({
    syncService: stubs({
      sync: vi.fn(async () => {
        throw new Error('boom')
      }),
    }),
  })

  const res = await app.request('/api/sync', { headers: { cookie: await cookieFor() } })

  expect(res.status).toBe(500)
  expect(await res.json()).toEqual({ error: 'INTERNAL' })
  vi.mocked(console.error).mockRestore()
})

test('serves images privately with a long immutable cache', async () => {
  const getImage = vi.fn(async () => new Blob(['jpeg']).stream())
  const app = createTestApp({ imageService: stubs({ getImage }) })

  const res = await app.request('/api/images/i1', { headers: { cookie: await cookieFor() } })

  expect(res.headers.get('content-type')).toBe('image/jpeg')
  expect(res.headers.get('cache-control')).toBe('private, max-age=31536000, immutable')
  expect(await res.text()).toBe('jpeg')
})

test('clearing the device unsubscribes, ends the session and clears the HTTP cache', async () => {
  const unsubscribe = vi.fn(async () => {})
  const app = createTestApp({ pushService: stubs({ unsubscribe }) })
  const endpoint = 'https://fcm.googleapis.com/fcm/send/x'

  const res = await app.request('/api/device/clear', json({ endpoint }, await cookieFor()))

  expect(unsubscribe).toHaveBeenCalledWith('u1', endpoint)
  expect(res.headers.get('clear-site-data')).toBe('"cache"')
  expect(res.headers.get('set-cookie')).toMatch(/^session=;/)
})

test('rejects cross-site form posts', async () => {
  const res = await createTestApp().request('http://localhost/api/auth/logout', {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      origin: 'https://evil.example',
    },
  })

  expect(res.status).toBe(403)
})

test('logs a matching started/completed pair, including for a rejected request', async () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {})
  const denyAll: AuthGuard = { authenticate: async () => null }
  const app = createTestApp({ auth: { guard: denyAll, enabled: true, excludePaths: [] } })

  const res = await app.request('/api/sync')
  expect(res.status).toBe(401)

  expect(info).toHaveBeenCalledTimes(2)
  const started = JSON.parse(info.mock.calls[0][0] as string)
  const completed = JSON.parse(info.mock.calls[1][0] as string)
  expect(started).toMatchObject({ message: 'request started', method: 'GET', path: '/api/sync' })
  expect(completed).toMatchObject({
    message: 'request completed',
    method: 'GET',
    path: '/api/sync',
    user: 'anonymous',
    status: 401,
  })
  expect(completed.requestId).toBe(started.requestId)
  expect(typeof completed.durationMs).toBe('number')

  info.mockRestore()
})
