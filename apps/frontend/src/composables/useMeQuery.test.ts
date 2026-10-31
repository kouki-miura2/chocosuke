import { afterEach, expect, test, vi } from 'vite-plus/test'

import { ApiError } from '../api/call.ts'
import { queryClient } from '../query-client.ts'
import { meQueryOptions } from './useMeQuery.ts'

afterEach(() => {
  vi.unstubAllGlobals()
  queryClient.clear()
})

test('signed out is null, not an error', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(Response.json({ error: 'UNAUTHORIZED' }, { status: 401 }))),
  )

  await expect(queryClient.fetchQuery(meQueryOptions)).resolves.toBeNull()
})

test('no connection is a NETWORK error, which the app keeps quiet about', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new TypeError('Failed to fetch'))),
  )

  await expect(queryClient.fetchQuery(meQueryOptions)).rejects.toEqual(new ApiError('NETWORK', 0))
})
