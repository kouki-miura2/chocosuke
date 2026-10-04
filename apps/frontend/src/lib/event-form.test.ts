import { LIMITS } from 'utils'
import { expect, test } from 'vite-plus/test'

import type { CalendarEvent } from '../api/types.ts'
import {
  type EventForm,
  emptyEventForm,
  notifyOptions,
  shiftEndDate,
  toEventInput,
  validateEventForm,
} from './event-form.ts'

const now = new Date('2026-10-04T00:00:00Z')
const form = (fields: Partial<EventForm> = {}): EventForm => ({
  ...emptyEventForm('2026-10-05'),
  scheduleId: 's1',
  title: '打合せ',
  ...fields,
})
const event = (id: string, startDate: string, endDate = startDate) =>
  ({ id, scheduleId: 's1', startDate, endDate }) as CalendarEvent

test('accepts a valid form and builds the API input', () => {
  expect(validateEventForm(form({ memo: '  ' }), [], now)).toEqual([])
  expect(toEventInput(form({ allDay: true, memo: '  ', topicName: ' 会議 ' }))).toMatchObject({
    startTime: null,
    endTime: null,
    memo: null,
    topicName: '会議',
  })
})

test('rejects an end before the start, too many days and dates out of range', () => {
  expect(validateEventForm(form({ endTime: '09:00' }), [], now)).toContain(
    '終了は開始より後にしてください',
  )
  expect(validateEventForm(form({ endDate: '2026-11-30' }), [], now)).toContain(
    `イベントは${LIMITS.eventMaxDays}日までです`,
  )
  expect(validateEventForm(form({ startDate: '2020-12-31' }), [], now)).toContain(
    '登録できない日付です',
  )
})

test('counts a multi-day event on each day for the per-day limit, except the edited one', () => {
  const full = Array.from({ length: LIMITS.eventsPerDayPerSchedule }, (_, i) =>
    event(`e${i}`, '2026-10-04', '2026-10-06'),
  )

  expect(validateEventForm(form(), full, now)).toContain(
    `2026/10/05 のイベントが${LIMITS.eventsPerDayPerSchedule}件を超えます`,
  )
  expect(validateEventForm(form(), full, now, 'e0')).toEqual([])
})

test('offers the notifications of the event kind', () => {
  expect(notifyOptions(true).map((o) => o.title)).toEqual(['なし', '当日9:00', '前日9:00'])
  expect(validateEventForm(form({ allDay: true, notifyMinutes: 10 }), [], now)).toContain(
    '通知を選び直してください',
  )
})

test('keeps the length of the event when the start date moves', () => {
  expect(shiftEndDate(form({ startDate: '2026-10-10', endDate: '2026-10-07' }), '2026-10-05')).toBe(
    '2026-10-12',
  )
})
