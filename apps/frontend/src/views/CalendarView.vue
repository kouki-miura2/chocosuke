<script setup lang="ts">
import { addDaysToDate, selectableDateRange } from 'utils'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'

import DayEventList from '../components/DayEventList.vue'
import EventDetailSheet from '../components/EventDetailSheet.vue'
import MonthCalendar from '../components/MonthCalendar.vue'
import ScheduleFilter from '../components/ScheduleFilter.vue'
import WeekList from '../components/WeekList.vue'
import YearMonthDialog from '../components/YearMonthDialog.vue'
import { useAppData } from '../composables/useAppData.ts'
import { itemsOnDay, weekAround } from '../lib/calendar.ts'
import {
  WEEKDAYS,
  addMonthsToDate,
  formatMd,
  formatYearMonth,
  formatYmdWeekday,
  today as todayOf,
  weekdayOf,
} from '../lib/format.ts'
import { useCalendarStore } from '../stores/calendar.ts'
import { useViewStateStore } from '../stores/view-state.ts'

// The calendar (docs/spec.md "カレンダー"): month or week view of the local data, the schedule
// filter, and the event detail (`?event=<id>`).
const route = useRoute()
const router = useRouter()
const app = useAppData()
const viewState = useViewStateStore()
const cursor = useCalendarStore()
const { width, height } = useDisplay()

const today = todayOf()
const range = selectableDateRange(new Date())

const entries = computed(() =>
  app.calendarEntries.value.filter(
    (entry) => !viewState.hiddenScheduleIds.includes(entry.scheduleId),
  ),
)

// Month view: `2026年10月`; week view: the days shown, `10/1（木）– 10/7（水）`.
const mdWeekday = (date: string) => `${formatMd(date)}（${WEEKDAYS[weekdayOf(date)]}）`
const title = computed(() => {
  if (viewState.viewMode === 'month') return formatYearMonth(cursor.anchor)
  const days = weekAround(cursor.anchor)
  return `${mdWeekday(days[0])}– ${mdWeekday(days[6])}`
})

// Month view: a month at a time; week view: 7 days. Never past the dates that can be shown.
const moved = (direction: 1 | -1) =>
  viewState.viewMode === 'month'
    ? addMonthsToDate(cursor.anchor, direction)
    : addDaysToDate(cursor.anchor, direction * 7)
const canStep = (direction: 1 | -1) => {
  const next = moved(direction)
  if (viewState.viewMode === 'month') return next >= range.min && next <= range.max
  const days = weekAround(next)
  return days[6] >= range.min && days[0] <= range.max
}
const step = (direction: 1 | -1) => {
  if (canStep(direction)) cursor.anchor = moved(direction)
}
// Swipes (docs/spec.md "カレンダー > 画面"): month view left/right, week view up/down, through
// `step` so never past the dates that can be shown. The week list scrolls vertically, so a swipe
// only changes the week once the list is at that end (top for back, bottom for forward).
const main = ref<HTMLElement | null>(null)
const swipe = (direction: 1 | -1) => {
  if (viewState.viewMode === 'month') step(direction)
}
const swipeUp = () => {
  const el = main.value
  if (
    viewState.viewMode === 'week' &&
    el &&
    el.scrollTop + el.clientHeight >= el.scrollHeight - 1
  ) {
    step(1)
  }
}
const swipeDown = () => {
  if (viewState.viewMode === 'week' && (main.value?.scrollTop ?? 0) <= 0) step(-1)
}

// The new month/week slides in from the side it comes from; switching month/week doesn't slide.
const direction = ref<1 | -1 | 0>(0)
watch(
  () => cursor.anchor,
  (next, previous) => {
    direction.value = next > previous ? 1 : -1
    // A new page starts at its top, not where the previous one was scrolled to.
    main.value?.scrollTo({ top: 0 })
  },
)
watch(
  () => viewState.viewMode,
  () => (direction.value = 0),
)
const slideName = computed(() => {
  if (direction.value === 0) return 'none'
  if (viewState.viewMode === 'month') return direction.value > 0 ? 'slide-next' : 'slide-prev'
  return direction.value > 0 ? 'slide-up' : 'slide-down'
})

const goToday = () => {
  cursor.anchor = today
  cursor.selected = null
}

