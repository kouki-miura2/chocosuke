import { expect, test } from 'vite-plus/test'

import { isNotifyMinutes, notifyAt } from './notify.ts'

test('isNotifyMinutes allows only the choices for the event kind', () => {
  expect(isNotifyMinutes(10, false)).toBe(true)
  expect(isNotifyMinutes(-540, false)).toBe(false)
  expect(isNotifyMinutes(-540, true)).toBe(true)
  expect(isNotifyMinutes(10, true)).toBe(false)
})

test('notifyAt counts back from the start in JST', () => {
  // 2026-10-05 10:00 JST minus 10 minutes = 2026-10-05T00:50Z.
  expect(notifyAt('2026-10-05', '10:00', 10)).toBe(Date.parse('2026-10-05T00:50:00Z'))
  // All-day, 9:00 that day.
  expect(notifyAt('2026-10-05', null, -540)).toBe(Date.parse('2026-10-05T00:00:00Z'))
  // All-day, 9:00 the day before.
  expect(notifyAt('2026-10-05', null, 900)).toBe(Date.parse('2026-10-04T00:00:00Z'))
  expect(notifyAt('2026-10-05', '10:00', null)).toBeNull()
})
