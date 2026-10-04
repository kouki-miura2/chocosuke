import type { SyncResponse } from '../api/types.ts'
import {
  ALL_STORES,
  type LocalDb,
  RECORD_STORES,
  type RecordStore,
  type SyncState,
  emptySyncState,
} from './local-db.ts'

/** The `GET /api/sync` query for what the device holds (units it has nothing of are left out). */
export const syncQuery = (state: SyncState): Record<string, string> => ({
  ...(state.personalRev !== null && { personalRev: String(state.personalRev) }),
  ...(state.groupId !== null &&
    state.groupRev !== null && { groupId: state.groupId, groupRev: String(state.groupRev) }),
})

/**
 * Stores a sync response for `userId` (docs/spec.md "データ取得・同期 > 画面での反映") in one
 * IndexedDB transaction, so the records and the revisions never disagree:
 * - a changed group drops the old group's records;
 * - a `full` unit replaces its records, a delta overwrites by id and drops the deleted ones.
 */
export const applySync = async (db: LocalDb, userId: string, response: SyncResponse) => {
  const tx = db.transaction(ALL_STORES, 'readwrite')
  const kv = tx.objectStore('kv')
  const state = ((await kv.get('sync')) as SyncState | undefined) ?? emptySyncState
  const next: SyncState = { ...state, userId }

  const removeOwner = async (ownerId: string) => {
    for (const store of RECORD_STORES) {
      let cursor = await tx.objectStore(store).index('ownerId').openCursor(ownerId)
      while (cursor) {
        await cursor.delete()
        cursor = await cursor.continue()
      }
    }
  }

  const applyUnit = async (
    ownerId: string,
    unit: Pick<NonNullable<SyncResponse['personal']>, 'full' | RecordStore>,
  ) => {
    if (unit.full) await removeOwner(ownerId)
    for (const store of RECORD_STORES) {
      const target = tx.objectStore(store)
      for (const record of unit[store]) {
        if (record.deletedAt === null) await target.put(record as never)
        else await target.delete(record.id)
      }
    }
  }

  if (response.groupId !== state.groupId) {
    if (state.groupId) await removeOwner(state.groupId)
    next.groupId = response.groupId
    next.groupRev = null
    next.group = null
  }
  if (response.personal) {
    await applyUnit(userId, response.personal)
    next.personalRev = response.personal.rev
    next.scheduleOrder = response.personal.scheduleOrder
  }
  if (response.group && response.groupId) {
    await applyUnit(response.groupId, response.group)
    next.groupRev = response.group.rev
    next.group = { info: response.group.info, members: response.group.members }
  }

  await kv.put(next, 'sync')
  await tx.done
}
