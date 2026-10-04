<script setup lang="ts">
import { isHttpUrl } from 'utils'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useAppData } from '../composables/useAppData.ts'
import { useEventMutations } from '../composables/useEventMutations.ts'
import { scheduleColor } from '../lib/colors.ts'
import { notifyLabel } from '../lib/event-form.ts'
import { formatDateTime, formatEventTime } from '../lib/format.ts'
import { mapEmbedUrl, mapLinkUrl } from '../lib/map.ts'
import ConfirmDialog from './ConfirmDialog.vue'
import ImageViewer from './ImageViewer.vue'

// Event detail (docs/spec.md "イベント > 画面"), opened by `?event=<id>` on the calendar.
const props = defineProps<{ eventId: string | null }>()
const emit = defineEmits<{ close: [] }>()

const router = useRouter()
const app = useAppData()
const { remove } = useEventMutations()

const event = computed(() => (props.eventId ? app.eventById.value.get(props.eventId) : undefined))
const schedule = computed(() => event.value && app.scheduleById.value.get(event.value.scheduleId))
const topic = computed(() => event.value?.topicId && app.topicById.value.get(event.value.topicId))
const images = computed(() => (event.value ? app.imagesOf(event.value.id) : []))
const updatedText = computed(() => {
  if (!event.value || !schedule.value) return ''
  const at = `更新 ${formatDateTime(event.value.updatedAt)}`
  return schedule.value.scope === 'group' ? `${app.memberName(event.value.updatedBy)} · ${at}` : at
})

const viewing = ref<string | null>(null)
const confirming = ref(false)

const edit = () => {
  if (event.value) void router.push({ name: 'event-edit', params: { id: event.value.id } })
}

const confirmDelete = async () => {
  if (!event.value) return
  await remove.mutateAsync(event.value.id)
  confirming.value = false
  emit('close')
}
</script>

<template>
  <v-bottom-sheet :model-value="eventId !== null" @update:model-value="emit('close')">
    <v-card v-if="event && schedule" class="detail">
      <div class="detail__actions">
        <v-btn icon="mdi-close" variant="text" @click="emit('close')" />
        <v-spacer />
        <v-btn icon="mdi-pencil-outline" variant="text" aria-label="編集" @click="edit" />
        <v-btn
          icon="mdi-delete-outline"
          variant="text"
          aria-label="削除"
          @click="confirming = true"
        />
      </div>
      <v-card-text>
        <div class="detail__schedule">
          <span class="detail__swatch" :style="{ background: scheduleColor(schedule.color) }" />
          {{ schedule.name }}
        </div>
        <div class="detail__scope">
          <v-icon :icon="schedule.scope === 'group' ? 'mdi-account-group' : 'mdi-lock'" size="16" />
          {{ schedule.scope === 'group' ? 'グループ · メンバーに公開' : '個人 · 自分のみ表示' }}
        </div>
        <div v-if="topic" class="detail__topic">{{ topic.name }}</div>
        <h2 class="detail__title">{{ event.title }}</h2>
        <div class="detail__row">
          <v-icon icon="mdi-clock-outline" size="20" />
          {{ formatEventTime({ ...event, allDay: event.startTime === null }) }}
        </div>
        <div class="detail__row">
          <v-icon icon="mdi-bell-outline" size="20" />
          {{
            event.notifyMinutes === null ? '通知なし' : `${notifyLabel(event.notifyMinutes)}に通知`
          }}
        </div>
        <template v-if="event.location">
          <a
            :href="mapLinkUrl(event.location)"
            target="_blank"
            rel="noopener"
            class="detail__row detail__location"
          >
            <v-icon icon="mdi-map-marker-outline" size="20" />
            <span>{{ event.location }}</span>
          </a>
          <iframe
            :src="mapEmbedUrl(event.location)"
            :title="`${event.location} の地図`"
            class="detail__map"
            loading="lazy"
            referrerpolicy="no-referrer"
          />
        </template>
        <!-- Checked again before it becomes a link: only http(s), never `javascript:`. -->
        <a
          v-if="event.url && isHttpUrl(event.url)"
          :href="event.url"
          target="_blank"
          rel="noopener noreferrer"
          class="detail__row detail__link"
        >
          <v-icon icon="mdi-link-variant" size="20" />
          <span>{{ event.url }}</span>
        </a>
        <div v-if="event.memo" class="detail__row detail__memo">
          <v-icon icon="mdi-text" size="20" />
          <span>{{ event.memo }}</span>
        </div>
        <div v-if="images.length" class="detail__images">
          <v-img
            v-for="image in images"
            :key="image.id"
            :src="`/api/images/${image.id}`"
            aspect-ratio="1"
            cover
            rounded="lg"
            class="detail__thumb"
            @click="viewing = `/api/images/${image.id}`"
          />
        </div>
        <div class="detail__row detail__updated">
          <v-icon icon="mdi-account-outline" size="20" />
          {{ updatedText }}
        </div>
      </v-card-text>
    </v-card>
  </v-bottom-sheet>
  <ImageViewer :src="viewing" @close="viewing = null" />
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
.detail {
  padding-bottom: 16px;
}

.detail__actions {
  display: flex;
  padding: 4px;
}

.detail__schedule {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
}

.detail__swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}

.detail__scope,
.detail__topic {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  color: #44474e;
  font-size: 13px;
}

.detail__title {
  margin: 8px 0 12px;
  font-size: 22px;
  font-weight: 700;
}

.detail__row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 10px 0;
  color: #1b1c1e;
}

.detail__location,
.detail__link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}

.detail__location span,
.detail__link span {
  text-decoration: underline;
  overflow-wrap: anywhere;
}

.detail__map {
  display: block;
  width: 100%;
  height: 200px;
  margin: 4px 0 12px;
  border: 0;
  border-radius: 8px;
}

.detail__memo span {
  white-space: pre-wrap;
}

.detail__images {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin: 12px 0;
}

.detail__thumb {
  cursor: zoom-in;
}

.detail__updated {
  color: #5b5f68;
  font-size: 13px;
}
</style>
