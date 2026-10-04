import { expect, test } from 'vite-plus/test'

import { isOnTimeStep } from './time.ts'

test('isOnTimeStep accepts only 10-minute steps', () => {
  expect(isOnTimeStep('00:00')).toBe(true)
  expect(isOnTimeStep('10:30')).toBe(true)
  expect(isOnTimeStep('23:50')).toBe(true)
  expect(isOnTimeStep('10:05')).toBe(false)
  expect(isOnTimeStep('10:03')).toBe(false)
})
