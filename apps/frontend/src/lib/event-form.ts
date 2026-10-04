import {
  LIMITS,
  NOTIFY_MINUTES,
  addDaysToDate,
  charLength,
  daysBetween,
  isNotifyMinutes,
  selectableDateRange,
} from 'utils'

import type { CalendarEvent, EventInput } from '../api/types.ts'
import { datesBetween } from './format.ts'

// The event form's rules (docs/spec.md "イベント > 項目", "登録・変更・削除"), checked here before
// the API checks them again.

export interface EventForm {
  scheduleId: string | null
  topicName: string
  title: string
  allDay: boolean
  startDate: string
  startTime: string | null
  endDate: string
  endTime: string | null
  notifyMinutes: number | null
  memo: string
}

export const emptyEventForm = (date: string): EventForm => ({
  scheduleId: null,
  topicName: '',
  title: '',
  allDay: false,
  startDate: date,
  startTime: '10:00',
  endDate: date,
  endTime: '11:00',
  notifyMinutes: null,
  memo: '',
})

export const formOfEvent = (event: CalendarEvent, topicName: string): EventForm => ({
  scheduleId: event.scheduleId,
  topicName,
  title: event.title,
  allDay: event.startTime === null,
  startDate: event.startDate,
  startTime: event.startTime,
  endDate: event.endDate,
  endTime: event.endTime,
  notifyMinutes: event.notifyMinutes,
  memo: event.memo ?? '',
})

const notifyLabels: Record<number, string> = {
  0: '開始時刻',
  5: '5分前',
  10: '10分前',
  30: '30分前',
  60: '1時間前',
  1440: '1日前',
  [-540]: '当日9:00',
  900: '前日9:00',
}

/** The notification choices for an all-day or timed event, "なし" first. */
export const notifyOptions = (allDay: boolean): { value: number | null; title: string }[] => [
  { value: null, title: 'なし' },
  ...NOTIFY_MINUTES[allDay ? 'allDay' : 'timed'].map((value) => ({
    value,
    title: notifyLabels[value],
  })),
]

export const notifyLabel = (minutes: number | null): string =>
  minutes === null ? 'なし' : (notifyLabels[minutes] ?? '')

/** Every 5 minutes of a day: `00:00` … `23:55`. */
export const TIME_OPTIONS = Array.from({ length: 24 * 12 }, (_, i) => {
  const minutes = i * 5
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`
})

/** The form as the API takes it (`POST/PATCH /api/events`). */
export const toEventInput = (form: EventForm): EventInput => ({
  scheduleId: form.scheduleId ?? '',
  topicName: form.topicName.trim() || null,
  title: form.title.trim(),
  allDay: form.allDay,
  startDate: form.startDate,
  startTime: form.allDay ? null : form.startTime,
  endDate: form.endDate,
  endTime: form.allDay ? null : form.endTime,
  notifyMinutes: form.notifyMinutes,
  memo: form.memo.trim() || null,
})

/**
 * What's wrong with the form, as messages (empty when it can be saved). `events` are the local
 * events of the chosen schedule, for the per-day limit; `editingId` leaves the edited event out.
 */
export const validateEventForm = (
  form: EventForm,
  events: CalendarEvent[],
  now: Date,
  editingId?: string,
): string[] => {
  const errors: string[] = []
  const title = form.title.trim()
  if (!form.scheduleId) errors.push('予定を選んでください')
  if (!title) errors.push('タイトルを入力してください')
  if (charLength(title) > LIMITS.eventTitleMaxLength) {
    errors.push(`タイトルは${LIMITS.eventTitleMaxLength}文字までです`)
  }
  if (charLength(form.topicName.trim()) > LIMITS.topicNameMaxLength) {
    errors.push(`トピックは${LIMITS.topicNameMaxLength}文字までです`)
  }
  if (charLength(form.memo.trim()) > LIMITS.eventMemoMaxLength) {
    errors.push(`メモは${LIMITS.eventMemoMaxLength}文字までです`)
  }

  const { min, max } = selectableDateRange(now)
  if (!form.startDate || !form.endDate) {
    errors.push('日付を入力してください')
    return errors
  }
  if (form.startDate < min || form.endDate > max) errors.push('登録できない日付です')
  if (!form.allDay && (!form.startTime || !form.endTime)) errors.push('時刻を入力してください')
  const start = `${form.startDate} ${form.allDay ? '' : form.startTime}`
  const end = `${form.endDate} ${form.allDay ? '' : form.endTime}`
  if (form.allDay ? form.endDate < form.startDate : end <= start) {
    errors.push('終了は開始より後にしてください')
  } else if (daysBetween(form.startDate, form.endDate) + 1 > LIMITS.eventMaxDays) {
    errors.push(`イベントは${LIMITS.eventMaxDays}日までです`)
  } else {
    const full = fullDay(form, events, editingId)
    if (full) {
      errors.push(
        `${full.replaceAll('-', '/')} のイベントが${LIMITS.eventsPerDayPerSchedule}件を超えます`,
      )
    }
  }
  if (form.notifyMinutes !== null && !isNotifyMinutes(form.notifyMinutes, form.allDay)) {
    errors.push('通知を選び直してください')
  }
  return errors
}

/** The first day the event would push its schedule past `eventsPerDayPerSchedule`, if any. */
const fullDay = (form: EventForm, events: CalendarEvent[], editingId?: string): string | null => {
  const others = events.filter(
    (event) => event.id !== editingId && event.scheduleId === form.scheduleId,
  )
  for (const date of datesBetween(form.startDate, form.endDate)) {
    const count = others.filter((event) => event.startDate <= date && date <= event.endDate).length
    if (count + 1 > LIMITS.eventsPerDayPerSchedule) return date
  }
  return null
}

/** When the start date moves, the end keeps the same distance (and never goes before the start). */
export const shiftEndDate = (form: EventForm, previousStart: string): string => {
  const length = Math.max(0, daysBetween(previousStart, form.endDate))
  return addDaysToDate(form.startDate, length)
}
