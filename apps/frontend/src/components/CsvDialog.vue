<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { ref, watch } from 'vue'

import { useAppData } from '../composables/useAppData.ts'
import { syncQueryOptions } from '../composables/useSyncQuery.ts'
import { csvFileName, csvRows, toCsv } from '../lib/csv.ts'
import { notifyLabel } from '../lib/event-form.ts'
import { formatDateTime, today } from '../lib/format.ts'

// CSV download (docs/spec.md "設定 > CSVダウンロード"): made on the device from the local data,
// after one sync.
const open = defineModel<boolean>({ required: true })
const app = useAppData()
const queryClient = useQueryClient()

const selected = ref<string[]>([])
watch(open, (isOpen) => {
  if (isOpen) selected.value = app.schedules.value.map((s) => s.id)
})

const downloading = ref(false)
const download = async () => {
  downloading.value = true
  try {
    await queryClient.refetchQueries({ queryKey: syncQueryOptions.queryKey, exact: true })
    const order = new Map(app.schedules.value.map((s, i) => [s.id, i]))
    const rows = csvRows(
      app.data.value.events.flatMap((event) => {
        const schedule = app.scheduleById.value.get(event.scheduleId)
        if (!schedule || !selected.value.includes(schedule.id)) return []
        return [
          {
            scheduleName: schedule.name,
            scope: schedule.scope,
            order: order.get(schedule.id) ?? 0,
            topicName: (event.topicId && app.topicById.value.get(event.topicId)?.name) || '',
            title: event.title,
            startDate: event.startDate,
            startTime: event.startTime,
            endDate: event.endDate,
            endTime: event.endTime,
            notify: notifyLabel(event.notifyMinutes),
            location: event.location,
            url: event.url,
            memo: event.memo,
            updatedBy: schedule.scope === 'group' ? app.memberName(event.updatedBy) : '',
            updatedAt: formatDateTime(event.updatedAt),
          },
        ]
      }),
    )
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = csvFileName(today())
    link.click()
    URL.revokeObjectURL(url)
    open.value = false
  } finally {
    downloading.value = false
  }
}
</script>

<template>
  <v-dialog v-model="open" max-width="400">
    <v-card title="CSVダウンロード">
      <v-card-text>
        <p class="mb-2 text-medium-emphasis">ダウンロードする予定を選んでください。</p>
        <v-checkbox
          v-for="schedule in app.schedules.value"
          :key="schedule.id"
          v-model="selected"
          :value="schedule.id"
          :label="schedule.name"
          density="compact"
          hide-details
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text="キャンセル" @click="open = false" />
        <v-btn
          color="primary"
          text="ダウンロード"
          :disabled="selected.length === 0"
          :loading="downloading"
          @click="download"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
