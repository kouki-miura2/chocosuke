import { expect, test, vi } from 'vite-plus/test'

import { createGoogleVerifier } from './google.ts'

test('refuses every token without a client id, never checking it against Google', async () => {
  const fetchJwks = vi.fn(async () => Response.json({ keys: [] }))

  await expect(createGoogleVerifier('', fetchJwks).verify('any.id.token')).resolves.toBeNull()
  expect(fetchJwks).not.toHaveBeenCalled()
})
