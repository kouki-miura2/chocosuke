import { VueQueryPlugin } from '@tanstack/vue-query'
import { createPinia } from 'pinia'
import { createApp } from 'vue'

import { errorMessage } from './api/call.ts'
import App from './App.vue'
import { listenForInstallPrompt } from './composables/usePwaInstall.ts'
import { seedFromLocalDb } from './composables/useSyncQuery.ts'
import { vuetify } from './plugins/vuetify.ts'
import { isAuthError, onApiError, queryClient } from './query-client.ts'
import { router } from './router/index.ts'
import { useNotificationStore } from './stores/notification.ts'
import { useViewStateStore } from './stores/view-state.ts'

const pinia = createPinia()
const app = createApp(App).use(pinia).use(router).use(vuetify).use(VueQueryPlugin, { queryClient })

// Every API error ends up here (docs/spec.md "共通ルール > 画面": a snackbar). A lost session goes
// back to the login screen, revised terms to the consent screen; a background sync that can't reach
// the server stays quiet, since the local DB is still shown.
onApiError((error, kind) => {
  if (isAuthError(error)) {
    const redirect = router.currentRoute.value.fullPath
    if (router.currentRoute.value.meta.public) return
    if (error.code === 'UNAUTHORIZED') queryClient.removeQueries({ queryKey: ['sync'] })
    void queryClient.invalidateQueries({ queryKey: ['me'] })
    void router.replace({
      name: error.code === 'UNAUTHORIZED' ? 'login' : 'consent',
      query: { redirect },
    })
    return
  }
  if (kind === 'query' && error instanceof Error && error.message === 'NETWORK') return
  useNotificationStore(pinia).show(errorMessage(error))
})

// The install prompt can come before any screen asks for it ('設定 > アプリをインストール').
listenForInstallPrompt()

// The local DB first (view state, then the last synced data shown before the first sync returns).
void Promise.all([useViewStateStore(pinia).load(), seedFromLocalDb()])
  .catch(() => {})
  .finally(() => app.mount('#app'))
