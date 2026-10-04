import { LIMITS } from 'utils'

import { AppError } from '../errors.ts'
import {
  type Owner,
  type Scope,
  type StoreRepository,
  insert,
  softDelete,
  softDeleteTree,
  update,
} from '../repository/store.repository.ts'
import {
  type Runtime,
  assertAccess,
  groupOwner,
  ownerFor,
  ownerOf,
  personalOwner,
  requireGroupId,
  requireUser,
} from './context.ts'

export interface ScheduleInput {
  scope: Scope
  name: string
  color: string
}

export interface ScheduleService {
  createSchedule: (userId: string, input: ScheduleInput) => Promise<{ id: string }>
  updateSchedule: (userId: string, id: string, input: Omit<ScheduleInput, 'scope'>) => Promise<void>
  /** Deletes the schedule with its topics, events and images. */
  deleteSchedule: (userId: string, id: string) => Promise<void>
  renameTopic: (userId: string, id: string, name: string) => Promise<void>
  /** Deletes the topic; events that had it are left without a topic. */
  deleteTopic: (userId: string, id: string) => Promise<void>
}

export const createScheduleService = (
  store: StoreRepository,
  runtime: Runtime,
): ScheduleService => {
  const assertUniqueName = async (ownerId: string, name: string, exceptId?: string) => {
    const schedules = await store.listSchedules(ownerId)
    if (schedules.some((schedule) => schedule.name === name && schedule.id !== exceptId)) {
      throw new AppError('DUPLICATE_NAME')
    }
    return schedules
  }

  const findAccessibleSchedule = async (userId: string, id: string) => {
    const user = await requireUser(store, userId)
    const schedule = await store.findSchedule(id)
    if (!schedule) throw new AppError('NOT_FOUND')
    assertAccess(user, schedule.ownerId)
    return schedule
  }

  const findAccessibleTopic = async (userId: string, id: string) => {
    const user = await requireUser(store, userId)
    const topic = await store.findTopic(id)
    if (!topic) throw new AppError('NOT_FOUND')
    assertAccess(user, topic.ownerId)
    return { topic, owner: ownerFor(user, topic.ownerId) }
  }

  return {
    createSchedule: async (userId, input) => {
      const user = await requireUser(store, userId)
      const owner: Owner =
        input.scope === 'personal' ? personalOwner(user) : groupOwner(requireGroupId(user))
      const limit = input.scope === 'personal' ? 'personalSchedules' : 'groupSchedules'
      const schedules = await assertUniqueName(owner.id, input.name)
      if (schedules.length >= LIMITS[limit]) throw new AppError('LIMIT_EXCEEDED', { limit })

      const id = runtime.newId()
      const now = runtime.now()
      // The creator sees the new schedule at the end of their own order (docs/spec.md "予定 > 一覧").
      const bumps = owner.scope === 'personal' ? [owner] : [owner, personalOwner(user)]
      await store.commit(bumps, [
        insert(
          'schedules',
          {
            id,
            scope: input.scope,
            ownerId: owner.id,
            name: input.name,
            color: input.color,
            createdAt: now,
            updatedAt: now,
          },
          owner,
        ),
        update(
          'users',
          { id: user.id },
          { scheduleOrder: JSON.stringify([...user.scheduleOrder, id]) },
        ),
      ])
      return { id }
    },

    updateSchedule: async (userId, id, input) => {
      const schedule = await findAccessibleSchedule(userId, id)
      await assertUniqueName(schedule.ownerId, input.name, id)
      const owner = ownerOf(schedule)
      await store.commit(
        [owner],
        [
          update(
            'schedules',
            { id, deletedAt: null },
            { name: input.name, color: input.color, updatedAt: runtime.now() },
            owner,
          ),
        ],
      )
    },

    deleteSchedule: async (userId, id) => {
      const schedule = await findAccessibleSchedule(userId, id)
      const owner = ownerOf(schedule)
      await store.commit([owner], softDeleteTree({ scheduleId: id }, runtime.now(), owner))
    },

    renameTopic: async (userId, id, name) => {
      const { topic, owner } = await findAccessibleTopic(userId, id)
      const topics = await store.listTopics(topic.scheduleId)
      if (topics.some((other) => other.name === name && other.id !== id)) {
        throw new AppError('DUPLICATE_NAME')
      }
      await store.commit(
        [owner],
        [update('topics', { id, deletedAt: null }, { name, updatedAt: runtime.now() }, owner)],
      )
    },

    deleteTopic: async (userId, id) => {
      const { owner } = await findAccessibleTopic(userId, id)
      const now = runtime.now()
      await store.commit(
        [owner],
        [
          softDelete('topics', { id }, now, owner),
          update(
            'events',
            { topicId: id, deletedAt: null },
            { topicId: null, updatedAt: now },
            owner,
          ),
        ],
      )
    },
  }
}
