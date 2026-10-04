import { MutationCache, QueryCache, QueryClient } from '@tanstack/vue-query'

import { ApiError } from './api/call.ts'

type ErrorHandler = (error: unknown, kind: 'query' | 'mutation') => void

let handleError: ErrorHandler = () => {}

/** Sets what every failed query and mutation does (`main.ts`: snackbar, or back to login). */
export const onApiError = (handler: ErrorHandler) => {
  handleError = handler
}

/** The app's one QueryClient, shared by components (via `VueQueryPlugin`) and the router guard. */
export const queryClient = new QueryClient({
  // A query with `meta: { quiet: true }` shows its error itself.
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (!query.meta?.quiet) handleError(error, 'query')
    },
  }),
  mutationCache: new MutationCache({ onError: (error) => handleError(error, 'mutation') }),
  defaultOptions: {
    // Without `retry: false`, TanStack Query's 3 retries with exponential backoff turn one
    // 3s-timeout request into ~20s before the error surfaces. A 4xx never gets better anyway.
    queries: { retry: false },
  },
})

/** Whether an error means the session is gone (or the terms need agreeing to again). */
export const isAuthError = (error: unknown): error is ApiError =>
  error instanceof ApiError && (error.code === 'UNAUTHORIZED' || error.code === 'CONSENT_REQUIRED')
