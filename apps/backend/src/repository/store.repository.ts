import type { ReadDao } from '../dao/read.interface.ts'
import type {
  EventRecord,
  GroupRecord,
  ImageRecord,
  ScheduleRecord,
  TopicRecord,
  UserRecord,
} from '../dao/records.ts'
import type { Mutation, Owner, SqlValue, Table, WriteDao } from '../dao/write.interface.ts'
import { type Camelize, camelize, snakify } from './case.ts'

export type { Owner } from '../dao/write.interface.ts'
export type { Scope } from '../dao/records.ts'

// Domain entities: the stored rows with camelCase fields.
export type User = Omit<Camelize<UserRecord>, 'scheduleOrder'> & { scheduleOrder: string[] }
export type Group = Camelize<GroupRecord>
export type Schedule = Camelize<ScheduleRecord>
export type Topic = Camelize<TopicRecord>
export type Event = Camelize<EventRecord>
export type EventImage = Camelize<ImageRecord>

/** Reads (live rows, see `ReadDao`) and atomic writes for the app's own data. */
export interface StoreRepository {
  findUser: (id: string) => Promise<User | null>
  findUserByGoogleSub: (googleSub: string) => Promise<User | null>
  listMembers: (groupId: string) => Promise<User[]>
  findGroup: (id: string) => Promise<Group | null>
  findGroupByInviteToken: (token: string) => Promise<Group | null>
  findSchedule: (id: string) => Promise<Schedule | null>
  listSchedules: (ownerId: string) => Promise<Schedule[]>
  findTopic: (id: string) => Promise<Topic | null>
  listTopics: (scheduleId: string) => Promise<Topic[]>
  findEvent: (id: string) => Promise<Event | null>
  listEventsStartingBetween: (
    scheduleId: string,
    fromDate: string,
    toDate: string,
  ) => Promise<Event[]>
  findImage: (id: string) => Promise<EventImage | null>
  listImages: (eventId: string) => Promise<EventImage[]>
  sumImageBytes: (ownerId: string) => Promise<number>
  /** See `WriteDao.commit`. Build the mutations with the helpers below. */
  commit: (bumps: Owner[], mutations: Mutation[]) => Promise<number[]>
}

export const toUser = (record: UserRecord): User => ({
  ...camelize(record),
  scheduleOrder: JSON.parse(record.schedule_order) as string[],
})

const orNull = <T, U>(value: T | null, map: (value: T) => U): U | null =>
  value === null ? null : map(value)

export const createStoreRepository = (read: ReadDao, write: WriteDao): StoreRepository => ({
  findUser: async (id) => orNull(await read.findUser(id), toUser),
  findUserByGoogleSub: async (googleSub) =>
    orNull(await read.findUserByGoogleSub(googleSub), toUser),
  listMembers: async (groupId) => (await read.listMembers(groupId)).map(toUser),
  findGroup: async (id) => orNull(await read.findGroup(id), camelize),
  findGroupByInviteToken: async (token) =>
    orNull(await read.findGroupByInviteToken(token), camelize),
  findSchedule: async (id) => orNull(await read.findSchedule(id), camelize),
  listSchedules: async (ownerId) => (await read.listSchedules(ownerId)).map(camelize),
  findTopic: async (id) => orNull(await read.findTopic(id), camelize),
  listTopics: async (scheduleId) => (await read.listTopics(scheduleId)).map(camelize),
  findEvent: async (id) => orNull(await read.findEvent(id), camelize),
  listEventsStartingBetween: async (scheduleId, fromDate, toDate) =>
    (await read.listEventsStartingBetween(scheduleId, fromDate, toDate)).map(camelize),
  findImage: async (id) => orNull(await read.findImage(id), camelize),
  listImages: async (eventId) => (await read.listImages(eventId)).map(camelize),
  sumImageBytes: (ownerId) => read.sumImageBytes(ownerId),
  commit: (bumps, mutations) => write.commit(bumps, mutations),
})

// Mutation builders: domain fields (camelCase) in, storage columns out.

type Fields = Record<string, SqlValue>

/** Inserts a row; with `revOf`, its `rev` is that owner's revision after this write. */
export const insert = (table: Table, values: Fields, revOf?: Owner): Mutation => ({
  kind: 'insert',
  table,
  values: snakify(values),
  revOf,
})

export const update = (table: Table, where: Fields, set: Fields, revOf?: Owner): Mutation => ({
  kind: 'update',
  table,
  where: snakify(where),
  set: snakify(set),
  revOf,
})

type SyncedTable = 'schedules' | 'topics' | 'events' | 'event_images'

/** Logically deletes the live rows of a synced table matching `where`. */
export const softDelete = (
  table: SyncedTable,
  where: Fields,
  now: number,
  revOf: Owner,
): Mutation =>
  update(table, { ...where, deletedAt: null }, { deletedAt: now, updatedAt: now }, revOf)

/**
 * Logically deletes everything under `where` for the whole schedule/topic/event/image chain:
 * `where` is a column every synced table has (`scheduleId`, or `ownerId` for all of an owner's data).
 */
export const softDeleteTree = (
  where: { scheduleId: string } | { ownerId: string },
  now: number,
  revOf: Owner,
): Mutation[] => {
  const scheduleWhere = 'scheduleId' in where ? { id: where.scheduleId } : where
  return [
    softDelete('event_images', where, now, revOf),
    softDelete('events', where, now, revOf),
    softDelete('topics', where, now, revOf),
    softDelete('schedules', scheduleWhere, now, revOf),
  ]
}

export const joinGroup = (
  userId: string,
  groupId: string,
  memberName: string,
  joinedAt: number,
  maxMembers: number,
): Mutation => ({ kind: 'joinGroup', userId, groupId, memberName, joinedAt, maxMembers })

/** Takes a user out of their group (leave, removal, group deletion, withdrawal). */
export const leaveGroup = (where: { id: string } | { groupId: string }): Mutation =>
  update('users', where, { groupId: null, memberName: null, joinedAt: null })
