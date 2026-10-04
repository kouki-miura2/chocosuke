import { expect, test } from 'vite-plus/test'

import type { Schedule } from '../api/types.ts'
import { moveId, orderSchedules } from './schedules.ts'

const schedule = (id: string, createdAt: number) => ({ id, createdAt }) as Schedule

test('orders by the saved order, then the rest by creation time', () => {
  const ordered = orderSchedules(
    [
      schedule('a', 1),
      schedule('b', 2),
      schedule('new2', 9),
      schedule('new1', 5),
      schedule('c', 3),
    ],
    ['c', 'a', 'gone', 'b'],
  )

  expect(ordered.map((s) => s.id)).toEqual(['c', 'a', 'b', 'new1', 'new2'])
})

test('moves an id within the order', () => {
  expect(moveId(['a', 'b', 'c'], 0, 2)).toEqual(['b', 'c', 'a'])
})
