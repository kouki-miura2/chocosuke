import {
  LIMITS,
  addDaysToDate,
  daysBetween,
  isNotifyMinutes,
  isOnTimeStep,
  notifyAt,
  selectableDateRange,
} from 'utils'

import type { ImageStore } from '../dao/image-store.interface.ts'
import type { Mutation } from '../dao/write.interface.ts'
import { AppError } from '../errors.ts'
import {
  type Schedule,
  type StoreRepository,
  type User,
  insert,
  softDelete,
  update,
} from '../repository/store.repository.ts'
import { type Runtime, assertAccess, ownerFor, ownerOf, requireUser } from './context.ts'

/** Shape and length are checked by the route; the rules across fields are checked here. */
export interface EventInput {
  scheduleId: string
  /** An existing topic of the schedule, or a new one to create; `null` for none. */
  topicName: string | null
  title: string
  allDay: boolean
  startDate: string
  /** `null` when `allDay`. */
  startTime: string | null
  endDate: string
  /** `null` when `allDay`. */
  endTime: string | null
  notifyMinutes: number | null
  memo: string | null
  /** Place name, address or coordinates, shown on a map; `null` for none. */
  location: string | null
  /** A web page about the event (http/https); `null` for none. */
  url: string | null
}

export interface EventService {
  createEvent: (userId: string, input: EventInput) => Promise<{ id: string }>
  /**
   * Updates the event. Moving it to a schedule of the other scope (personal <-> group) deletes it
   * and registers it again under a new id with copies of its images, so both sync units see the
   * change (docs/spec.md "イベント > 登録・変更・削除"); the returned id is the event's id afterwards.
   */
  updateEvent: (userId: string, id: string, input: EventInput) => Promise<{ id: string }>
  /** Deletes the event with its images. */
  deleteEvent: (userId: string, id: string) => Promise<void>
}

/**
 * Checks the fields on their own. `keptTimes` are the event's current times: one already saved off
 * the time step (from before it was 10 minutes) can stay as it is, only a changed one must be on it.
 */
const validateFields = (
  input: EventInput,
  now: number,
  keptTimes: (string | null)[] = [],
): void => {
  const invalid = (message: string) => new AppError('VALIDATION', { message })

  if (input.allDay) {
    if (input.startTime !== null || input.endTime !== null) throw invalid('all-day has no time')
    if (input.endDate < input.startDate) throw invalid('end before start')
  } else {
    if (input.startTime === null || input.endTime === null) throw invalid('time required')
    const onStep = (time: string) => isOnTimeStep(time) || keptTimes.includes(time)
    if (!onStep(input.startTime) || !onStep(input.endTime)) throw invalid('time off the time step')
    if (`${input.endDate} ${input.endTime}` <= `${input.startDate} ${input.startTime}`) {
      throw invalid('end not after start')
    }
  }
  if (daysBetween(input.startDate, input.endDate) + 1 > LIMITS.eventMaxDays) {
    throw new AppError('LIMIT_EXCEEDED', { limit: 'eventMaxDays' })
  }
  const range = selectableDateRange(new Date(now))
  if (input.startDate < range.min || input.endDate > range.max) throw invalid('out of range')
  if (input.notifyMinutes !== null && !isNotifyMinutes(input.notifyMinutes, input.allDay)) {
    throw invalid('unknown notification choice')
  }
}

