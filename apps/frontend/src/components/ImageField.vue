<script setup lang="ts">
import { LIMITS } from 'utils'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

import type { EventImage } from '../api/types.ts'
import type { NewImage } from '../composables/useEventMutations.ts'
import { JPEG_QUALITY, fitWithin } from '../lib/image.ts'
import { useNotificationStore } from '../stores/notification.ts'

// The image field of the event form (docs/spec.md "イベント > 画像"): paste (Ctrl+V / ⌘+V, or
// long-press "ペースト" in the paste area) or pick files; each is scaled down and made a JPEG here.

const props = defineProps<{ existing: EventImage[] }>()
const added = defineModel<(NewImage & { url: string })[]>('added', { required: true })
const removedIds = defineModel<string[]>('removedIds', { required: true })
const notification = useNotificationStore()

const kept = computed(() => props.existing.filter((image) => !removedIds.value.includes(image.id)))
const count = computed(() => kept.value.length + added.value.length)
const full = computed(() => count.value >= LIMITS.imagesPerEvent)

const toJpeg = async (file: Blob): Promise<NewImage> => {
  const bitmap = await createImageBitmap(file)
  const size = fitWithin(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = size.width
  canvas.height = size.height
  const context = canvas.getContext('2d')
  if (context) {
    // JPEG has no transparency: transparent pixels would turn black.
    context.fillStyle = '#fff'
    context.fillRect(0, 0, size.width, size.height)
    context.drawImage(bitmap, 0, 0, size.width, size.height)
  }
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  )
  if (!blob) throw new Error('could not convert')
  return { blob, ...size }
}

const addFiles = async (files: Iterable<Blob>) => {
  for (const file of files) {
    if (!file.type.startsWith('image/')) continue
    if (full.value) {
      notification.show(`画像はイベントごとに${LIMITS.imagesPerEvent}枚までです`)
      return
    }
    try {
      const image = await toJpeg(file)
      if (image.blob.size > LIMITS.imageMaxBytes) {
        notification.show('画像のサイズが大きすぎるため追加できません')
        continue
      }
      added.value = [...added.value, { ...image, url: URL.createObjectURL(image.blob) }]
    } catch {
      notification.show('この画像は読み込めませんでした')
    }
  }
}

const onPaste = (event: ClipboardEvent) => {
  const files = [...(event.clipboardData?.items ?? [])]
    .filter((item) => item.kind === 'file')
    .flatMap((item) => item.getAsFile() ?? [])
  if (files.length === 0) return
  event.preventDefault()
  void addFiles(files)
}
onMounted(() => window.addEventListener('paste', onPaste))
onBeforeUnmount(() => {
  window.removeEventListener('paste', onPaste)
  for (const image of added.value) URL.revokeObjectURL(image.url)
})

const fileInput = ref<HTMLInputElement | null>(null)
const onFiles = (event: Event) => {
  const input = event.target as HTMLInputElement
  void addFiles(input.files ?? [])
  input.value = ''
}

const removeAdded = (index: number) => {
  const [image] = added.value.splice(index, 1)
  if (image) URL.revokeObjectURL(image.url)
  added.value = [...added.value]
}
</script>

<template>
  <div class="images">
    <div class="images__label">画像（{{ count }}/{{ LIMITS.imagesPerEvent }}）</div>
    <div class="images__grid">
      <div v-for="image in kept" :key="image.id" class="images__item">
        <v-img :src="`/api/images/${image.id}`" aspect-ratio="1" cover rounded="lg" />
        <v-btn
          class="images__remove"
          icon="mdi-close"
          size="x-small"
          aria-label="画像を削除"
          @click="removedIds = [...removedIds, image.id]"
        />
      </div>
      <div v-for="(image, index) in added" :key="image.url" class="images__item">
        <v-img :src="image.url" aspect-ratio="1" cover rounded="lg" />
        <v-btn
          class="images__remove"
          icon="mdi-close"
          size="x-small"
          aria-label="画像を削除"
          @click="removeAdded(index)"
        />
      </div>
    </div>
    <template v-if="!full">
      <!-- Long-press here on a phone to get "ペースト". -->
      <div
        class="images__paste"
        contenteditable="true"
        @paste.stop="onPaste"
        @input="($event.target as HTMLElement).textContent = ''"
      >
        ここに画像を貼り付け（長押し →「ペースト」）
      </div>
      <v-btn
        variant="outlined"
        prepend-icon="mdi-image-plus"
        text="画像を追加"
        @click="fileInput?.click()"
      />
      <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onFiles" />
    </template>
  </div>
</template>

<style scoped>
.images__label {
  margin-bottom: 8px;
  color: #44474e;
  font-size: 13px;
}

.images__grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 8px;
}

.images__item {
  position: relative;
}

.images__remove {
  position: absolute;
  top: 4px;
  right: 4px;
}

.images__paste {
  margin-bottom: 8px;
  padding: 16px;
  border: 1px dashed #c4c6cf;
  border-radius: 8px;
  color: #74777f;
  font-size: 13px;
  text-align: center;
  caret-color: transparent;
}
</style>
