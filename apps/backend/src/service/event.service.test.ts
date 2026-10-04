import { expect, test, vi } from 'vite-plus/test'

import type { ImageStore } from '../dao/image-store.interface.ts'
import type { Event, Schedule, StoreRepository, User } from '../repository/store.repository.ts'
import { type EventInput, createEventService } from './event.service.ts'

const now = Date.parse('2026-10-04T01:00:00Z') // 2026-10-04 10:00 JST

const user: User = {
  id: 'u1',
  googleSub: 'sub',
  agreedTermsVersion: 1,
  groupId: 'g1',
  memberName: '太郎',
  joinedAt: 0,
  scheduleOrder: [],
  rev: 0,
  purgedRev: 0,
  createdAt: 0,
  deletedAt: null,
}

const schedule = (fields: Partial<Schedule> = {}): Schedule => ({
  id: 's1',
  scope: 'personal',
  ownerId: 'u1',
  name: '仕事',
  color: 'blue',
  createdAt: 0,
  updatedAt: 0,
  rev: 1,
  deletedAt: null,
  ...fields,
})

const storedEvent = (fields: Partial<Event>): Event => ({
  id: 'e0',
  scheduleId: 's1',
  ownerId: 'u1',
  topicId: null,
  title: 'x',
  startDate: '2026-10-05',
  startTime: null,
  endDate: '2026-10-05',
  endTime: null,
  notifyMinutes: null,
  notifyAt: null,
  memo: null,
  updatedBy: 'u1',
  createdAt: 0,
  updatedAt: 0,
  rev: 1,
  deletedAt: null,
  ...fields,
})

const input = (fields: Partial<EventInput> = {}): EventInput => ({
  scheduleId: 's1',
  topicName: null,
  title: '打合せ',
  allDay: false,
  startDate: '2026-10-05',
  startTime: '10:00',
  endDate: '2026-10-05',
  endTime: '11:00',
  notifyMinutes: null,
  memo: null,
  ...fields,
})

const fakeStore = (events: Event[] = [], schedules: Schedule[] = [schedule()]) => {
  const commit = vi.fn<StoreRepository['commit']>(async () => [1])
  const store = {
    findUser: async () => user,
    findSchedule: async (id: string) => schedules.find((s) => s.id === id) ?? null,
    findEvent: async (id: string) => events.find((e) => e.id === id) ?? null,
    listEventsStartingBetween: async () => events,
    listTopics: async () => [],
    listImages: async () => [],
    commit,
  } as unknown as StoreRepository
  return { store, commit }
}

const images: ImageStore = { put: vi.fn(), get: vi.fn(), copy: vi.fn(), delete: vi.fn() }
const runtime = { now: () => now, newId: () => 'new-id' }

const create = (fields: Partial<EventInput>, events: Event[] = []) => {
  const { store, commit } = fakeStore(events)
  return {
    result: createEventService(store, images, runtime).createEvent('u1', input(fields)),
    commit,
  }
}

test.each([
  ['an all-day event with a time', { allDay: true, endTime: null }],
  ['a timed event without a time', { endTime: null }],
  ['a time off the 5-minute grid', { startTime: '10:03' }],
  ['an end not after the start', { endTime: '10:00' }],
  ['a date before 2021', { startDate: '2020-12-31', endDate: '2020-12-31' }],
  ['a date after the current year + 3', { startDate: '2030-01-01', endDate: '2030-01-01' }],
  ['an all-day notification choice on a timed event', { notifyMinutes: -540 }],
])('rejects %s', async (_, fields) => {
  await expect(create(fields).result).rejects.toMatchObject({ code: 'VALIDATION' })
})

test('limits an event to 25 days, start and end included', async () => {
  await expect(
    create({ allDay: true, startTime: null, endTime: null, endDate: '2026-10-29' }).result,
  ).resolves.toEqual({ id: 'new-id' })
  await expect(
    create({ allDay: true, startTime: null, endTime: null, endDate: '2026-10-30' }).result,
  ).rejects.toMatchObject({ code: 'LIMIT_EXCEEDED', limit: 'eventMaxDays' })
})

test('counts events covering each day, including multi-day ones started earlier', async () => {
  const full = Array.from({ length: 10 }, (_, i) =>
    storedEvent({ id: `e${i}`, startDate: '2026-10-01', endDate: '2026-10-06' }),
  )

  await expect(create({}, full).result).rejects.toMatchObject({
    code: 'LIMIT_EXCEEDED',
    limit: 'eventsPerDayPerSchedule',
  })
  await expect(
    create({ startDate: '2026-10-07', endDate: '2026-10-07' }, full).result,
  ).resolves.toEqual({ id: 'new-id' })
})

test('stores when to notify, and nothing for a time already past', async () => {
  const future = create({ notifyMinutes: 10 })
  await future.result
  expect(future.commit.mock.calls[0]).toMatchObject([
    [{ scope: 'personal', id: 'u1' }],
    [
      {
        kind: 'insert',
        table: 'events',
        values: { notify_at: Date.parse('2026-10-05T00:50:00Z') },
      },
    ],
  ])

  // Starts 10:05 JST today; "1 day before" was yesterday, already past at `now`.
  const past = create({
    startDate: '2026-10-04',
    endDate: '2026-10-04',
    startTime: '10:05',
    notifyMinutes: 1440,
  })
  await past.result
  expect(past.commit.mock.calls[0][1]).toMatchObject([{ values: { notify_at: null } }])
})

test('reports a schedule of someone else as not found', async () => {
  const { store } = fakeStore([], [schedule({ ownerId: 'someone-else' })])

  await expect(
    createEventService(store, images, runtime).createEvent('u1', input()),
  ).rejects.toMatchObject({
    code: 'NOT_FOUND',
  })
})
