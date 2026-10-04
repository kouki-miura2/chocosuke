import { createRouter, createWebHistory } from 'vue-router'

import { meQueryOptions } from '../composables/useMeQuery.ts'
import { queryClient } from '../query-client.ts'
import { routes } from './routes.ts'

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

// Signed out → login, terms revised → consent, then back to where the user was going (docs/spec.md
// "ログイン・同意 > 操作"; an invite link comes back to the join screen this way too). When `/me`
// can't be reached (offline), the screen opens anyway and shows the local DB.
router.beforeEach(async (to) => {
  if (to.meta.public) return true
  const me = await queryClient.fetchQuery(meQueryOptions).catch(() => undefined)
  if (me === null) return { name: 'login', query: { redirect: to.fullPath } }
  if (me?.needsConsent) return { name: 'consent', query: { redirect: to.fullPath } }
  return true
})
