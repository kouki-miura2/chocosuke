import { expect, test } from 'vite-plus/test'

import { installGuideFor } from './install.ts'

test('tells iPhone and iPad (also when it reports a Mac) from other devices', () => {
  const iphone = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15'
  const mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15'
  const android = 'Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/140.0'

  expect(installGuideFor(iphone, 5)).toBe('ios')
  expect(installGuideFor(mac, 5)).toBe('ios') // iPadOS Safari
  expect(installGuideFor(mac, 0)).toBe('other') // a real Mac
  expect(installGuideFor(android, 5)).toBe('other')
})
