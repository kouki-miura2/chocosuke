<script setup lang="ts">
import { LIMITS } from 'utils'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { CalendarEntry } from '../composables/useAppData.ts'
import {
  type BarSegment,
  fitSegments,
  itemsOnDay,
  layoutWeek,
  monthWeeks,
} from '../lib/calendar.ts'
import { weekdayOf } from '../lib/format.ts'
import { holidayName } from '../lib/holidays.ts'

// Month view (docs/spec.md "カレンダー（月表示）"): Vuetify's `v-calendar` for the grid, with the
// bars/dots drawn in the `day` slot from `lib/calendar.ts`, fitted to the cell height.

const props = defineProps<{
  entries: CalendarEntry[]
  /** Any date in the month to show. */
  month: string
  today: string
  selected: string | null
  weekStart: 0 | 1
  monthStyle: 'bar' | 'dot'
}>()
const emit = defineEmits<{ selectDay: [date: string] }>()

const weekdays = computed(() =>
  props.weekStart === 1 ? [1, 2, 3, 4, 5, 6, 0] : [0, 1, 2, 3, 4, 5, 6],
)
const weeks = computed(() => monthWeeks(props.month, props.weekStart))

const segmentsByDate = computed(() => {
  const all = new Map<string, BarSegment<CalendarEntry>[]>()
  for (const week of weeks.value) {
    for (const [date, segments] of layoutWeek(props.entries, week)) all.set(date, segments)
  }
  return all
})

// How many bars fit: measured from the rendered cell height.
const BAR_HEIGHT = 17
const LABEL_HEIGHT = 40
const root = ref<HTMLElement | null>(null)
const cellHeight = ref(80)
let observer: ResizeObserver | undefined
onMounted(() => {
  observer = new ResizeObserver(() => {
    const cell = root.value?.querySelector('.v-calendar-weekly__day')
    if (cell) cellHeight.value = cell.clientHeight
  })
  if (root.value) observer.observe(root.value)
})
onBeforeUnmount(() => observer?.disconnect())
const maxLanes = computed(() =>
  Math.max(1, Math.floor((cellHeight.value - LABEL_HEIGHT) / BAR_HEIGHT)),
)

const dayColor = (date: string) => {
  if (date.slice(0, 7) !== props.month.slice(0, 7)) return 'rgba(0,0,0,.38)'
  const weekday = weekdayOf(date)
  if (weekday === 0 || holidayName(date)) return '#C62828'
  if (weekday === 6) return '#1F5FBF'
  return '#1B1C1E'
}

const weekdayLabel = (weekday: number) => ['日', '月', '火', '水', '木', '金', '土'][weekday]
</script>

<template>
  <div ref="root" class="month">
    <v-calendar
      type="month"
      :model-value="month"
      :now="today"
      :weekdays="weekdays"
      :weekday-format="(day: { weekday: number }) => weekdayLabel(day.weekday)"
      @click:day="(_: unknown, day: { date: string }) => emit('selectDay', day.date)"
    >
      <template #day-label="{ date, day }">
        <div class="month__label" @click.stop="emit('selectDay', date)">
          <span
            class="month__num"
            :class="{
              'month__num--today': date === today,
              'month__num--selected': date === selected,
            }"
            :style="date === today ? undefined : { color: dayColor(date) }"
            >{{ day }}</span
          >
          <span v-if="holidayName(date)" class="month__holiday">{{ holidayName(date) }}</span>
        </div>
      </template>
      <template #day="{ date }">
        <div class="month__events" @click.stop="emit('selectDay', date)">
          <template v-if="monthStyle === 'dot'">
            <div class="month__dots">
              <span
                v-for="entry in itemsOnDay(entries, date).slice(0, LIMITS.monthDotsPerDay)"
                :key="entry.id"
                class="month__dot"
                :style="{ background: entry.color }"
              />
            </div>
          </template>
          <template v-else>
            <template
              v-for="fit in [fitSegments(segmentsByDate.get(date) ?? [], maxLanes)]"
              :key="date"
            >
              <div
                v-for="segment in fit.shown"
                :key="segment.item.id"
                class="month__bar"
                :class="{
                  'month__bar--start': segment.isStart,
                  'month__bar--end': segment.isEnd,
                }"
                :style="{ top: `${segment.lane * BAR_HEIGHT}px`, background: segment.item.color }"
              >
                {{ segment.showTitle ? segment.item.title : '&nbsp;' }}
              </div>
              <div
                v-if="fit.more > 0"
                class="month__more"
                :style="{ top: `${(maxLanes - 1) * BAR_HEIGHT}px` }"
              >
                +{{ fit.more }}
              </div>
            </template>
          </template>
        </div>
      </template>
    </v-calendar>
  </div>
</template>

<style scoped>
.month {
  height: 100%;
  min-height: 0;
}

.month :deep(.v-calendar) {
  height: 100%;
}

.month :deep(.v-calendar-weekly__day) {
  cursor: pointer;
}

.month :deep(.v-calendar-weekly__day-label) {
  margin: 2px 0 0;
}

.month__label {
  display: flex;
  flex-direction: column;
  align-items: center;
  height: 36px;
  overflow: hidden;
}

.month__num {
  display: grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border-radius: 11px;
  font-size: 12px;
  font-weight: 500;
}

.month__num--today {
  background: rgb(var(--v-theme-primary));
  color: #fff;
}

.month__num--selected:not(.month__num--today) {
  outline: 2px solid rgb(var(--v-theme-primary));
}

.month__holiday {
  max-width: 100%;
  overflow: hidden;
  color: #c62828;
  font-size: 9px;
  line-height: 12px;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.month__events {
  position: absolute;
  inset: 40px 0 0;
}

.month__bar {
  position: absolute;
  left: 0;
  right: 0;
  height: 15px;
  padding: 0 3px;
  overflow: hidden;
  color: #fff;
  font-size: 10px;
  line-height: 15px;
  white-space: nowrap;
}

.month__bar--start {
  left: 2px;
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}

.month__bar--end {
  right: 2px;
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}

.month__more {
  position: absolute;
  left: 4px;
  color: #5b5f68;
  font-size: 10px;
  font-weight: 500;
  line-height: 15px;
}

.month__dots {
  display: flex;
  justify-content: center;
  gap: 3px;
  padding-top: 2px;
}

.month__dot {
  width: 6px;
  height: 6px;
  border-radius: 3px;
}
</style>
