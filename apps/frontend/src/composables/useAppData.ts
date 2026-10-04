import { computed } from 'vue'

import type { Schedule } from '../api/types.ts'
import { type LocalData, emptySyncState } from '../db/local-db.ts'
import type { CalendarItem } from '../lib/calendar.ts'
import { scheduleColor } from '../lib/colors.ts'
import { orderSchedules } from '../lib/schedules.ts'
import { useSyncQuery } from './useSyncQuery.ts'

const emptyData: LocalData = {
  ...emptySyncState,
  schedules: [],
  topics: [],
  events: [],
  images: [],
}

/** An event as the calendar shows it. */
export interface CalendarEntry extends CalendarItem {
  scheduleId: string
  endTime: string | null
  scope: Schedule['scope']
  topicName: string | null
  hasImages: boolean
}

/**
 * The synced data as the screens read it (docs/spec.md "データ取得・同期 > 画面での反映": filters,
 * counts and ordering are computed here from the local data, never by the API).
 */
export const useAppData = () => {
  const sync = useSyncQuery()
  const data = computed(() => sync.data.value ?? emptyData)

  const schedules = computed(() => orderSchedules(data.value.schedules, data.value.scheduleOrder))
  const scheduleById = computed(() => new Map(schedules.value.map((s) => [s.id, s])))
  const topicById = computed(() => new Map(data.value.topics.map((t) => [t.id, t])))
  const eventById = computed(() => new Map(data.value.events.map((e) => [e.id, e])))

  const topicsOf = (scheduleId: string | null) =>
    data.value.topics
      .filter((topic) => topic.scheduleId === scheduleId)
      .sort((a, b) => a.createdAt - b.createdAt)

  const imagesOf = (eventId: string) =>
    data.value.images
      .filter((image) => image.eventId === eventId)
      .sort((a, b) => a.sortOrder - b.sortOrder)

  const group = computed(() => (data.value.groupId ? data.value.group : null))
  const isGroupOwner = computed(() => group.value?.info.ownerUserId === data.value.userId)

  /** A member's name; "元メンバー" once they left (docs/spec.md "イベント > 画面"). */
  const memberName = (userId: string) =>
    group.value?.members.find((member) => member.userId === userId)?.memberName ?? '元メンバー'

  const calendarEntries = computed<CalendarEntry[]>(() => {
    const order = new Map(schedules.value.map((s, i) => [s.id, i]))
    const withImages = new Set(data.value.images.map((image) => image.eventId))
    return data.value.events.flatMap((event) => {
      const schedule = scheduleById.value.get(event.scheduleId)
      if (!schedule) return []
      return [
        {
          id: event.id,
          title: event.title,
          allDay: event.startTime === null,
          startDate: event.startDate,
          startTime: event.startTime,
          endDate: event.endDate,
          color: scheduleColor(schedule.color),
          order: order.get(schedule.id) ?? 0,
          scheduleId: schedule.id,
          endTime: event.endTime,
          scope: schedule.scope,
          topicName: (event.topicId && topicById.value.get(event.topicId)?.name) || null,
          hasImages: withImages.has(event.id),
        },
      ]
    })
  })

  return {
    sync,
    data,
    schedules,
    scheduleById,
    topicById,
    eventById,
    topicsOf,
    imagesOf,
    group,
    isGroupOwner,
    memberName,
    calendarEntries,
  }
}
