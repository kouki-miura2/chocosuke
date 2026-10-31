import { queryOptions, useQuery } from '@tanstack/vue-query'

import { ApiError, call } from '../api/call.ts'
import { apiClient } from '../api/client.ts'
import type { Me } from '../api/types.ts'

/**
 * The signed-in user (`GET /api/me`): `null` when signed out. Refetched only when invalidated
 * (sign-in, consent, sign-out), since the router guard reads it on every navigation.
 */
export const meQueryOptions = queryOptions({
  queryKey: ['me'],
  queryFn: async (): Promise<Me | null> => {
    try {
      return await call(apiClient.api.me.$get())
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) return null
      throw error
    }
  },
  staleTime: Infinity,
})

export const useMeQuery = () => useQuery(meQueryOptions)
