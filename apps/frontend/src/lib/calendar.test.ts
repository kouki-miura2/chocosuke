import { expect, test } from 'vite-plus/test'

import {
  type CalendarItem,
  dayOfSpan,
  fitSegments,
  itemsOnDay,
  layoutWeek,
  monthWeeks,
  timeOnDay,
  weekAround,
} from './calendar.ts'

const item = (id: string, fields: Partial<CalendarItem> = {}): CalendarItem => ({
  id,
  title: id,
  allDay: false,
  startDate: '2026-10-05',
  startTime: '10:00',
  endDate: '2026-10-05',
  color: '#000',
  order: 0,
  ...fields,
})

test('orders a day: all-day and multi-day first, then by start time, then schedule order', () => {
  const items = [
    item('late', { startTime: '15:00' }),
    item('early-second-schedule', { startTime: '09:00', order: 1 }),
    item('early-first-schedule', { startTime: '09:00', order: 0 }),
    item('trip', { allDay: true, startDate: '2026-10-04', endDate: '2026-10-06', startTime: null }),
    item('timed-span', { startDate: '2026-10-05', endDate: '2026-10-06', startTime: '20:00' }),
    item('other-day', { startDate: '2026-10-07', endDate: '2026-10-07' }),
  ]

  expect(itemsOnDay(items, '2026-10-05').map((i) => i.id)).toEqual([
    'trip',
    'timed-span',
    'early-first-schedule',
    'early-second-schedule',
    'late',
  ])
})

test('numbers the days of a multi-day event', () => {
  const trip = item('trip', { startDate: '2026-10-07', endDate: '2026-10-09' })
  expect(dayOfSpan(trip, '2026-10-08')).toEqual({ n: 2, m: 3 })
  expect(dayOfSpan(item('one'), '2026-10-05')).toBeNull()
})

test('lays out the weeks of a month from the chosen first weekday', () => {
  const sunday = monthWeeks('2026-10-15', 0)
  expect(sunday[0][0]).toBe('2026-09-27')
  expect(sunday.at(-1)?.at(-1)).toBe('2026-10-31')
  expect(monthWeeks('2026-10-01', 1)[0][0]).toBe('2026-09-28')
})

test('centers the week view on the day', () => {
  expect(weekAround('2026-10-04')).toEqual([
    '2026-10-01',
    '2026-10-02',
    '2026-10-03',
    '2026-10-04',
    '2026-10-05',
    '2026-10-06',
    '2026-10-07',
  ])
})

test('keeps a multi-day bar in one lane across the week', () => {
  const week = monthWeeks('2026-10-01', 0)[1] // 10/4 (Sun) – 10/10 (Sat)
  const layout = layoutWeek(
    [
      item('meeting', { startDate: '2026-10-07', endDate: '2026-10-07' }),
      item('trip', {
        allDay: true,
        startDate: '2026-10-06',
        endDate: '2026-10-12',
        startTime: null,
      }),
    ],
    week,
  )

  expect(layout.get('2026-10-06')).toMatchObject([{ item: { id: 'trip' }, lane: 0, isStart: true }])
  expect(layout.get('2026-10-07')?.map((s) => [s.item.id, s.lane])).toEqual([
    ['trip', 0],
    ['meeting', 1],
  ])
  expect(layout.get('2026-10-10')).toMatchObject([{ lane: 0, isEnd: false, showTitle: false }])
})

test('shows "+N" in the last lane when not every bar fits', () => {
  const week = monthWeeks('2026-10-01', 0)[1]
  const day = '2026-10-05'
  const layout = layoutWeek(
    ['a', 'b', 'c', 'd'].map((id) => item(id, { startDate: day, endDate: day })),
    week,
  )
  const segments = layout.get(day) ?? []

  expect(fitSegments(segments, 4)).toMatchObject({ more: 0 })
  expect(fitSegments(segments, 3).shown.map((s) => s.item.id)).toEqual(['a', 'b'])
  expect(fitSegments(segments, 3).more).toBe(2)
})

test('shows the time of an event on each of its days', () => {
  const night = {
    allDay: false,
    startDate: '2026-10-05',
    endDate: '2026-10-07',
    startTime: '20:00',
    endTime: '09:00',
  }
  expect(timeOnDay(night, '2026-10-05')).toBe('20:00 –')
  expect(timeOnDay(night, '2026-10-06')).toBe('終日')
  expect(timeOnDay(night, '2026-10-07')).toBe('– 09:00')
  expect(timeOnDay({ ...night, endDate: '2026-10-05', endTime: '21:00' }, '2026-10-05')).toBe(
    '20:00 – 21:00',
  )
})
