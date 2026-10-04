import { addDaysToDate, daysBetween } from 'utils'

import { addMonthsToDate, weekdayOf } from './format.ts'

// Calendar layout, DOM-free (docs/spec.md "カレンダー"). Dates are `YYYY-MM-DD` strings.

/** What the calendar needs of an event. */
export interface CalendarItem {
  id: string
  title: string
  allDay: boolean
  startDate: string
  startTime: string | null
  endDate: string
  color: string
  /** Position of the event's schedule in the user's order. */
  order: number
}

/** All-day and multi-day events come first, as all-day ones (docs/spec.md "カレンダー > 一覧"). */
const isAllDayLike = (item: CalendarItem): boolean => item.allDay || item.startDate !== item.endDate

/** Order within a day: all-day (the earlier-starting first) → start time → schedule order. */
export const compareForDay = (a: CalendarItem, b: CalendarItem): number =>
  Number(isAllDayLike(b)) - Number(isAllDayLike(a)) ||
  (isAllDayLike(a)
    ? a.startDate.localeCompare(b.startDate)
    : (a.startTime ?? '').localeCompare(b.startTime ?? '')) ||
  a.order - b.order ||
  a.title.localeCompare(b.title)

export const coversDay = (item: CalendarItem, date: string): boolean =>
  item.startDate <= date && date <= item.endDate

/** The events of a day, in display order. */
export const itemsOnDay = <T extends CalendarItem>(items: T[], date: string): T[] =>
  items.filter((item) => coversDay(item, date)).sort(compareForDay)

/** For a multi-day event: which day of how many `date` is (`n/m日目`), else `null`. */
export const dayOfSpan = (item: CalendarItem, date: string): { n: number; m: number } | null =>
  item.startDate === item.endDate
    ? null
    : { n: daysBetween(item.startDate, date) + 1, m: daysBetween(item.startDate, item.endDate) + 1 }

/** The weeks shown for the month of `month`, each 7 dates from `weekStart` (0 = Sunday). */
export const monthWeeks = (month: string, weekStart: 0 | 1): string[][] => {
  const first = `${month.slice(0, 7)}-01`
  const last = addDaysToDate(addMonthsToDate(first, 1), -1)
  let day = addDaysToDate(first, -((weekdayOf(first) - weekStart + 7) % 7))
  const weeks: string[][] = []
  while (day <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDaysToDate(day, i)))
    day = addDaysToDate(day, 7)
  }
  return weeks
}

/** The 7 days centered on `date` (docs/spec.md "カレンダー（1週間表示）"). */
export const weekAround = (date: string): string[] =>
  Array.from({ length: 7 }, (_, i) => addDaysToDate(date, i - 3))

/** One day's piece of a month-view bar. */
export interface BarSegment<T extends CalendarItem = CalendarItem> {
  item: T
  lane: number
  /** The bar starts / ends on this day (rounded end, title shown at the start or a week's start). */
  isStart: boolean
  isEnd: boolean
  showTitle: boolean
}

/**
 * Bars of a week row: each event keeps one lane on every day of the week it covers, so a multi-day
 * event is one continuous bar. Lanes are filled in display order, all-day-like events first.
 */
export const layoutWeek = <T extends CalendarItem>(
  items: T[],
  week: string[],
): Map<string, BarSegment<T>[]> => {
  const first = week[0]
  const last = week[week.length - 1]
  const column = (date: string) => Math.max(0, Math.min(6, daysBetween(first, date)))
  const inWeek = items
    .filter((item) => item.startDate <= last && item.endDate >= first)
    .map((item) => ({ item, from: column(item.startDate), to: column(item.endDate) }))
    .sort(
      (a, b) =>
        Number(isAllDayLike(b.item)) - Number(isAllDayLike(a.item)) ||
        a.from - b.from ||
        b.to - b.from - (a.to - a.from) ||
        compareForDay(a.item, b.item),
    )

  const lanes: boolean[][] = []
  const result = new Map<string, BarSegment<T>[]>(week.map((date) => [date, []]))
  for (const { item, from, to } of inWeek) {
    let lane = lanes.findIndex((used) => used.slice(from, to + 1).every((taken) => !taken))
    if (lane === -1) lane = lanes.push(Array<boolean>(7).fill(false)) - 1
    for (let col = from; col <= to; col++) {
      lanes[lane][col] = true
      const date = week[col]
      result.get(date)?.push({
        item,
        lane,
        isStart: date === item.startDate,
        isEnd: date === item.endDate,
        showTitle: date === item.startDate || col === 0,
      })
    }
  }
  for (const segments of result.values()) segments.sort((a, b) => a.lane - b.lane)
  return result
}

/**
 * Which bars fit in a day cell of `maxLanes` lanes (docs/spec.md: what doesn't fit is "+N"). When
 * not all fit, the last lane shows "+N" instead.
 */
export const fitSegments = <T extends CalendarItem>(
  segments: BarSegment<T>[],
  maxLanes: number,
): { shown: BarSegment<T>[]; more: number } => {
  const limit = segments.length <= maxLanes ? maxLanes : Math.max(0, maxLanes - 1)
  const shown = segments.filter((segment) => segment.lane < limit)
  return { shown, more: segments.length - shown.length }
}

/** The time part of an event on one of its days: `終日`, `10:00 – 11:00`, `20:00 –`, `– 9:00`. */
export const timeOnDay = (
  item: Pick<CalendarItem, 'allDay' | 'startDate' | 'endDate' | 'startTime'> & {
    endTime: string | null
  },
  date: string,
): string => {
  if (item.allDay) return '終日'
  const starts = date === item.startDate
  const ends = date === item.endDate
  if (starts && ends) return `${item.startTime} – ${item.endTime}`
  if (starts) return `${item.startTime} –`
  if (ends) return `– ${item.endTime}`
  return '終日'
}
