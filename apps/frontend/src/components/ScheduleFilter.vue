<script setup lang="ts">
import type { Schedule } from '../api/types.ts'
import { scheduleColor } from '../lib/colors.ts'
import { useViewStateStore } from '../stores/view-state.ts'

// Schedule filter chips (docs/spec.md "カレンダー > 画面"): applied to the local data, no API call.
const props = defineProps<{ schedules: Schedule[] }>()
const viewState = useViewStateStore()

// A tap toggles one schedule; a long press shows it alone. Scrolling the chips cancels the press
// (`pointercancel`), and the click that ends a long press is skipped.
const LONG_PRESS_MS = 500
let timer: ReturnType<typeof setTimeout> | undefined
let longPressed = false

const press = (scheduleId: string) => {
  longPressed = false
  timer = setTimeout(() => {
    longPressed = true
    viewState.showOnlySchedule(
      scheduleId,
      props.schedules.map((schedule) => schedule.id),
    )
  }, LONG_PRESS_MS)
}
const release = () => clearTimeout(timer)
const tap = (scheduleId: string) => {
  if (!longPressed) viewState.toggleSchedule(scheduleId)
  longPressed = false
}
</script>

<template>
  <div class="filter">
    <button
      v-for="schedule in schedules"
      :key="schedule.id"
      type="button"
      class="filter__chip"
      :style="
        viewState.hiddenScheduleIds.includes(schedule.id)
          ? { borderColor: '#C4C6CF' }
          : { background: `${scheduleColor(schedule.color)}1F`, borderColor: 'transparent' }
      "
      @pointerdown="press(schedule.id)"
      @pointerup="release"
      @pointerleave="release"
      @pointercancel="release"
      @contextmenu.prevent
      @click="tap(schedule.id)"
    >
      <v-icon
        size="18"
        :color="scheduleColor(schedule.color)"
        :icon="
          !viewState.hiddenScheduleIds.includes(schedule.id)
            ? 'mdi-check'
            : schedule.scope === 'group'
              ? 'mdi-account-group'
              : 'mdi-account'
        "
      />
      {{ schedule.name }}
    </button>
  </div>
</template>

<style scoped>
.filter {
  display: flex;
  gap: 8px;
  padding: 2px 16px 4px;
  overflow-x: auto;
  scrollbar-width: none;
}

.filter__chip {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 12px 0 8px;
  border: 1px solid;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  /* No text selection or callout menu on a long press. */
  user-select: none;
  -webkit-touch-callout: none;
}
</style>
