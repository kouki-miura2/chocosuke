import { expect, test } from 'vite-plus/test'

import { fitWithin } from './image.ts'

test('scales the long edge down to the limit, never up', () => {
  expect(fitWithin(4032, 3024, 2048)).toEqual({ width: 2048, height: 1536 })
  expect(fitWithin(1000, 3000, 2048)).toEqual({ width: 683, height: 2048 })
  expect(fitWithin(800, 600, 2048)).toEqual({ width: 800, height: 600 })
})
