<script setup lang="ts">
import { LIMITS, charLength } from 'utils'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import ConfirmDialog from '../components/ConfirmDialog.vue'
import DateField from '../components/DateField.vue'
import ImageField from '../components/ImageField.vue'
import { useAppData } from '../composables/useAppData.ts'
import { type NewImage, useEventMutations } from '../composables/useEventMutations.ts'
import {
  emptyEventForm,
  formOfEvent,
  notifyOptions,
  shiftEndDate,
  timeOptions,
  toEventInput,
  validateEventForm,
} from '../lib/event-form.ts'
import { today } from '../lib/format.ts'
import { mapEmbedUrl } from '../lib/map.ts'
import { useNotificationStore } from '../stores/notification.ts'

// Event registration and editing (docs/spec.md "イベント > 画面"), full screen.
const props = defineProps<{ id?: string }>()
const route = useRoute()
const router = useRouter()
const app = useAppData()
const { save, remove } = useEventMutations()
const notification = useNotificationStore()

const startDate = typeof route.query.date === 'string' ? route.query.date : today()
const form = ref(emptyEventForm(startDate))
const added = ref<(NewImage & { url: string })[]>([])
const removedImageIds = ref<string[]>([])
const loaded = ref(!props.id)

// Editing: fill the form once the event is in the local data.
watch(
  () => (props.id ? app.eventById.value.get(props.id) : undefined),
  (event) => {
    if (!event || loaded.value) return
    const topic = event.topicId ? app.topicById.value.get(event.topicId) : undefined
    form.value = formOfEvent(event, topic?.name ?? '')
    loaded.value = true
  },
  { immediate: true },
)
// A new event: the first schedule by default.
watch(
  () => app.schedules.value[0]?.id,
  (first) => {
    if (!props.id && !form.value.scheduleId && first) form.value.scheduleId = first
  },
  { immediate: true },
)

const schedule = computed(() =>
  form.value.scheduleId ? app.scheduleById.value.get(form.value.scheduleId) : undefined,
)
const scheduleItems = computed(() =>
  app.schedules.value.map((s) => ({
    value: s.id,
    title: s.name,
    subtitle: s.scope === 'group' ? 'グループ' : '個人',
  })),
)
const topicItems = computed(() => app.topicsOf(form.value.scheduleId).map((topic) => topic.name))

// Keep the event's length when the start date moves, and drop a notification the kind can't have.
watch(
  () => form.value.startDate,
  (_, previous) => {
    if (previous && form.value.endDate) form.value.endDate = shiftEndDate(form.value, previous)
  },
)
watch(
  () => form.value.allDay,
  (allDay) => {
    const valid = notifyOptions(allDay).some((option) => option.value === form.value.notifyMinutes)
    if (!valid) form.value.notifyMinutes = null
    if (!allDay) {
      form.value.startTime ??= '10:00'
      form.value.endTime ??= '11:00'
    }
  },
)

// A map of the location, 1 second after the last change, to check Google finds the place.
const mapLocation = ref(form.value.location.trim())
let mapTimer: ReturnType<typeof setTimeout> | undefined
watch(
  () => form.value.location.trim(),
  (location) => {
    clearTimeout(mapTimer)
    mapTimer = setTimeout(() => (mapLocation.value = location), 1000)
  },
)
onBeforeUnmount(() => clearTimeout(mapTimer))

const errors = computed(() =>
  validateEventForm(form.value, app.data.value.events, new Date(), props.id),
)
const submitted = ref(false)

const close = () => (window.history.state?.back ? router.back() : router.replace('/'))

const submit = async () => {
  submitted.value = true
  if (errors.value.length > 0) {
    notification.show(errors.value[0])
    return
  }
  const id = await save.mutateAsync({
    id: props.id,
    input: toEventInput(form.value),
    added: added.value,
    removedImageIds: removedImageIds.value,
  })
  await router.replace({ name: 'calendar', query: { event: id } })
}

const confirming = ref(false)
const confirmDelete = async () => {
  if (!props.id) return
  await remove.mutateAsync(props.id)
  confirming.value = false
  await router.replace('/')
}

const counter = (value: string, max: number) => `${charLength(value)} / ${max}`
</script>

