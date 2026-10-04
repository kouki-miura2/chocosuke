import { addDaysToDate, daysBetween, formatDate } from 'utils'

// Display formats of docs/spec.md "共通ルール > 日付・日時の表示". Dates are `YYYY-MM-DD` strings
// and times `HH:mm`, already in the app's time zone.

export const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土'] as const

/** Today in the app's time zone, `YYYY-MM-DD`. */
export const today = (now: Date = new Date()): string => formatDate(now)

/** Day of the week of a date, 0 = Sunday. */
export const weekdayOf = (date: string): number => ((daysBetween('1970-01-04', date) % 7) + 7) % 7 // 1970-01-04 was a Sunday

/** `2026/09/29` */
export const formatYmd = (date: string): string => date.replaceAll('-', '/')

/** `9/29` */
export const formatMd = (date: string): string =>
  `${Number(date.slice(5, 7))}/${Number(date.slice(8))}`

/** `2026/10/05（月）` */
export const formatYmdWeekday = (date: string): string =>
  `${formatYmd(date)}（${WEEKDAYS[weekdayOf(date)]}）`

/** `2026/09/29 10:21` from epoch ms. */
export const formatDateTime = (epochMs: number): string =>
  formatDate(new Date(epochMs), 'yyyy/MM/dd HH:mm')

/** `2026年10月` from any date in the month. */
export const formatYearMonth = (date: string): string =>
  `${date.slice(0, 4)}年${Number(date.slice(5, 7))}月`

/** The first day of the month of `date`. */
export const monthStart = (date: string): string => `${date.slice(0, 7)}-01`

/** The first day of the month `months` away from the month of `date`. */
export const addMonthsToDate = (date: string, months: number): string => {
  const index = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1 + months
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}-01`
}

/** The dates from `from` to `to`, both included. */
export const datesBetween = (from: string, to: string): string[] =>
  Array.from({ length: daysBetween(from, to) + 1 }, (_, i) => addDaysToDate(from, i))

interface EventTime {
  allDay: boolean
  startDate: string
  startTime: string | null
  endDate: string
  endTime: string | null
}

/**
 * When an event happens, for its detail (docs/spec.md "イベント > 画面"):
 * `2026/10/05（月）10:00 – 11:00`, only the date when all-day, both dates when it spans days.
 */
export const formatEventTime = (event: EventTime): string => {
  const sameDay = event.startDate === event.endDate
  if (event.allDay) {
    return sameDay
      ? formatYmdWeekday(event.startDate)
      : `${formatYmdWeekday(event.startDate)} – ${formatYmdWeekday(event.endDate)}`
  }
  return sameDay
    ? `${formatYmdWeekday(event.startDate)}${event.startTime} – ${event.endTime}`
    : `${formatYmdWeekday(event.startDate)}${event.startTime} – ${formatYmdWeekday(event.endDate)}${event.endTime}`
}
