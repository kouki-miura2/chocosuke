import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { TERMS_VERSION } from 'utils'

import { call } from '../api/call.ts'
import { apiClient } from '../api/client.ts'
import { clearAll, localDb } from '../db/local-db.ts'
import { useAuthStore } from '../stores/auth.ts'
import { useViewStateStore } from '../stores/view-state.ts'

/**
 * Sign-in, consent and sign-out (root AGENTS.md "Sign in with Google and terms consent"): Google
 * sign-in first; an unregistered account keeps its ID token until the consent screen registers it.
 */
export const useAuth = () => {
  const queryClient = useQueryClient()
  const auth = useAuthStore()
  const refreshMe = () => queryClient.invalidateQueries({ queryKey: ['me'] })

  /** Resolves to where to go next: the consent screen, or `null` to go on. */
  const signIn = useMutation({
    mutationFn: async (credential: string) => {
      const result = await call(apiClient.api.auth.google.$post({ json: { credential } }))
      if (!result.registered) {
        auth.pendingCredential = credential
        return 'consent' as const
      }
      await refreshMe()
      return result.needsConsent ? ('consent' as const) : null
    },
  })

  /** Agrees to the current terms: registers a new account, or re-agrees after a revision. */
  const agree = useMutation({
    mutationFn: async () => {
      const credential = auth.pendingCredential
      if (credential) {
        await call(
          apiClient.api.auth.register.$post({ json: { credential, termsVersion: TERMS_VERSION } }),
        )
        auth.pendingCredential = null
      } else {
        await call(apiClient.api.auth.consent.$post())
      }
      await refreshMe()
    },
  })

  /** Signs out, keeping the local DB for the next sign-in but no longer showing it. */
  const signOut = useMutation({
    mutationFn: async () => {
      await call(apiClient.api.auth.logout.$post())
      queryClient.clear()
    },
  })

  return { signIn, agree, signOut }
}

/** Erases everything this device holds of the app (local DB, view state, in-memory data). */
export const useEraseLocalData = () => {
  const queryClient = useQueryClient()
  const viewState = useViewStateStore()
  return async () => {
    await clearAll(await localDb())
    viewState.reset()
    queryClient.clear()
  }
}
