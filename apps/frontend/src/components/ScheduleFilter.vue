<script setup lang="ts">
import type { Schedule } from '../api/types.ts'
import { scheduleColor } from '../lib/colors.ts'
import { useViewStateStore } from '../stores/view-state.ts'

// Schedule filter chips (docs/spec.md "カレンダー > 画面"): applied to the local data, no API call.
defineProps<{ schedules: Schedule[] }>()
const viewState = useViewStateStore()
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
      @click="viewState.toggleSchedule(schedule.id)"
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
  padding: 4px 16px 8px;
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
}
</style>
