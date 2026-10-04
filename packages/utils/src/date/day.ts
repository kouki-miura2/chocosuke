import { LIMITS } from '../limits/limits.ts'
import { formatDate } from './format.ts'
import { fromWallClock } from './zone.ts'

// Helpers for calendar dates and times of day as stored in the DB and sent over the API:
// `YYYY-MM-DD` and `HH:mm`, both read in the app's time zone (`TIME_ZONE_OFFSET_MINUTES`).

const msPerDay = 24 * 60 * 60 * 1000
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/

const toUtcDay = (date: string): Date => {
  const [, year, month, day] = datePattern.exec(date) ?? []
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)))
}

const fromUtcDay = (day: Date): string => day.toISOString().slice(0, 10)

/** Whether `value` is an existing calendar date in `YYYY-MM-DD` form (rejects e.g. `2026-02-30`). */
export const isDateString = (value: string): boolean =>
  datePattern.test(value) && fromUtcDay(toUtcDay(value)) === value

/** Whether `value` is a time of day in `HH:mm` form (`00:00`–`23:59`). */
export const isTimeString = (value: string): boolean => timePattern.test(value)

/** The instant at which the app time zone's wall clock shows `date` `time` (default `00:00`). */
export const toInstant = (date: string, time = '00:00'): Date => {
  const [, hours, minutes] = timePattern.exec(time) ?? []
  return fromWallClock(
    new Date(toUtcDay(date).getTime() + (Number(hours) * 60 + Number(minutes)) * 60 * 1000),
  )
}

/** `date` moved by `days` calendar days. */
export const addDaysToDate = (date: string, days: number): string =>
  fromUtcDay(new Date(toUtcDay(date).getTime() + days * msPerDay))

/** Number of calendar days from `from` to `to` (`0` on the same day, negative if `to` is earlier). */
export const daysBetween = (from: string, to: string): number =>
  Math.round((toUtcDay(to).getTime() - toUtcDay(from).getTime()) / msPerDay)

/**
 * First and last date that can be shown or registered at `now` (`docs/spec.md` "対象外"): from
 * Jan 1 of `LIMITS.calendarMinYear` to Dec 31 of the current year plus `LIMITS.calendarYearsAhead`.
 */
export const selectableDateRange = (now: Date): { min: string; max: string } => ({
  min: `${LIMITS.calendarMinYear}-01-01`,
  max: `${Number(formatDate(now, 'yyyy')) + LIMITS.calendarYearsAhead}-12-31`,
})
