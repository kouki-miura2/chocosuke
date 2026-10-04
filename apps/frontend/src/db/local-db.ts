import { type DBSchema, type IDBPDatabase, openDB } from 'idb'

import type { CalendarEvent, EventImage, GroupInfo, Member, Schedule, Topic } from '../api/types.ts'

// The local DB (docs/spec.md "データ仕様 > ローカルDB"): every synced record, the sync state and the
// view state, in IndexedDB. Changing the structure bumps `VERSION`, which empties every store so the
// next sync fetches everything again (no migrations).

const NAME = 'chocosuke'
const VERSION = 1

export const RECORD_STORES = ['schedules', 'topics', 'events', 'images'] as const
export type RecordStore = (typeof RECORD_STORES)[number]
/** Every store, for a transaction over the whole DB. */
export const ALL_STORES = [...RECORD_STORES, 'kv'] as const

/** What the device holds of the sync units (`kv` key `sync`). */
export interface SyncState {
  /** Whose data this is; another user signing in empties the DB first. */
  userId: string | null
  personalRev: number | null
  groupId: string | null
  groupRev: number | null
  group: { info: GroupInfo; members: Member[] } | null
  scheduleOrder: string[]
}

export const emptySyncState: SyncState = {
  userId: null,
  personalRev: null,
  groupId: null,
  groupRev: null,
  group: null,
  scheduleOrder: [],
}

/** Everything synced, as the screens read it. */
export interface LocalData extends SyncState {
  schedules: Schedule[]
  topics: Topic[]
  events: CalendarEvent[]
  images: EventImage[]
}

interface Schema extends DBSchema {
  schedules: { key: string; value: Schedule; indexes: { ownerId: string } }
  topics: { key: string; value: Topic; indexes: { ownerId: string } }
  events: { key: string; value: CalendarEvent; indexes: { ownerId: string } }
  images: { key: string; value: EventImage; indexes: { ownerId: string } }
  kv: { key: string; value: unknown }
}

export type LocalDb = IDBPDatabase<Schema>

export const openLocalDb = (name = NAME): Promise<LocalDb> =>
  openDB<Schema>(name, VERSION, {
    upgrade: (db) => {
      for (const store of Array.from(db.objectStoreNames)) db.deleteObjectStore(store)
      db.createObjectStore('schedules', { keyPath: 'id' }).createIndex('ownerId', 'ownerId')
      db.createObjectStore('topics', { keyPath: 'id' }).createIndex('ownerId', 'ownerId')
      db.createObjectStore('events', { keyPath: 'id' }).createIndex('ownerId', 'ownerId')
      db.createObjectStore('images', { keyPath: 'id' }).createIndex('ownerId', 'ownerId')
      db.createObjectStore('kv')
    },
  })

let shared: Promise<LocalDb> | undefined

/** The app's local DB, opened once. */
export const localDb = (): Promise<LocalDb> => (shared ??= openLocalDb())

export const readSyncState = async (db: LocalDb): Promise<SyncState> =>
  ((await db.get('kv', 'sync')) as SyncState | undefined) ?? emptySyncState

export const readAll = async (db: LocalDb): Promise<LocalData> => {
  const [state, schedules, topics, events, images] = await Promise.all([
    readSyncState(db),
    db.getAll('schedules'),
    db.getAll('topics'),
    db.getAll('events'),
    db.getAll('images'),
  ])
  return { ...state, schedules, topics, events, images }
}

/** Empties the whole local DB, view state included. */
export const clearAll = async (db: LocalDb): Promise<void> => {
  const tx = db.transaction(ALL_STORES, 'readwrite')
  await Promise.all([
    ...RECORD_STORES.map((store) => tx.objectStore(store).clear()),
    tx.objectStore('kv').clear(),
  ])
  await tx.done
}
