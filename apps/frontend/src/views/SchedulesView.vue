<script setup lang="ts">
import { LIMITS } from 'utils'
import { computed, ref, watch } from 'vue'
import { VueDraggable } from 'vue-draggable-plus'

import type { Schedule, Scope } from '../api/types.ts'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import ScheduleDialog from '../components/ScheduleDialog.vue'
import TopicsDialog from '../components/TopicsDialog.vue'
import { useAppData } from '../composables/useAppData.ts'
import { useScheduleMutations } from '../composables/useScheduleMutations.ts'
import { scheduleColor } from '../lib/colors.ts'
import { addMonthsToDate, monthStart } from '../lib/format.ts'
import { useCalendarStore } from '../stores/calendar.ts'

// Schedule management (docs/spec.md "予定 > 画面"): personal and group schedules in the user's order.
const app = useAppData()
const mutations = useScheduleMutations()
const cursor = useCalendarStore()

// The list is dragged locally, then the order is saved (and comes back with the sync).
const list = ref<Schedule[]>([])
watch(app.schedules, (schedules) => (list.value = [...schedules]), { immediate: true })
const onDragEnd = () => mutations.saveOrder.mutate(list.value.map((s) => s.id))

/** Events of the schedule in the month the calendar shows ("今月 n件"). */
const monthCount = (scheduleId: string) => {
  const first = monthStart(cursor.anchor)
  const last = addMonthsToDate(first, 1)
  return app.data.value.events.filter(
    (e) => e.scheduleId === scheduleId && e.startDate < last && e.endDate >= first,
  ).length
}

const groupName = computed(() => app.group.value?.info.name)
const memberCount = computed(() => app.group.value?.members.length ?? 0)
const countOf = (scope: Scope) => app.schedules.value.filter((s) => s.scope === scope).length
const full = computed(() => ({
  personal: countOf('personal') >= LIMITS.personalSchedules,
  group: countOf('group') >= LIMITS.groupSchedules,
}))
const takenNames = computed(() => ({
  personal: app.schedules.value.filter((s) => s.scope === 'personal').map((s) => s.name),
  group: app.schedules.value.filter((s) => s.scope === 'group').map((s) => s.name),
}))

const editing = ref<Schedule | null>(null)
const dialog = ref(false)
const openAdd = () => {
  editing.value = null
  dialog.value = true
}
const openEdit = (schedule: Schedule) => {
  editing.value = schedule
  dialog.value = true
}
const saving = computed(() => mutations.create.isPending.value || mutations.update.isPending.value)
const save = async (value: { scope: Scope; name: string; color: string }) => {
  if (editing.value) {
    await mutations.update.mutateAsync({
      id: editing.value.id,
      name: value.name,
      color: value.color,
    })
  } else {
    await mutations.create.mutateAsync(value)
  }
  dialog.value = false
}

const topicsOf = ref<Schedule | null>(null)
const deleting = ref<Schedule | null>(null)
const deletingCount = computed(() =>
  deleting.value
    ? app.data.value.events.filter((e) => e.scheduleId === deleting.value?.id).length
    : 0,
)
const confirmDelete = async () => {
  if (!deleting.value) return
  await mutations.remove.mutateAsync(deleting.value.id)
  deleting.value = null
}
</script>

<template>
  <v-container class="schedules">
    <h1 class="text-h6 font-weight-bold mb-2">予定</h1>
    <div class="schedules__scopes">
      <div><v-icon icon="mdi-lock" size="16" /> 個人 · 自分だけに表示</div>
      <div v-if="groupName">
        <v-icon icon="mdi-account-group" size="16" />
        グループ「{{ groupName }}」· メンバー{{ memberCount }}人に公開
      </div>
    </div>

    <p v-if="list.length === 0" class="text-medium-emphasis my-6">
      予定がありません。「予定を追加」から作成してください。
    </p>
    <VueDraggable v-model="list" handle=".schedules__handle" :animation="150" @end="onDragEnd">
      <div v-for="schedule in list" :key="schedule.id" class="schedules__row">
        <v-icon icon="mdi-drag" class="schedules__handle" aria-label="並び替え" />
        <span class="schedules__swatch" :style="{ background: scheduleColor(schedule.color) }" />
        <div class="schedules__name">
          {{ schedule.name }}
          <v-icon :icon="schedule.scope === 'group' ? 'mdi-account-group' : 'mdi-lock'" size="14" />
        </div>
        <span class="schedules__count">今月 {{ monthCount(schedule.id) }}件</span>
        <v-menu>
          <template #activator="{ props: menuProps }">
            <v-btn
              v-bind="menuProps"
              icon="mdi-dots-vertical"
              variant="text"
              aria-label="メニュー"
            />
          </template>
          <v-list density="compact">
            <v-list-item
              prepend-icon="mdi-pencil-outline"
              title="編集"
              @click="openEdit(schedule)"
            />
            <v-list-item
              prepend-icon="mdi-tag-outline"
              title="トピック管理"
              @click="topicsOf = schedule"
            />
            <v-list-item
              prepend-icon="mdi-delete-outline"
              title="削除"
              base-color="error"
              @click="deleting = schedule"
            />
          </v-list>
        </v-menu>
      </div>
    </VueDraggable>

    <v-btn
      class="mt-4"
      variant="outlined"
      prepend-icon="mdi-plus"
      text="予定を追加"
      @click="openAdd"
    />

    <v-card v-if="!app.data.value.groupId" variant="tonal" class="mt-8">
      <v-card-text> 家族とグループを作ると、グループの予定をメンバーで共有できます。 </v-card-text>
      <v-card-actions>
        <v-btn to="/group" append-icon="mdi-chevron-right" text="グループを作成・参加" />
      </v-card-actions>
    </v-card>

    <ScheduleDialog
      v-model="dialog"
      :schedule="editing"
      :in-group="!!app.data.value.groupId"
      :loading="saving"
      :taken-names="takenNames"
      :full="full"
      @save="save"
    />
    <TopicsDialog
      :model-value="topicsOf !== null"
      :topics="app.topicsOf(topicsOf?.id ?? null)"
      :schedule-name="topicsOf?.name ?? ''"
      @update:model-value="topicsOf = null"
    />
    <ConfirmDialog
      :model-value="deleting !== null"
      :title="`「${deleting?.name}」を削除しますか？`"
      :text="`この予定のイベント${deletingCount}件と、トピック・画像もすべて削除されます。`"
      confirm-text="削除"
      danger
      :loading="mutations.remove.isPending.value"
      @update:model-value="deleting = null"
      @confirm="confirmDelete"
    />
  </v-container>
</template>

<style scoped>
.schedules {
  max-width: 720px;
}

.schedules__scopes {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 12px;
  color: #44474e;
  font-size: 13px;
}

.schedules__row {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 56px;
  border-bottom: 1px solid #e3e5ea;
}

.schedules__handle {
  color: #74777f;
  cursor: grab;
  touch-action: none;
}

.schedules__swatch {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border-radius: 4px;
}

.schedules__name {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 4px;
  min-width: 0;
  font-weight: 500;
}

.schedules__count {
  color: #5b5f68;
  font-size: 12px;
  white-space: nowrap;
}
</style>