<template>
  <!-- The route is the dialog: back (× or the device's) leaves the route, which closes it.
       `closeOnBack` would cancel that navigation instead, as the dialog is persistent. -->
  <v-dialog
    :model-value="true"
    fullscreen
    persistent
    :close-on-back="false"
    :scrim="false"
    transition="dialog-bottom-transition"
  >
    <v-card>
      <v-toolbar color="surface" density="comfortable">
        <v-btn icon="mdi-close" aria-label="閉じる" @click="close" />
        <v-toolbar-title>{{ id ? 'イベントを編集' : 'イベントを登録' }}</v-toolbar-title>
        <v-btn
          color="primary"
          variant="flat"
          class="mr-2"
          text="保存"
          :loading="save.isPending.value"
          :disabled="!loaded"
          @click="submit"
        />
      </v-toolbar>
      <v-card-text v-if="loaded" class="edit">
        <v-text-field
          v-model="form.title"
          label="タイトル"
          :hint="counter(form.title, LIMITS.eventTitleMaxLength)"
          persistent-hint
          :error="submitted && !form.title.trim()"
        />
        <v-select
          v-model="form.scheduleId"
          :items="scheduleItems"
          label="予定"
          :hint="
            schedule?.scope === 'group'
              ? 'グループの予定はメンバー全員に表示されます'
              : '個人の予定は自分だけに表示されます'
          "
          persistent-hint
          :no-data-text="'先に「予定」画面で予定を作成してください'"
        >
          <template #item="{ props: itemProps, item }">
            <v-list-item v-bind="itemProps" :subtitle="item.subtitle" />
          </template>
        </v-select>
        <v-combobox
          v-model="form.topicName"
          :items="topicItems"
          label="トピック（任意）"
          hint="新しい名前を入力すると、保存時にトピックとして登録されます"
          persistent-hint
          clearable
          @update:model-value="(value: string | null) => (form.topicName = value ?? '')"
        />
        <v-switch v-model="form.allDay" label="終日" color="primary" hide-details inset />
        <div class="edit__row">
          <DateField v-model="form.startDate" label="開始日" />
          <v-select
            v-if="!form.allDay"
            v-model="form.startTime"
            :items="timeOptions(form.startTime)"
            label="開始時刻"
            class="edit__time"
            hide-details
          />
        </div>
        <div class="edit__row">
          <DateField v-model="form.endDate" label="終了日" />
          <v-select
            v-if="!form.allDay"
            v-model="form.endTime"
            :items="timeOptions(form.endTime)"
            label="終了時刻"
            class="edit__time"
            hide-details
          />
        </div>
        <v-select
          v-model="form.notifyMinutes"
          :items="notifyOptions(form.allDay)"
          label="通知"
          prepend-inner-icon="mdi-bell-outline"
          hide-details
        />
        <v-text-field
          :model-value="form.location"
          label="場所（任意）"
          prepend-inner-icon="mdi-map-marker-outline"
          hint="施設名・住所・緯度経度（例: 43.0687,141.3508）。詳細画面に地図を表示します"
          persistent-hint
          clearable
          @update:model-value="(value: string | null) => (form.location = value ?? '')"
        />
        <iframe
          v-if="mapLocation"
          :src="mapEmbedUrl(mapLocation)"
          :title="`${mapLocation} の地図`"
          class="edit__map"
          referrerpolicy="no-referrer"
        />
        <v-text-field
          :model-value="form.url"
          label="URL（任意）"
          type="url"
          inputmode="url"
          prepend-inner-icon="mdi-link-variant"
          placeholder="https://"
          hint="お祭りや勉強会のページなど。詳細画面から開けます"
          persistent-hint
          clearable
          @update:model-value="(value: string | null) => (form.url = value ?? '')"
        />
        <v-textarea
          v-model="form.memo"
          label="メモ（任意）"
          auto-grow
          rows="3"
          :hint="counter(form.memo, LIMITS.eventMemoMaxLength)"
          persistent-hint
        />
        <ImageField
          v-model:added="added"
          v-model:removed-ids="removedImageIds"
          :existing="id ? app.imagesOf(id) : []"
        />
        <ul v-if="submitted && errors.length" class="edit__errors">
          <li v-for="error in errors" :key="error">{{ error }}</li>
        </ul>
        <v-btn
          v-if="id"
          block
          variant="text"
          color="error"
          prepend-icon="mdi-delete-outline"
          text="このイベントを削除"
          class="mt-6"
          @click="confirming = true"
        />
      </v-card-text>
      <v-card-text v-else-if="app.sync.isFetching.value" class="text-center">
        <v-progress-circular indeterminate color="primary" />
      </v-card-text>
      <v-card-text v-else class="text-center text-medium-emphasis">
        イベントが見つかりません（削除された可能性があります）
      </v-card-text>
    </v-card>
  </v-dialog>
  <ConfirmDialog
    v-model="confirming"
    title="このイベントを削除しますか？"
    text="添付した画像も削除されます。"
    confirm-text="削除"
    danger
    :loading="remove.isPending.value"
    @confirm="confirmDelete"
  />
</template>

<style scoped>
.edit {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 640px;
  margin: 0 auto;
}

.edit__row {
  display: flex;
  gap: 12px;
}

.edit__row > :first-child {
  flex: 1;
}

.edit__time {
  flex: 0 0 120px;
}

.edit__map {
  display: block;
  width: 100%;
  height: 200px;
  border: 0;
  border-radius: 8px;
}

.edit__errors {
  padding-left: 20px;
  color: rgb(var(--v-theme-error));
  font-size: 13px;
}
</style>
