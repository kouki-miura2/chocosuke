import { onlineManager } from '@tanstack/vue-query'
import { afterEach, expect, test, vi } from 'vite-plus/test'

import { queryClient } from './query-client.ts'

afterEach(() => {
  onlineManager.setOnline(true)
})

test('offline, a change fails at once rather than waiting to be sent on reconnect', async () => {
  onlineManager.setOnline(false)
  const mutationFn = vi.fn(() => Promise.reject(new Error('NETWORK')))

  const mutation = queryClient.getMutationCache().build(queryClient, { mutationFn })

  await expect(mutation.execute(undefined)).rejects.toThrow('NETWORK')
  onlineManager.setOnline(true)
  expect(mutationFn).toHaveBeenCalledTimes(1)
})

test('offline, a query fails at once rather than pausing', async () => {
  onlineManager.setOnline(false)

  await expect(
    queryClient.fetchQuery({
      queryKey: ['offline-test'],
      queryFn: () => Promise.reject(new Error('NETWORK')),
    }),
  ).rejects.toThrow('NETWORK')
})
