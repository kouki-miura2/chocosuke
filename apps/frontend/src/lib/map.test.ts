import { expect, test } from 'vite-plus/test'

import { mapEmbedUrl, mapLinkUrl } from './map.ts'

test('builds keyless Google Maps URLs with the location encoded', () => {
  expect(mapEmbedUrl('札幌駅')).toBe(
    'https://www.google.com/maps?q=%E6%9C%AD%E5%B9%8C%E9%A7%85&output=embed',
  )
  expect(mapLinkUrl('43.0687,141.3508')).toBe(
    'https://www.google.com/maps/search/?api=1&query=43.0687%2C141.3508',
  )
})