export const createEventService = (
  store: StoreRepository,
  images: ImageStore,
  runtime: Runtime,
): EventService => {
  const findAccessibleSchedule = async (user: User, id: string) => {
    const schedule = await store.findSchedule(id)
    if (!schedule) throw new AppError('NOT_FOUND')
    assertAccess(user, schedule.ownerId)
    return schedule
  }

  const findAccessibleEvent = async (user: User, id: string) => {
    const event = await store.findEvent(id)
    if (!event) throw new AppError('NOT_FOUND')
    assertAccess(user, event.ownerId)
    return event
  }

  /** `LIMITS.eventsPerDayPerSchedule` on every day the event covers, not counting `exceptId`. */
  const assertDayCount = async (input: EventInput, exceptId?: string) => {
    // An event covering a day starts at most eventMaxDays - 1 days before it.
    const from = addDaysToDate(input.startDate, -(LIMITS.eventMaxDays - 1))
    const others = (
      await store.listEventsStartingBetween(input.scheduleId, from, input.endDate)
    ).filter((event) => event.id !== exceptId)
    for (let day = input.startDate; day <= input.endDate; day = addDaysToDate(day, 1)) {
      const count = others.filter((event) => event.startDate <= day && event.endDate >= day).length
      if (count >= LIMITS.eventsPerDayPerSchedule) {
        throw new AppError('LIMIT_EXCEEDED', { limit: 'eventsPerDayPerSchedule' })
      }
    }
  }

  /** The topic id for `topicName`, creating the topic when the schedule doesn't have it yet. */
  const resolveTopic = async (
    schedule: Schedule,
    topicName: string | null,
    now: number,
  ): Promise<{ topicId: string | null; mutations: Mutation[] }> => {
    if (topicName === null) return { topicId: null, mutations: [] }
    const topics = await store.listTopics(schedule.id)
    const existing = topics.find((topic) => topic.name === topicName)
    if (existing) return { topicId: existing.id, mutations: [] }
    if (topics.length >= LIMITS.topicsPerSchedule) {
      throw new AppError('LIMIT_EXCEEDED', { limit: 'topicsPerSchedule' })
    }
    const topicId = runtime.newId()
    const values = {
      id: topicId,
      scheduleId: schedule.id,
      ownerId: schedule.ownerId,
      name: topicName,
      createdAt: now,
      updatedAt: now,
    }
    return { topicId, mutations: [insert('topics', values, ownerOf(schedule))] }
  }

  /** Every stored field of the event that comes from the input. */
  const eventFields = (
    user: User,
    schedule: Schedule,
    topicId: string | null,
    input: EventInput,
    now: number,
  ) => {
    const at = notifyAt(input.startDate, input.startTime, input.notifyMinutes)
    return {
      scheduleId: schedule.id,
      ownerId: schedule.ownerId,
      topicId,
      title: input.title,
      startDate: input.startDate,
      startTime: input.startTime,
      endDate: input.endDate,
      endTime: input.endTime,
      notifyMinutes: input.notifyMinutes,
      // A notification time already past at save is never sent.
      notifyAt: at !== null && at > now ? at : null,
      memo: input.memo,
      location: input.location,
      url: input.url,
      updatedBy: user.id,
      updatedAt: now,
    }
  }

  return {
    createEvent: async (userId, input) => {
      const user = await requireUser(store, userId)
      const now = runtime.now()
      validateFields(input, now)
      const schedule = await findAccessibleSchedule(user, input.scheduleId)
      await assertDayCount(input)
      const topic = await resolveTopic(schedule, input.topicName, now)

      const id = runtime.newId()
      const owner = ownerOf(schedule)
      await store.commit(
        [owner],
        [
          ...topic.mutations,
          insert(
            'events',
            { id, ...eventFields(user, schedule, topic.topicId, input, now), createdAt: now },
            owner,
          ),
        ],
      )
      return { id }
    },

    updateEvent: async (userId, id, input) => {
      const user = await requireUser(store, userId)
      const now = runtime.now()
      const event = await findAccessibleEvent(user, id)
      validateFields(input, now, [event.startTime, event.endTime])
      const schedule = await findAccessibleSchedule(user, input.scheduleId)
      await assertDayCount(input, id)
      const topic = await resolveTopic(schedule, input.topicName, now)
      const owner = ownerOf(schedule)
      const fields = eventFields(user, schedule, topic.topicId, input, now)

      if (event.ownerId === schedule.ownerId) {
        // The images carry the schedule id too (deleting a schedule deletes by it).
        const moveImages =
          event.scheduleId === schedule.id
            ? []
            : [
                update(
                  'event_images',
                  { eventId: id, deletedAt: null },
                  { scheduleId: schedule.id, updatedAt: now },
                  owner,
                ),
              ]
        await store.commit(
          [owner],
          [
            ...topic.mutations,
            update('events', { id, deletedAt: null }, fields, owner),
            ...moveImages,
          ],
        )
        return { id }
      }

      // Moving across scopes: delete here, register anew there, with copies of the images.
      const previousOwner = ownerFor(user, event.ownerId)
      const newId = runtime.newId()
      const copies = (await store.listImages(id)).map((image) => ({
        image,
        copyId: runtime.newId(),
      }))
      await Promise.all(copies.map(({ image, copyId }) => images.copy(image.id, copyId)))
      try {
        await store.commit(
          [previousOwner, owner],
          [
            softDelete('event_images', { eventId: id }, now, previousOwner),
            softDelete('events', { id }, now, previousOwner),
            ...topic.mutations,
            insert('events', { id: newId, ...fields, createdAt: now }, owner),
            ...copies.map(({ image, copyId }) =>
              insert(
                'event_images',
                {
                  id: copyId,
                  eventId: newId,
                  scheduleId: schedule.id,
                  ownerId: schedule.ownerId,
                  bytes: image.bytes,
                  width: image.width,
                  height: image.height,
                  sortOrder: image.sortOrder,
                  createdAt: now,
                  updatedAt: now,
                },
                owner,
              ),
            ),
          ],
        )
      } catch (error) {
        await images.delete(copies.map(({ copyId }) => copyId))
        throw error
      }
      return { id: newId }
    },

    deleteEvent: async (userId, id) => {
      const user = await requireUser(store, userId)
      const event = await findAccessibleEvent(user, id)
      const now = runtime.now()
      const owner = ownerFor(user, event.ownerId)
      await store.commit(
        [owner],
        [
          softDelete('event_images', { eventId: id }, now, owner),
          softDelete('events', { id }, now, owner),
        ],
      )
    },
  }
}
