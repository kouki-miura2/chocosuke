import { defineStore } from 'pinia'
import { ref } from 'vue'

import { today } from '../lib/format.ts'

/**
 * Where the calendar is (not saved): the date it shows and the selected day. A store so that the
 * calendar comes back to the same place after the event screens.
 */
export const useCalendarStore = defineStore('calendar', () => {
  /** The month view shows this date's month; the week view centers on it. */
  const anchor = ref(today())
  const selected = ref<string | null>(null)
  return { anchor, selected }
})
