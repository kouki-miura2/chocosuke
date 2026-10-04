import 'fake-indexeddb/auto'
import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, expect, test, vi } from 'vite-plus/test'
import { nextTick } from 'vue'

import { openLocalDb } from '../db/local-db.ts'
import { useViewStateStore } from './view-state.ts'

beforeEach(() => {
  setActivePinia(createPinia())
})

test('loads the saved state and saves changes', async () => {
  const db = await openLocalDb('view-state-test')
  await db.put('kv', { viewMode: 'week' }, 'viewState')
  const store = useViewStateStore()

  await store.load(db)
  expect(store.viewMode).toBe('week')
  expect(store.monthStyle).toBe('bar')

  store.toggleSchedule('s1')
  await nextTick()
  await vi.waitFor(async () =>
    expect(await db.get('kv', 'viewState')).toMatchObject({ hiddenScheduleIds: ['s1'] }),
  )
  store.toggleSchedule('s1')
  expect(store.hiddenScheduleIds).toEqual([])
})
