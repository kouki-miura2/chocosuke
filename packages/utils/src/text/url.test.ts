import { expect, test } from 'vite-plus/test'

import { isHttpUrl } from './url.ts'

test('isHttpUrl accepts only absolute http(s) URLs', () => {
  expect(isHttpUrl('https://example.com/festival?year=2026')).toBe(true)
  expect(isHttpUrl('http://example.com')).toBe(true)
  expect(isHttpUrl('javascript:alert(1)')).toBe(false)
  expect(isHttpUrl('data:text/html,<p>x</p>')).toBe(false)
  expect(isHttpUrl('example.com')).toBe(false)
  expect(isHttpUrl('https://')).toBe(false)
})
