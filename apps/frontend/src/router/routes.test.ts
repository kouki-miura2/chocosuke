import { expect, test } from 'vite-plus/test'
import { createMemoryHistory, createRouter } from 'vue-router'

import { routes } from './routes.ts'

const router = createRouter({ history: createMemoryHistory(), routes })

test('resolves each screen', () => {
  expect(router.resolve('/').name).toBe('calendar')
  expect(router.resolve('/events/e1/edit').params).toEqual({ id: 'e1' })
  expect(router.resolve('/invite/abc').name).toBe('invite')
  expect(router.resolve('/settings').meta.nav).toBe(true)
})

test('leaves only the sign-in, consent and legal screens public', () => {
  const publicNames = routes.filter((route) => route.meta?.public).map((route) => route.name)

  expect(publicNames).toEqual(['login', 'consent', 'terms', 'privacy'])
})

test('sends an unknown path to the calendar', () => {
  expect(router.resolve('/does-not-exist').matched[0].redirect).toBe('/')
})
