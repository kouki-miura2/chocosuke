import 'fake-indexeddb/auto'
import { expect, test } from 'vite-plus/test'

import type { Schedule, SyncResponse } from '../api/types.ts'
import { applySync, syncQuery } from './apply-sync.ts'
import { clearAll, openLocalDb, readAll, readSyncState } from './local-db.ts'

let dbCount = 0
const freshDb = () => openLocalDb(`test-${++dbCount}`)

const schedule = (id: string, ownerId: string, fields: Partial<Schedule> = {}): Schedule => ({
  id,
  scope: ownerId.startsWith('g') ? 'group' : 'personal',
  ownerId,
  name: id,
  color: 'blue',
  createdAt: 1,
  updatedAt: 1,
  rev: 1,
  deletedAt: null,
  ...fields,
})

const unit = (rev: number, full: boolean, schedules: Schedule[]) => ({
  rev,
  full,
  schedules,
  topics: [],
  events: [],
  images: [],
})

const groupInfo = (id: string) => ({
  info: { id, name: '山田家', ownerUserId: 'u1', inviteToken: 't', inviteExpiresAt: 0 },
  members: [{ userId: 'u1', memberName: '太郎', joinedAt: 0 }],
})

test('stores a full sync, then a delta that updates and deletes by id', async () => {
  const db = await freshDb()
  await applySync(db, 'u1', {
    groupId: null,
    personal: {
      ...unit(2, true, [schedule('a', 'u1'), schedule('b', 'u1')]),
      scheduleOrder: ['b', 'a'],
    },
    group: null,
  } as SyncResponse)

  await applySync(db, 'u1', {
    groupId: null,
    personal: {
      ...unit(3, false, [
        schedule('a', 'u1', { name: '仕事' }),
        schedule('b', 'u1', { deletedAt: 5 }),
      ]),
      scheduleOrder: ['a'],
    },
    group: null,
  } as SyncResponse)

  const data = await readAll(db)
  expect(data.schedules).toEqual([schedule('a', 'u1', { name: '仕事' })])
  expect(data).toMatchObject({ userId: 'u1', personalRev: 3, scheduleOrder: ['a'] })
  expect(syncQuery(data)).toEqual({ personalRev: '3' })
})

test('a full unit replaces what the device held of it', async () => {
  const db = await freshDb()
  const personal = (schedules: Schedule[]) => ({ ...unit(1, true, schedules), scheduleOrder: [] })
  await applySync(db, 'u1', {
    groupId: null,
    personal: personal([schedule('old', 'u1')]),
    group: null,
  } as SyncResponse)

  await applySync(db, 'u1', {
    groupId: null,
    personal: personal([schedule('new', 'u1')]),
    group: null,
  } as SyncResponse)

  expect((await readAll(db)).schedules.map((s) => s.id)).toEqual(['new'])
})

test("drops the old group's data when the group changes, and keeps it while unchanged", async () => {
  const db = await freshDb()
  await applySync(db, 'u1', {
    groupId: 'g1',
    personal: null,
    group: { ...unit(4, true, [schedule('g-sched', 'g1')]), ...groupInfo('g1') },
  } as SyncResponse)
  expect(syncQuery(await readSyncState(db))).toEqual({ groupId: 'g1', groupRev: '4' })

  await applySync(db, 'u1', { groupId: 'g1', personal: null, group: null } as SyncResponse)
  expect((await readAll(db)).schedules).toHaveLength(1)

  await applySync(db, 'u1', { groupId: null, personal: null, group: null } as SyncResponse)
  const data = await readAll(db)
  expect(data.schedules).toEqual([])
  expect(data).toMatchObject({ groupId: null, groupRev: null, group: null })
})

test('clearAll empties records and state', async () => {
  const db = await freshDb()
  await applySync(db, 'u1', {
    groupId: null,
    personal: { ...unit(1, true, [schedule('a', 'u1')]), scheduleOrder: [] },
    group: null,
  } as SyncResponse)

  await clearAll(db)

  expect(await readAll(db)).toMatchObject({ userId: null, schedules: [], personalRev: null })
})
