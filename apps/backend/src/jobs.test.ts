import { expect, test, vi } from 'vite-plus/test'

import type { ImageStore } from './dao/image-store.interface.ts'
import { createJobs, notificationBody } from './jobs.ts'
import type { PushSender } from './push/web-push.ts'
import type { DueEvent, JobRepository } from './repository/job.repository.ts'

const now = Date.parse('2026-10-05T00:50:00Z')

const dueEvent = (fields: Partial<DueEvent>): DueEvent => ({
  id: 'e1',
  title: '打合せ',
  startDate: '2026-10-05',
  startTime: '10:00',
  notifyAt: now,
  scheduleName: '仕事',
  scope: 'personal',
  ownerId: 'u1',
  ...fields,
})

const fakeJobs = (due: DueEvent[]) =>
  ({
    listDueEvents: vi.fn(async () => due),
    clearNotifyAt: vi.fn(async () => {}),
    listSubscriptions: vi.fn(async () => [
      { id: 's1', userId: 'u1', endpoint: 'https://push/1', p256dh: 'k', auth: 'a', createdAt: 0 },
      { id: 's2', userId: 'u1', endpoint: 'https://push/2', p256dh: 'k', auth: 'a', createdAt: 0 },
    ]),
    upsertSubscription: vi.fn(),
    deleteSubscriptionByEndpoint: vi.fn(),
    deleteSubscriptions: vi.fn(async () => {}),
    listPurgeableImageIds: vi.fn(async () => ['i1']),
    purge: vi.fn(async () => {}),
  }) satisfies JobRepository

const images: ImageStore = {
  put: vi.fn(),
  get: vi.fn(),
  copy: vi.fn(),
  delete: vi.fn(async () => {}),
}

test('notificationBody shows the JST date, weekday, time and schedule', () => {
  expect(notificationBody(dueEvent({}))).toBe('10/5（月） 10:00 · 仕事')
  expect(notificationBody(dueEvent({ startTime: null }))).toBe('10/5（月） · 仕事')
})

test('sendNotifications sends to every subscription, drops gone ones and clears notify_at', async () => {
  const jobs = fakeJobs([dueEvent({})])
  const push: PushSender = {
    send: vi.fn(async (target) => (target.endpoint === 'https://push/2' ? 'gone' : 'sent')),
  }

  await createJobs({ jobs, images, push, now: () => now }).sendNotifications()

  expect(push.send).toHaveBeenCalledTimes(2)
  expect(JSON.parse(vi.mocked(push.send).mock.calls[0][1])).toEqual({
    title: '打合せ',
    body: '10/5（月） 10:00 · 仕事',
    eventId: 'e1',
  })
  expect(jobs.deleteSubscriptions).toHaveBeenCalledWith(['s2'])
  expect(jobs.clearNotifyAt).toHaveBeenCalledWith(['e1'])
})

test('sendNotifications drops notifications more than 10 minutes late without sending', async () => {
  const jobs = fakeJobs([dueEvent({ notifyAt: now - 11 * 60 * 1000 })])
  const push: PushSender = { send: vi.fn(async () => 'sent' as const) }

  await createJobs({ jobs, images, push, now: () => now }).sendNotifications()

  expect(push.send).not.toHaveBeenCalled()
  expect(jobs.clearNotifyAt).toHaveBeenCalledWith(['e1'])
})

test('purgeDeleted removes image objects before the rows, with the retention cutoff', async () => {
  const jobs = fakeJobs([])
  const push: PushSender = { send: vi.fn() }

  await createJobs({ jobs, images, push, now: () => now }).purgeDeleted()

  const cutoff = now - 14 * 24 * 60 * 60 * 1000
  expect(jobs.listPurgeableImageIds).toHaveBeenCalledWith(cutoff)
  expect(images.delete).toHaveBeenCalledWith(['i1'])
  expect(jobs.purge).toHaveBeenCalledWith(cutoff)
})
