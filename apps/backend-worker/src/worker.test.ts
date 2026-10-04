import type { PushSender } from 'backend/src/push/web-push.ts'
import { addDaysToDate, formatDate } from 'utils'
import { afterAll, beforeAll, beforeEach, expect, test, vi } from 'vite-plus/test'

import { createTestEnv } from './dao/test-env.ts'
import { type WorkerEnv, build } from './worker.ts'

// End-to-end through the real wiring: Hono app -> services -> repositories -> D1/R2 DAOs on a
// local, in-memory D1 and R2. Google and the push services are faked; the clock is ours.

let env: Awaited<ReturnType<typeof createTestEnv>>
let clock = Date.now()
const push = { send: vi.fn<PushSender['send']>(async () => 'sent') }

const app = () =>
  build(
    {
      DB: env.db,
      IMAGES: env.bucket,
      SESSION_SECRET: 'test-secret',
      VAPID_PRIVATE_KEY: '',
      GOOGLE_CLIENT_ID: '',
      VAPID_PUBLIC_KEY: '',
      VAPID_SUBJECT: '',
    } as WorkerEnv,
    {
      runtime: { now: () => clock, newId: () => crypto.randomUUID() },
      // The credential is the Google account id.
      google: { verify: async (credential) => credential },
      push,
    },
  )

beforeAll(async () => {
  env = await createTestEnv()
})
afterAll(() => env.dispose())
beforeEach(async () => {
  await env.reset()
  clock = Date.now()
  push.send.mockClear()
})

const today = () => formatDate(new Date(clock))

/** What a browser adds to every same-origin `fetch` (the CSRF check relies on it). */
const sameOrigin = { 'sec-fetch-site': 'same-origin' }

type Body = Record<string, any>