// The selected day (today until another is picked) and its events after the schedule filter.
const selectedDate = computed(() => cursor.selected ?? today)
const selectedSummary = computed(() => {
  const date = selectedDate.value
  const count = itemsOnDay(entries.value, date).length
  return `${formatMd(date)}(${WEEKDAYS[weekdayOf(date)]}) : ${count} 件`
})
// 今日 is off while today is both selected and on screen, so the button also tells which is shown.
const showingToday = computed(
  () =>
    selectedDate.value === today &&
    (viewState.viewMode === 'month'
      ? cursor.anchor.slice(0, 7) === today.slice(0, 7)
      : weekAround(cursor.anchor).includes(today)),
)

const viewModes = [
  { value: 'month', label: '月' },
  { value: 'week', label: '週' },
] as const

const pickingMonth = ref(false)
const pickMonth = (month: string) => {
  // Month view: that month; week view: the week centered on its first day.
  cursor.anchor = month
}

// The day sheet (phone) or the side panel (tablet in landscape) lists the selected day.
const sidePanel = computed(() => width.value >= 600 && width.value > height.value)
const daySheet = ref(false)
const selectDay = (date: string) => {
  cursor.selected = date
  if (!sidePanel.value && viewState.viewMode === 'month') daySheet.value = true
}

const openEvent = (id: string) => {
  daySheet.value = false
  void router.push({ query: { ...route.query, event: id } })
}
const closeEvent = () => {
  const query = { ...route.query }
  delete query.event
  void router.replace({ query })
}
const eventId = computed(() => (typeof route.query.event === 'string' ? route.query.event : null))

const addEvent = () => router.push({ name: 'event-new', query: { date: cursor.selected ?? today } })
</script>

<template>
  <div class="calendar">
    <header class="calendar__header">
      <v-btn
        variant="text"
        :append-icon="viewState.viewMode === 'month' ? 'mdi-menu-down' : undefined"
        class="calendar__title"
        :class="{ 'calendar__title--week': viewState.viewMode === 'week' }"
        @click="pickingMonth = true"
      >
        <span class="calendar__title-text">{{ title }}</span>
      </v-btn>
      <v-spacer />
      <v-btn
        icon="mdi-chevron-left"
        variant="text"
        size="40"
        aria-label="前へ"
        :disabled="!canStep(-1)"
        @click="step(-1)"
      />
      <v-btn
        icon="mdi-chevron-right"
        variant="text"
        size="40"
        aria-label="次へ"
        :disabled="!canStep(1)"
        @click="step(1)"
      />
      <v-btn
        variant="outlined"
        size="small"
        rounded="lg"
        class="calendar__today"
        text="今日"
        :disabled="showingToday"
        @click="goToday"
      />
    </header>
    <div class="calendar__bar">
      <span class="calendar__summary">{{ selectedSummary }}</span>
      <v-btn-toggle v-model="viewState.viewMode" mandatory class="calendar__mode">
        <v-btn
          v-for="mode in viewModes"
          :key="mode.value"
          :value="mode.value"
          :text="mode.label"
          :prepend-icon="viewState.viewMode === mode.value ? 'mdi-check' : undefined"
        />
      </v-btn-toggle>
    </div>
    <ScheduleFilter :schedules="app.schedules.value" />

    <div class="calendar__body">
      <div
        ref="main"
        v-touch="{ left: () => swipe(1), right: () => swipe(-1), up: swipeUp, down: swipeDown }"
        class="calendar__main"
      >
        <transition :name="slideName">
          <MonthCalendar
            v-if="viewState.viewMode === 'month'"
            :key="cursor.anchor.slice(0, 7)"
            :entries="entries"
            :month="cursor.anchor"
            :today="today"
            :selected="cursor.selected"
            :week-start="viewState.weekStart"
            :month-style="viewState.monthStyle"
            @select-day="selectDay"
          />
          <WeekList
            v-else
            :key="cursor.anchor"
            :entries="entries"
            :center="cursor.anchor"
            :today="today"
            @open="openEvent"
            @select-day="(date) => (cursor.selected = date)"
          />
        </transition>
      </div>
      <aside v-if="sidePanel" class="calendar__side">
        <h3 class="calendar__side-title">{{ formatYmdWeekday(cursor.selected ?? today) }}</h3>
        <DayEventList :entries="entries" :date="cursor.selected ?? today" @open="openEvent" />
      </aside>
    </div>

    <v-btn
      class="calendar__fab"
      icon="mdi-plus"
      color="primary-container"
      size="44"
      rounded="lg"
      elevation="4"
      aria-label="イベントを登録"
      @click="addEvent"
    />

    <v-bottom-sheet v-model="daySheet">
      <v-card :title="cursor.selected ? formatYmdWeekday(cursor.selected) : ''">
        <!-- Straight from the picked day to a new event on it, without closing the sheet first. -->
        <template #append>
          <v-btn
            variant="tonal"
            color="primary"
            size="small"
            prepend-icon="mdi-plus"
            text="イベント追加"
            @click="addEvent"
          />
        </template>
        <v-card-text>
          <DayEventList
            v-if="cursor.selected"
            :entries="entries"
            :date="cursor.selected"
            @open="openEvent"
          />
        </v-card-text>
      </v-card>
    </v-bottom-sheet>
    <YearMonthDialog
      v-model="pickingMonth"
      :month="cursor.anchor"
      :today="today"
      @select="pickMonth"
    />
    <EventDetailSheet :event-id="eventId" @close="closeEvent" />
  </div>
