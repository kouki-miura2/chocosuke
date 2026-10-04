<script setup lang="ts">
import { computed } from 'vue'

import type { CalendarEntry } from '../composables/useAppData.ts'
import { dayOfSpan, itemsOnDay, timeOnDay } from '../lib/calendar.ts'

// The events of one day (week view rows, the month view's day sheet, the tablet side panel).
const props = defineProps<{ entries: CalendarEntry[]; date: string }>()
const emit = defineEmits<{ open: [eventId: string] }>()

const items = computed(() => itemsOnDay(props.entries, props.date))
</script>

<template>
  <div v-if="items.length === 0" class="day-list__empty">予定なし</div>
  <div
    v-for="entry in items"
    :key="entry.id"
    v-ripple
    class="day-list__item"
    :style="{ background: `${entry.color}17` }"
    @click="emit('open', entry.id)"
  >
    <span class="day-list__dot" :style="{ background: entry.color }" />
    <div class="day-list__main">
      <div class="day-list__title">
        {{ entry.title }}
        <v-icon v-if="entry.hasImages" icon="mdi-paperclip" size="14" />
      </div>
      <div class="day-list__time">
        {{ timeOnDay(entry, date) }}
        <template v-if="dayOfSpan(entry, date)">
          （{{ dayOfSpan(entry, date)?.n }}/{{ dayOfSpan(entry, date)?.m }}日目）
        </template>
      </div>
    </div>
    <span class="day-list__meta">
      <v-icon :icon="entry.scope === 'group' ? 'mdi-account-group' : 'mdi-lock'" size="14" />
      {{ entry.topicName }}
    </span>
  </div>
</template>

<style scoped>
.day-list__empty {
  padding: 8px 0;
  color: #8a8d95;
  font-size: 13px;
}

.day-list__item {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 4px 0;
  padding: 8px 10px;
  border-radius: 8px;
  cursor: pointer;
}

.day-list__dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 4px;
}

.day-list__main {
  flex: 1;
  min-width: 0;
}

.day-list__title {
  overflow: hidden;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.day-list__time {
  color: #44474e;
  font-size: 12px;
}

.day-list__meta {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 2px;
  color: #44474e;
  font-size: 11px;
}
</style>
