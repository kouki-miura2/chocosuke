import { expect, test } from 'vite-plus/test'

import {
  addDaysToDate,
  daysBetween,
  isDateString,
  isTimeString,
  selectableDateRange,
  toInstant,
} from './day.ts'

// All expectations assume the default app time zone, JST (UTC+9).

test('isDateString accepts only existing dates in YYYY-MM-DD form', () => {
  expect(isDateString('2028-02-29')).toBe(true)
  expect(isDateString('2026-02-29')).toBe(false)
  expect(isDateString('2026-2-1')).toBe(false)
  expect(isDateString('2026-13-01')).toBe(false)
})

test('isTimeString accepts 00:00 to 23:59', () => {
  expect(isTimeString('00:00')).toBe(true)
  expect(isTimeString('23:59')).toBe(true)
  expect(isTimeString('24:00')).toBe(false)
  expect(isTimeString('9:00')).toBe(false)
})

test('toInstant reads the date and time in the app time zone', () => {
  expect(toInstant('2026-10-05', '10:00').toISOString()).toBe('2026-10-05T01:00:00.000Z')
  expect(toInstant('2026-10-05').toISOString()).toBe('2026-10-04T15:00:00.000Z')
})

test('addDaysToDate and daysBetween work across months and years', () => {
  expect(addDaysToDate('2026-12-31', 1)).toBe('2027-01-01')
  expect(addDaysToDate('2026-03-01', -1)).toBe('2026-02-28')
  expect(daysBetween('2026-10-29', '2026-11-01')).toBe(3)
  expect(daysBetween('2026-11-01', '2026-10-29')).toBe(-3)
})

test('selectableDateRange runs from 2021 to the end of the year three years ahead (JST)', () => {
  // 2026-12-31T15:00Z is 2027-01-01 00:00 JST, so the current year has already moved on.
  expect(selectableDateRange(new Date('2026-12-31T14:59:59Z'))).toEqual({
    min: '2021-01-01',
    max: '2029-12-31',
  })
  expect(selectableDateRange(new Date('2026-12-31T15:00:00Z')).max).toBe('2030-12-31')
})
