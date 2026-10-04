import { toInstant } from '../date/day.ts'

/**
 * Notification choices of an event (`docs/spec.md` "イベント > 項目 > 通知"), as minutes before the
 * event starts. An all-day event counts from 00:00 of its start date, so "9:00 that day" is -540
 * and "9:00 the day before" is 900 (15 hours before midnight). Shared by the event form and the API.
 */
export const NOTIFY_MINUTES = {
  /** At start, 5 / 10 / 30 minutes, 1 hour, 1 day before. */
  timed: [0, 5, 10, 30, 60, 1440],
  /** 9:00 that day, 9:00 the day before. */
  allDay: [-540, 900],
} as const

/** Whether `minutes` is one of the choices for an all-day (`allDay`) or timed event. */
export const isNotifyMinutes = (minutes: number, allDay: boolean): boolean =>
  (NOTIFY_MINUTES[allDay ? 'allDay' : 'timed'] as readonly number[]).includes(minutes)

/**
 * When to notify, in epoch ms: `notifyMinutes` before `startDate` `startTime` (00:00 for an all-day
 * event). `null` without a notification.
 */
export const notifyAt = (
  startDate: string,
  startTime: string | null,
  notifyMinutes: number | null,
): number | null =>
  notifyMinutes === null
    ? null
    : toInstant(startDate, startTime ?? '00:00').getTime() - notifyMinutes * 60 * 1000
