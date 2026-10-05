import { defineStore } from 'pinia'
import { ref } from 'vue'

/** `error`: something failed and can't go on (red); `info`: a plain notice, e.g. "copied". */
export type NotificationKind = 'error' | 'info'

/** Global UI state for a single app-wide snackbar. Not tied to any one API call or view. */
export const useNotificationStore = defineStore('notification', () => {
  const message = ref<string | null>(null)
  const kind = ref<NotificationKind>('error')
  const visible = ref(false)

  const show = (text: string, as: NotificationKind = 'error') => {
    message.value = text
    kind.value = as
    visible.value = true
  }

  const hide = () => {
    visible.value = false
  }

  return { message, kind, visible, show, hide }
})
