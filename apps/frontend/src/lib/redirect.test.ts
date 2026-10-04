import { expect, test } from 'vite-plus/test'

import { redirectTarget } from './redirect.ts'

test('returns only in-app paths', () => {
  expect(redirectTarget({ redirect: '/invite/abc' })).toBe('/invite/abc')
  expect(redirectTarget({ redirect: '//evil.example' })).toBe('/')
  expect(redirectTarget({ redirect: 'https://evil.example' })).toBe('/')
  expect(redirectTarget({})).toBe('/')
})