/** Signs in (and agrees to the terms) as the Google account `sub`, returning an API caller. */
const signIn = async (sub: string) => {
  const { app: api } = app()
  const cookieOf = (res: Response) => (res.headers.get('set-cookie') ?? '').split(';')[0]
  const login = await api.request('/api/auth/google', {
    method: 'POST',
    headers: { ...sameOrigin, 'content-type': 'application/json' },
    body: JSON.stringify({ credential: sub }),
  })
  let cookie = cookieOf(login)
  const consent = await api.request('/api/auth/consent', {
    method: 'POST',
    headers: { ...sameOrigin, cookie },
  })
  cookie = cookieOf(consent)

  const call = async (
    method: string,
    path: string,
    body?: unknown,
  ): Promise<{ status: number; body: Body }> => {
    const res = await app().app.request(path, {
      method,
      headers: {
        ...sameOrigin,
        cookie,
        ...(body !== undefined && { 'content-type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    const isJson = res.headers.get('content-type')?.startsWith('application/json')
    return { status: res.status, body: isJson ? ((await res.json()) as Body) : {} }
  }
  return {
    get: (path: string) => call('GET', path),
    post: (path: string, body: unknown = {}) => call('POST', path, body),
    patch: (path: string, body: unknown) => call('PATCH', path, body),
    put: (path: string, body: unknown) => call('PUT', path, body),
    delete: (path: string, body?: unknown) => call('DELETE', path, body),
    /** Uploads `bytes` as a JPEG image of the event. */
    upload: async (eventId: string, bytes: Uint8Array<ArrayBuffer>) => {
      const res = await app().app.request(`/api/events/${eventId}/images?width=10&height=20`, {
        method: 'POST',
        headers: { ...sameOrigin, cookie, 'content-type': 'image/jpeg' },
        body: bytes,
      })
      return { status: res.status, body: (await res.json()) as Body }
    },
  }
}

const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3])

type Client = Awaited<ReturnType<typeof signIn>>

const event = (scheduleId: string, fields: Body = {}) => ({
  scheduleId,
  topicName: null,
  title: '打合せ',
  allDay: false,
  startDate: today(),
  startTime: '10:00',
  endDate: today(),
  endTime: '11:00',
  notifyMinutes: null,
  memo: null,
  ...fields,
})

const createSchedule = async (client: Client, scope: 'personal' | 'group', name: string) =>
  (await client.post('/api/schedules', { scope, name, color: 'blue' })).body.id as string

/** Syncs like the client: sends what it holds, keeps what comes back. */
const syncer = (client: Client) => {
  const state: { personalRev?: number; groupId?: string; groupRev?: number } = {}
  return async () => {
    const query = new URLSearchParams(
      Object.entries(state).flatMap(([key, value]) =>
        value === undefined ? [] : [[key, String(value)]],
      ),
    )
    const { body } = await client.get(`/api/sync?${query.toString()}`)
    if (body.personal) state.personalRev = body.personal.rev
    if (body.groupId !== state.groupId) {
      state.groupId = body.groupId ?? undefined
      state.groupRev = undefined
    }
    if (body.group) state.groupRev = body.group.rev
    return body
  }
}

test('personal data: full sync, then nothing when unchanged, then only the delta', async () => {
  const alice = await signIn('alice')
  const sync = syncer(alice)
  const work = await createSchedule(alice, 'personal', '仕事')
  const created = await alice.post(
    '/api/events',
    event(work, { topicName: '会議', notifyMinutes: 10 }),
  )
  expect(created.status).toBe(201)

  const first = await sync()
  expect(first.personal.full).toBe(true)
  expect(first.personal.scheduleOrder).toEqual([work])
  expect(first.personal.topics.map((topic: Body) => topic.name)).toEqual(['会議'])
  expect(first.personal.events).toHaveLength(1)
  expect(first.personal.events[0]).toMatchObject({
    title: '打合せ',
    topicId: first.personal.topics[0].id,
  })
  expect(first.personal.events[0]).not.toHaveProperty('notifyAt')

  expect((await sync()).personal).toBeNull()

  await alice.patch(`/api/events/${created.body.id}`, event(work, { title: '定例会議' }))
  const delta = await sync()
  expect(delta.personal.full).toBe(false)
  expect(delta.personal.schedules).toEqual([])
  expect(delta.personal.events.map((row: Body) => row.title)).toEqual(['定例会議'])
})

test('deleting a schedule sends its topics and events as deletions in the delta', async () => {
  const alice = await signIn('alice')
  const sync = syncer(alice)
  const work = await createSchedule(alice, 'personal', '仕事')
  await alice.post('/api/events', event(work, { topicName: '会議' }))
  await sync()

  expect((await alice.delete(`/api/schedules/${work}`)).status).toBe(200)
  const delta = await sync()

  const deleted = [...delta.personal.schedules, ...delta.personal.topics, ...delta.personal.events]
  expect(deleted).toHaveLength(3)
  expect(
    deleted.every((row: Body) => row.deletedAt !== null && row.rev === delta.personal.rev),
  ).toBe(true)
})

test('a client older than the purge gets a full sync', async () => {
  const alice = await signIn('alice')
  const sync = syncer(alice)
  const work = await createSchedule(alice, 'personal', '仕事')
  const study = await createSchedule(alice, 'personal', '勉強会')
  await sync()
  await alice.delete(`/api/schedules/${study}`)

  clock += 15 * 24 * 60 * 60 * 1000
  await app().jobs.purgeDeleted()

  const after = await sync()
  expect(after.personal.full).toBe(true)
  expect(after.personal.schedules.map((row: Body) => row.id)).toEqual([work])
  const remaining = await env.db
    .prepare('SELECT COUNT(*) AS n FROM schedules')
    .first<{ n: number }>()
  expect(remaining?.n).toBe(1)
})

test('group: invite, join, shared data, and leaving drops access', async () => {
  const alice = await signIn('alice')
  const bob = await signIn('bob')
  const aliceSync = syncer(alice)
  const bobSync = syncer(bob)

  await alice.post('/api/groups', { name: '山田家', memberName: '太郎' })
  const token = (await aliceSync()).group.info.inviteToken
  expect((await bob.get(`/api/invites/${token}`)).body).toEqual({ groupName: '山田家' })
  expect((await bob.post(`/api/invites/${token}/join`, { memberName: '太郎' })).body).toEqual({
    error: 'DUPLICATE_NAME',
  })
  clock += 1000
  expect((await bob.post(`/api/invites/${token}/join`, { memberName: '花子' })).status).toBe(200)

  const ichiro = await createSchedule(bob, 'group', '一郎')
  await bob.post('/api/events', event(ichiro, { title: 'サッカー練習' }))

  const shared = await aliceSync()
  expect(shared.group.full).toBe(false)
  expect(shared.group.members.map((member: Body) => member.memberName)).toEqual(['太郎', '花子'])
  expect(shared.group.events.map((row: Body) => row.title)).toEqual(['サッカー練習'])

  // Members can reissue the invite; the old link stops working.
  await bob.post('/api/groups/current/invite')
  expect((await bob.get(`/api/invites/${token}`)).status).toBe(410)

  expect((await bob.delete('/api/groups/current/members/me')).status).toBe(200)
  const afterLeave = await bobSync()
  expect(afterLeave.groupId).toBeNull()
  expect(afterLeave.group).toBeNull()
  expect((await bob.delete(`/api/schedules/${ichiro}`)).status).toBe(404)
})

test('the creator leaving hands the group to the earliest member; the last one deletes it', async () => {
  const alice = await signIn('alice')
  const bob = await signIn('bob')
  await alice.post('/api/groups', { name: '山田家', memberName: '太郎' })
  const token = (await syncer(alice)()).group.info.inviteToken
  clock += 1000
  await bob.post(`/api/invites/${token}/join`, { memberName: '花子' })

  await alice.delete('/api/groups/current/members/me')
  const bobView = await syncer(bob)()
  expect(bobView.group.info.ownerUserId).toBe(bobView.group.members[0].userId)

  await bob.delete('/api/groups/current/members/me')
  const group = await env.db
    .prepare('SELECT deleted_at FROM groups')
    .first<{ deleted_at: number | null }>()
  expect(group?.deleted_at).not.toBeNull()
})

test('moving an event from personal to group deletes it in one unit and adds it to the other', async () => {
  const alice = await signIn('alice')
  const sync = syncer(alice)
  await alice.post('/api/groups', { name: '山田家', memberName: '太郎' })
  const work = await createSchedule(alice, 'personal', '仕事')
  const family = await createSchedule(alice, 'group', '家族')
  const { id } = (await alice.post('/api/events', event(work))).body
  await sync()

  const moved = await alice.patch(`/api/events/${id}`, event(family))
  expect(moved.body.id).not.toBe(id)

  const delta = await sync()
  expect(delta.personal.events).toMatchObject([{ id, deletedAt: expect.any(Number) }])
  expect(delta.group.events).toMatchObject([{ id: moved.body.id, deletedAt: null }])
})

test('events per day per schedule are limited across multi-day events', async () => {
  const alice = await signIn('alice')
  const work = await createSchedule(alice, 'personal', '仕事')
  // A 3-day event covering the target day counts there too.
  await alice.post(
    '/api/events',
    event(work, {
      allDay: true,
      startTime: null,
      endTime: null,
      endDate: addDaysToDate(today(), 2),
    }),
  )
  for (let i = 1; i < 10; i++) {
    expect((await alice.post('/api/events', event(work))).status).toBe(201)
  }

  const eleventh = await alice.post(
    '/api/events',
    event(work, { startDate: addDaysToDate(today(), 2), endDate: addDaysToDate(today(), 2) }),
  )
  expect(eleventh.status).toBe(201)
  const overLimit = await alice.post('/api/events', event(work))
  expect(overLimit.body).toEqual({ error: 'LIMIT_EXCEEDED', limit: 'eventsPerDayPerSchedule' })
})

test('due notifications go to every member device once', async () => {
  const alice = await signIn('alice')
  const bob = await signIn('bob')
  await alice.post('/api/groups', { name: '山田家', memberName: '太郎' })
  const token = (await syncer(alice)()).group.info.inviteToken
  await bob.post(`/api/invites/${token}/join`, { memberName: '花子' })
  for (const [client, endpoint] of [
    [alice, 'a'],
    [bob, 'b'],
  ] as const) {
    await client.post('/api/push-subscriptions', {
      endpoint: `https://fcm.googleapis.com/fcm/send/${endpoint}`,
      p256dh: 'BKey',
      auth: 'secret',
    })
  }
  const family = await createSchedule(alice, 'group', '家族')
  const tomorrow = addDaysToDate(today(), 1)
  await alice.post(
    '/api/events',
    event(family, { startDate: tomorrow, endDate: tomorrow, notifyMinutes: 10 }),
  )

  clock = Date.parse(`${tomorrow}T00:50:00Z`) // 09:50 JST
  await app().jobs.sendNotifications()
  await app().jobs.sendNotifications()

  expect(push.send).toHaveBeenCalledTimes(2)
  expect(JSON.parse(push.send.mock.calls[0][1])).toMatchObject({ title: '打合せ' })
})

test('images: upload, serve with access control, count toward the event', async () => {
  const alice = await signIn('alice')
  const eve = await signIn('eve')
  const work = await createSchedule(alice, 'personal', '仕事')
  const { id } = (await alice.post('/api/events', event(work))).body

  const upload = await alice.upload(id, jpeg)
  expect(upload.status).toBe(201)
  const imageId = upload.body.id as string

  expect((await eve.get(`/api/images/${imageId}`)).status).toBe(404)
  const synced = await syncer(alice)()
  expect(synced.personal.images).toMatchObject([{ id: imageId, eventId: id, bytes: 7, width: 10 }])

  await alice.delete(`/api/events/${id}`)
  expect((await alice.get(`/api/images/${imageId}`)).status).toBe(404)
})

test('moving an event to another schedule moves its images with it', async () => {
  const alice = await signIn('alice')
  const work = await createSchedule(alice, 'personal', '仕事')
  const study = await createSchedule(alice, 'personal', '勉強会')
  const { id } = (await alice.post('/api/events', event(work))).body
  const imageId = (await alice.upload(id, jpeg)).body.id as string

  await alice.patch(`/api/events/${id}`, event(study))
  await alice.delete(`/api/schedules/${work}`)

  expect((await alice.get(`/api/images/${imageId}`)).status).toBe(200)
  await alice.delete(`/api/schedules/${study}`)
  expect((await alice.get(`/api/images/${imageId}`)).status).toBe(404)
})

test('withdrawal deletes personal data and ends access', async () => {
  const alice = await signIn('alice')
  await createSchedule(alice, 'personal', '仕事')

  expect((await alice.delete('/api/me')).status).toBe(200)

  expect((await alice.get('/api/sync')).status).toBe(401)
  const live = await env.db
    .prepare('SELECT COUNT(*) AS n FROM schedules WHERE deleted_at IS NULL')
    .first<{ n: number }>()
  expect(live?.n).toBe(0)
  // Signing in again with the same Google account starts over as a new user.
  const again = await signIn('alice')
  expect((await again.get('/api/sync')).body.personal.schedules).toEqual([])
})
