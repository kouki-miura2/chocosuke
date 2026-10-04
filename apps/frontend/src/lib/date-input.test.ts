import { expect, test } from 'vite-plus/test'

import { fromPickerDate, toPickerDate } from './date-input.ts'

test('round-trips a date through the picker', () => {
  expect(fromPickerDate(toPickerDate('2026-10-05'))).toBe('2026-10-05')
  expect(fromPickerDate(toPickerDate('2028-02-29'))).toBe('2028-02-29')
})