</template>

<style scoped>
.calendar {
  display: flex;
  flex-direction: column;
  height: calc(100dvh - var(--v-layout-bottom, 0px));
}

.calendar__header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px 4px 8px;
}

.calendar__title {
  padding: 0 4px 0 8px;
  font-size: 20px;
  font-weight: 700;
  letter-spacing: 0;
}

/* The longest week (`10/29（木）– 11/4（水）`) fits beside the buttons on a 390px phone. */
.calendar__title--week {
  font-size: 16px;
}

/* On a narrower phone the title gives way (ending in …) rather than pushing the buttons off. */
.calendar__title {
  flex-shrink: 1;
  min-width: 0;
}

.calendar__title :deep(.v-btn__content) {
  min-width: 0;
}

.calendar__title-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.calendar__today {
  min-width: 0;
  margin-left: 4px;
  padding: 0 12px;
}

/* Second row: the selected day on the left half, the month/week toggle on the right half. */
.calendar__bar {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 8px;
  padding: 0 12px 4px 16px;
}

.calendar__summary {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  font-size: 15px;
  font-weight: 500;
  white-space: nowrap;
  text-overflow: ellipsis;
}

.calendar__mode {
  display: flex;
  flex: 1;
  height: 32px;
}

.calendar__mode :deep(.v-btn) {
  flex: 1;
  min-width: 0;
}

/* Above the bottom navigation (docs/spec.md "カレンダー > 画面": FAB at the bottom right), its right
   edge lined up with 今日 and the month/week toggle (12px from the edge). */
.calendar__fab {
  position: fixed;
  right: 12px;
  bottom: calc(var(--v-layout-bottom, 56px) + 12px);
  z-index: 5;
}

.calendar__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.calendar__main {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow-x: hidden;
  overflow-y: auto;
  /* Horizontal swipes change the month here: not the browser's back/forward gesture. */
  overscroll-behavior-x: none;
  touch-action: pan-y;
}

/* The page swiped to slides in from the side it comes from while the old one slides out. */
.slide-next-enter-active,
.slide-next-leave-active,
.slide-prev-enter-active,
.slide-prev-leave-active,
.slide-up-enter-active,
.slide-up-leave-active,
.slide-down-enter-active,
.slide-down-leave-active {
  transition: transform 0.25s ease;
}

.slide-next-leave-active,
.slide-prev-leave-active,
.slide-up-leave-active,
.slide-down-leave-active {
  position: absolute;
  inset: 0;
}

.slide-next-enter-from,
.slide-prev-leave-to {
  transform: translateX(100%);
}

.slide-next-leave-to,
.slide-prev-enter-from {
  transform: translateX(-100%);
}

.slide-up-enter-from,
.slide-down-leave-to {
  transform: translateY(100%);
}

.slide-up-leave-to,
.slide-down-enter-from {
  transform: translateY(-100%);
}

.calendar__side {
  width: 320px;
  padding: 8px 16px;
  overflow-y: auto;
  border-left: 1px solid #e3e5ea;
}

.calendar__side-title {
  margin-bottom: 8px;
  font-size: 16px;
}
</style>
