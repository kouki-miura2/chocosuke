<script setup lang="ts">
import { selectableDateRange } from 'utils'
import { computed } from 'vue'

import { fromPickerDate, toPickerDate } from '../lib/date-input.ts'
import { formatYmdWeekday } from '../lib/format.ts'
import { useViewStateStore } from '../stores/view-state.ts'

// A date input bound to a `YYYY-MM-DD` string: only dates that can be registered are selectable,
// and the calendar starts on the user's first weekday (docs/spec.md "設定 > 画面").
defineProps<{ label: string }>()
const model = defineModel<string>({ required: true })
const viewState = useViewStateStore()
const range = selectableDateRange(new Date())

const pickerValue = computed({
  get: () => (model.value ? toPickerDate(model.value) : null),
  set: (value: unknown) => {
    if (value instanceof Date) model.value = fromPickerDate(value)
  },
})
</script>

<template>
  <v-date-input
    v-model="pickerValue"
    :label="label"
    :min="toPickerDate(range.min)"
    :max="toPickerDate(range.max)"
    :first-day-of-week="viewState.weekStart"
    :display-format="(date: unknown) => formatYmdWeekday(fromPickerDate(date as Date))"
    hide-details="auto"
  />
</template>
