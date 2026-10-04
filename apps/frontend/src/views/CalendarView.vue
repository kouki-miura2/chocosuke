<script setup lang="ts">
import { addDaysToDate, selectableDateRange } from 'utils'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useDisplay } from 'vuetify'

import DayEventList from '../components/DayEventList.vue'
import EventDetailSheet from '../components/EventDetailSheet.vue'
import MonthCalendar from '../components/MonthCalendar.vue'
import ScheduleFilter from '../components/ScheduleFilter.vue'
import WeekList from '../components/WeekList.vue'
import YearMonthDialog from '../components/YearMonthDialog.vue'
import { useAppData } from '../composables/useAppData.ts'
import { weekAround } from '../lib/calendar.ts'
import {
  addMonthsToDate,
  formatYearMonth,
  formatYmdWeekday,
  today as todayOf,
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

const title = computed(() => formatYearMonth(cursor.anchor))

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
const goToday = () => {
  cursor.anchor = today
  cursor.selected = null
}

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
        append-icon="mdi-menu-down"
        class="calendar__title"
        @click="pickingMonth = true"
      >
        {{ title }}
      </v-btn>
      <v-btn
        icon="mdi-chevron-left"
        variant="text"
        density="comfortable"
        aria-label="前へ"
        :disabled="!canStep(-1)"
        @click="step(-1)"
      />
      <v-btn
        icon="mdi-chevron-right"
        variant="text"
        density="comfortable"
        aria-label="次へ"
        :disabled="!canStep(1)"
        @click="step(1)"
      />
      <v-btn variant="outlined" size="small" class="calendar__today" text="今日" @click="goToday" />
      <v-spacer />
      <v-btn-toggle
        v-model="viewState.viewMode"
        mandatory
        density="compact"
        variant="outlined"
        divided
        class="calendar__mode"
      >
        <v-btn value="month" text="月" />
        <v-btn value="week" text="週" />
      </v-btn-toggle>
    </header>
    <ScheduleFilter :schedules="app.schedules.value" />

    <div class="calendar__body">
      <div class="calendar__main">
        <MonthCalendar
          v-if="viewState.viewMode === 'month'"
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
          :entries="entries"
          :center="cursor.anchor"
          :today="today"
          @open="openEvent"
          @select-day="(date) => (cursor.selected = date)"
        />
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
      size="56"
      rounded="lg"
      elevation="4"
      aria-label="イベントを登録"
      @click="addEvent"
    />

    <v-bottom-sheet v-model="daySheet">
      <v-card :title="cursor.selected ? formatYmdWeekday(cursor.selected) : ''">
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
  gap: 2px;
  padding: 8px 8px 4px;
}

.calendar__title {
  padding: 0 4px 0 8px;
  font-size: 18px;
  font-weight: 700;
  letter-spacing: 0;
}

.calendar__today {
  min-width: 0;
  padding: 0 10px;
}

.calendar__mode :deep(.v-btn) {
  min-width: 0;
  padding: 0 10px;
}

/* Above the bottom navigation (docs/spec.md "カレンダー > 画面": FAB at the bottom right). */
.calendar__fab {
  position: fixed;
  right: 16px;
  bottom: calc(var(--v-layout-bottom, 56px) + 16px);
  z-index: 5;
}

.calendar__body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.calendar__main {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
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
