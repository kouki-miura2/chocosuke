import { queryOptions, useQuery } from '@tanstack/vue-query'
import { LIMITS } from 'utils'

import { ApiError, call } from '../api/call.ts'
import { apiClient } from '../api/client.ts'
import { applySync, syncQuery } from '../db/apply-sync.ts'
import { type LocalData, clearAll, localDb, readAll, readSyncState } from '../db/local-db.ts'
import { queryClient } from '../query-client.ts'
import { meQueryOptions } from './useMeQuery.ts'

/**
 * Sync (docs/spec.md "データ取得・同期 > TanStack Query との役割分担"): calls `GET /api/sync` with
 * what the device holds, stores the answer in the local DB, and returns all local data. Another
 * user's data is erased first. Runs on focus, every `syncCheckIntervalMinutes` while in front,
 * and after every change (`invalidateQueries(['sync'])`).
 */
export const runSync = async (): Promise<LocalData> => {
  const me = await queryClient.fetchQuery(meQueryOptions)
  if (!me) throw new ApiError('UNAUTHORIZED', 401)
  const db = await localDb()
  let state = await readSyncState(db)
  if (state.userId !== me.id) {
    await clearAll(db)
    state = await readSyncState(db)
  }
  const response = await call(apiClient.api.sync.$get({ query: syncQuery(state) }))
  await applySync(db, me.id, response)
  return readAll(db)
}

export const syncQueryOptions = queryOptions({
  queryKey: ['sync'],
  queryFn: runSync,
  refetchOnWindowFocus: 'always',
  refetchInterval: LIMITS.syncCheckIntervalMinutes * 60 * 1000,
})

/** Shows the local DB right away (`main.ts`), then syncs: like `initialData`, but already stale. */
export const seedFromLocalDb = async () => {
  const data = await readAll(await localDb())
  if (data.userId) queryClient.setQueryData(syncQueryOptions.queryKey, data, { updatedAt: 0 })
}

export const useSyncQuery = () => useQuery(syncQueryOptions)
