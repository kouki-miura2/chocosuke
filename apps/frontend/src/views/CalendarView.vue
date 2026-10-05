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
// Moving to another month/week page (前へ・次へ, swipes, 今日, the month picker): the new page slides
// in from the side it comes from and starts at its top. The week view is keyed by `weekPage`, so
// recentering it on a tapped day doesn't slide the page: its rows move instead (WeekList).
const main = ref<HTMLElement | null>(null)
const direction = ref<1 | -1 | 0>(0)
const weekPage = ref(0)
const moveTo = (anchor: string) => {
  if (anchor === cursor.anchor) return
  direction.value = anchor > cursor.anchor ? 1 : -1
  cursor.anchor = anchor
  weekPage.value++
  main.value?.scrollTo({ top: 0 })
}
const slideName = computed(() => {
  if (direction.value === 0) return 'none'
  if (viewState.viewMode === 'month') return direction.value > 0 ? 'slide-next' : 'slide-prev'
  return direction.value > 0 ? 'slide-up' : 'slide-down'
})

const step = (direction: 1 | -1) => {
  if (canStep(direction)) moveTo(moved(direction))
}

// The week view opens on the selected day (today until one is picked) as its center; switching
// month/week doesn't slide.
watch(
  () => viewState.viewMode,
  (mode) => {
    direction.value = 0
    if (mode === 'week') cursor.anchor = cursor.selected ?? today
    weekPage.value++
  },
)

// Tapping a day of the week view selects it and recenters the 7 days on it.
const selectWeekDay = (date: string) => {
  cursor.selected = date
  cursor.anchor = date
}

// Swipes (docs/spec.md "カレンダー > 画面"), through `step` so never past the dates that can be
// shown. Month view: left/right (`v-touch`). Week view: a flick up/down — quick and long enough —
// changes the week; a slower drag scrolls the list as usual.
const swipe = (direction: 1 | -1) => {
  if (viewState.viewMode === 'month') step(direction)
}
const FLICK_MS = 300
const FLICK_PX = 50
let touchStart: { x: number; y: number; at: number } | null = null
let touchLast: { x: number; y: number } | null = null
const touchDown = (event: TouchEvent) => {
  const touch = event.touches[0]
  touchStart =
    event.touches.length === 1 && touch
      ? { x: touch.clientX, y: touch.clientY, at: event.timeStamp }
      : null
  touchLast = touchStart
}
const touchMove = (event: TouchEvent) => {
  const touch = event.touches[0]
  if (touch) touchLast = { x: touch.clientX, y: touch.clientY }
}
// Also on `touchcancel`: a browser that takes the gesture over for scrolling may cancel the touch.
const touchUp = (event: TouchEvent) => {
  const start = touchStart
  const lifted = event.changedTouches[0]
  const end = lifted ? { x: lifted.clientX, y: lifted.clientY } : touchLast
  touchStart = null
  if (viewState.viewMode !== 'week' || !start || !end) return
  const dx = end.x - start.x
  const dy = end.y - start.y
  if (
    event.timeStamp - start.at <= FLICK_MS &&
    Math.abs(dy) >= FLICK_PX &&
    Math.abs(dy) > Math.abs(dx) * 1.5
  ) {
    step(dy < 0 ? 1 : -1)
  }
}

const goToday = () => {
  moveTo(today)
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
  moveTo(month)
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
        v-touch="{ left: () => swipe(1), right: () => swipe(-1) }"
        @touchstart.passive="touchDown"
        @touchmove.passive="touchMove"
        @touchend="touchUp"
        @touchcancel="touchUp"
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
            :key="weekPage"
            :entries="entries"
            :center="cursor.anchor"
            :today="today"
            @open="openEvent"
            @select-day="selectWeekDay"
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
