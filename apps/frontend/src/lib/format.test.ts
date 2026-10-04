import { expect, test } from 'vite-plus/test'

import {
  addMonthsToDate,
  formatEventTime,
  formatMd,
  formatYmdWeekday,
  today,
  weekdayOf,
} from './format.ts'

test('formats dates like the spec', () => {
  expect(formatYmdWeekday('2026-10-05')).toBe('2026/10/05（月）')
  expect(formatMd('2026-09-29')).toBe('9/29')
  expect(weekdayOf('2026-10-04')).toBe(0)
  expect(weekdayOf('1969-12-31')).toBe(3)
})

test('reads today in Japan time', () => {
  expect(today(new Date('2026-10-04T15:30:00Z'))).toBe('2026-10-05')
})

test('moves across months and years', () => {
  expect(addMonthsToDate('2026-12-15', 1)).toBe('2027-01-01')
  expect(addMonthsToDate('2026-01-31', -1)).toBe('2025-12-01')
})

test('formats an event time by kind', () => {
  const base = { startDate: '2026-10-05', endDate: '2026-10-05' }
  expect(formatEventTime({ ...base, allDay: false, startTime: '10:00', endTime: '11:00' })).toBe(
    '2026/10/05（月）10:00 – 11:00',
  )
  expect(
    formatEventTime({
      ...base,
      endDate: '2026-10-07',
      allDay: true,
      startTime: null,
      endTime: null,
    }),
  ).toBe('2026/10/05（月） – 2026/10/07（水）')
})
