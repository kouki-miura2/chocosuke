import { expect, test } from 'vite-plus/test'

import { holidayName } from './holidays.ts'

test('knows holidays and substitute holidays', () => {
  expect(holidayName('2026-10-12')).toBe('スポーツの日')
  expect(holidayName('2026-09-22')).toBe('休日')
  expect(holidayName('2026-10-13')).toBeUndefined()
})
