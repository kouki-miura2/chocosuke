import { defineStore } from 'pinia'
import { reactive, toRefs, watch } from 'vue'

import { type LocalDb, localDb } from '../db/local-db.ts'

/** Per-device view state (docs/spec.md "カレンダー > 状態"), kept in the local DB (`kv` key `viewState`). */
export interface ViewState {
  viewMode: 'month' | 'week'
  /** Hidden schedules: a new schedule is shown until hidden (docs/spec.md "新しく追加された予定は…"). */
  hiddenScheduleIds: string[]
  monthStyle: 'bar' | 'dot'
  /** 0 = Sunday, 1 = Monday. */
  weekStart: 0 | 1
}

export const defaultViewState = (): ViewState => ({
  viewMode: 'month',
  hiddenScheduleIds: [],
  monthStyle: 'bar',
  weekStart: 0,
})

export const useViewStateStore = defineStore('viewState', () => {
  const state = reactive(defaultViewState())

  /** Reads the saved state, then saves every change. Called once at startup. */
  const load = async (db: LocalDb | Promise<LocalDb> = localDb()) => {
    const store = await db
    Object.assign(state, defaultViewState(), (await store.get('kv', 'viewState')) ?? {})
    watch(
      state,
      () => void store.put('kv', JSON.parse(JSON.stringify(state)) as ViewState, 'viewState'),
      {
        deep: true,
      },
    )
  }

  /** Back to the defaults, e.g. after the local DB was erased. */
  const reset = () => Object.assign(state, defaultViewState())

  const toggleSchedule = (scheduleId: string) => {
    state.hiddenScheduleIds = state.hiddenScheduleIds.includes(scheduleId)
      ? state.hiddenScheduleIds.filter((id) => id !== scheduleId)
      : [...state.hiddenScheduleIds, scheduleId]
  }

  /** Shows `scheduleId` alone, hiding the rest of `allIds` (a long press on a filter chip). */
  const showOnlySchedule = (scheduleId: string, allIds: string[]) => {
    state.hiddenScheduleIds = allIds.filter((id) => id !== scheduleId)
  }

  return { ...toRefs(state), load, reset, toggleSchedule, showOnlySchedule }
})
