import { expect, test, vi } from 'vite-plus/test'

import type { Group, StoreRepository, User } from '../repository/store.repository.ts'
import type { SyncRepository } from '../repository/sync.repository.ts'
import { createSyncService } from './sync.service.ts'

const user = (fields: Partial<User> = {}): User => ({
  id: 'u1',
  googleSub: 'sub',
  agreedTermsVersion: '2026-10-01',
  groupId: null,
  memberName: null,
  joinedAt: null,
  scheduleOrder: ['s1'],
  rev: 10,
  purgedRev: 4,
  createdAt: 0,
  deletedAt: null,
  ...fields,
})

const group: Group = {
  id: 'g1',
  name: '山田家',
  ownerUserId: 'u1',
  inviteToken: 'token',
  inviteExpiresAt: 0,
  rev: 7,
  purgedRev: 0,
  createdAt: 0,
  deletedAt: null,
}

const setup = (me: User) => {
  const readChanges = vi.fn<SyncRepository['readChanges']>(async () => ({
    schedules: [],
    topics: [],
    events: [],
    images: [],
  }))
  const store = {
    findUser: async () => me,
    findGroup: async () => group,
    listMembers: async () => [me],
  } as unknown as StoreRepository
  return { sync: createSyncService(store, { readChanges }).sync, readChanges }
}

test.each([
  ['nothing held', undefined, null],
  ['a revision older than the purge', 3, null],
  ['a revision ahead of the server', 11, null],
  ['a revision within range', 6, 6],
])('with %s, reads from %s', async (_, personalRev, since) => {
  const { sync, readChanges } = setup(user())

  const view = await sync('u1', { personalRev })

  expect(readChanges).toHaveBeenCalledWith({ scope: 'personal', id: 'u1' }, since)
  expect(view.personal).toMatchObject({ rev: 10, full: since === null, scheduleOrder: ['s1'] })
})

test('reads nothing for an unchanged unit', async () => {
  const { sync, readChanges } = setup(user())

  const view = await sync('u1', { personalRev: 10 })

  expect(readChanges).not.toHaveBeenCalled()
  expect(view).toEqual({ groupId: null, personal: null, group: null })
})

test('sends the whole group when the client held another group', async () => {
  const { sync, readChanges } = setup(user({ groupId: 'g1', memberName: '太郎', joinedAt: 1 }))

  const view = await sync('u1', { personalRev: 10, groupId: 'old-group', groupRev: 7 })

  expect(readChanges).toHaveBeenCalledWith({ scope: 'group', id: 'g1' }, null)
  expect(view.groupId).toBe('g1')
  expect(view.group).toMatchObject({
    rev: 7,
    full: true,
    info: { id: 'g1', name: '山田家' },
    members: [{ userId: 'u1', memberName: '太郎', joinedAt: 1 }],
  })
})
