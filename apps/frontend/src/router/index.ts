import { createRouter, createWebHistory } from 'vue-router'

import { meQueryOptions } from '../composables/useMeQuery.ts'
import { syncQueryOptions } from '../composables/useSyncQuery.ts'
import { queryClient } from '../query-client.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Signed out → login, terms revised → consent, then back to where the user was going (docs/spec.md
// "ログイン・同意 > 操作"; an invite link comes back to the join screen this way too). When `/me`
// can't be reached (offline), the screen opens anyway if there's a local DB to show.
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const me = await queryClient.fetchQuery(meQueryOptions).catch(() => undefined)
  const signedOut =
    me === null || (me === undefined && !queryClient.getQueryData(syncQueryOptions.queryKey))
  if (signedOut) return { name: 'login', query: { redirect: to.fullPath } }
  if (me?.needsConsent) return { name: 'consent', query: { redirect: to.fullPath } }
  return true
})
