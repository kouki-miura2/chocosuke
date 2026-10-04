import { queryOptions, useQuery } from '@tanstack/vue-query'

import { call } from '../api/call.ts'
import { apiClient } from '../api/client.ts'
import type { Me } from '../api/types.ts'

/**
 * The signed-in user (`GET /api/me`): `null` when signed out. Refetched only when invalidated
 * (sign-in, consent, sign-out), since the router guard reads it on every navigation.
 */
export const meQueryOptions = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<Me | null> => {
    const res = await apiClient.api.me.$get()
    if (res.status === 401) return null
    return call(res)
  },
  staleTime: Infinity,
})

export const useMeQuery = () => useQuery(meQueryOptions)
