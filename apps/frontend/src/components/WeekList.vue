<script setup lang="ts">
import { computed } from 'vue'

import type { CalendarEntry } from '../composables/useAppData.ts'
import { weekAround } from '../lib/calendar.ts'
import { WEEKDAYS, weekdayOf } from '../lib/format.ts'
import { holidayName } from '../lib/holidays.ts'
import DayEventList from './DayEventList.vue'

// Week view (docs/spec.md "カレンダー（1週間表示）"): 7 days centered on `center`, a list per day.
const props = defineProps<{ entries: CalendarEntry[]; center: string; today: string }>()
const emit = defineEmits<{ open: [eventId: string]; selectDay: [date: string] }>()

const days = computed(() => weekAround(props.center))

const dayColor = (date: string) => {
  const weekday = weekdayOf(date)
  if (weekday === 0 || holidayName(date)) return '#C62828'
  if (weekday === 6) return '#1F5FBF'
  return '#1B1C1E'
}
</script>

<template>
  <v-list class="week" lines="one">
    <div
      v-for="date in days"
      :key="date"
      class="week__day"
      :class="{ 'week__day--today': date === today }"
      @click="emit('selectDay', date)"
    >
      <div class="week__date">
        <div
          class="week__num"
          :style="date === today ? undefined : { color: dayColor(date) }"
          :class="{ 'week__num--today': date === today }"
        >
          {{ Number(date.slice(8)) }}
        </div>
        <div class="week__weekday" :style="{ color: dayColor(date) }">
          {{ WEEKDAYS[weekdayOf(date)] }}
        </div>
      </div>
      <div class="week__events">
        <div v-if="holidayName(date)" class="week__holiday">{{ holidayName(date) }}</div>
        <DayEventList :entries="entries" :date="date" @open="(id) => emit('open', id)" />
      </div>
    </div>
  </v-list>
</template>

<style scoped>
.week {
  padding: 0;
}

.week__day {
  display: flex;
  gap: 12px;
  padding: 8px 16px;
  border-bottom: 1px solid #e3e5ea;
}

.week__day--today {
  background: #f2f6fc;
}

.week__date {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 40px;
  flex-shrink: 0;
}

.week__num {
  display: grid;
  place-items: center;
  width: 36px;
  height: 36px;
  border-radius: 18px;
  font-size: 18px;
  font-weight: 700;
}

.week__num--today {
  background: rgb(var(--v-theme-primary));
  color: #fff;
}

.week__weekday {
  font-size: 12px;
  font-weight: 500;
}

.week__events {
  flex: 1;
  min-width: 0;
}

.week__holiday {
  color: #c62828;
  font-size: 12px;
  font-weight: 500;
}
</style>
