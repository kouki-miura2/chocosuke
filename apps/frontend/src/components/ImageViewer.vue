<script setup lang="ts">
import { ref, watch } from 'vue'

// Full-screen image (docs/spec.md "イベント > 画面": tap a thumbnail; pinch to zoom). The image itself
// is zoomed (pinch, or the mouse wheel) and dragged, not the page: zooming the page would carry the
// close button off screen, and an iPhone has no back button to leave by.
const props = defineProps<{ src: string | null }>()
const emit = defineEmits<{ close: [] }>()

const MAX_SCALE = 4
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const pointers = new Map<number, { x: number; y: number }>()
let pinchStart: { distance: number; scale: number } | null = null

const reset = () => {
  scale.value = 1
  offset.value = { x: 0, y: 0 }
  pointers.clear()
  pinchStart = null
}
watch(() => props.src, reset)

const distance = () => {
  const [a, b] = [...pointers.values()]
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0
}
const zoomTo = (value: number) => {
  scale.value = Math.min(MAX_SCALE, Math.max(1, value))
  if (scale.value === 1) offset.value = { x: 0, y: 0 }
}

const down = (event: PointerEvent) => {
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pointers.size === 2) pinchStart = { distance: distance(), scale: scale.value }
}
const move = (event: PointerEvent) => {
  const previous = pointers.get(event.pointerId)
  if (!previous) return
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
  if (pinchStart && pointers.size === 2) {
    zoomTo((pinchStart.scale * distance()) / pinchStart.distance)
  } else if (pointers.size === 1 && scale.value > 1) {
    offset.value = {
      x: offset.value.x + event.clientX - previous.x,
      y: offset.value.y + event.clientY - previous.y,
    }
  }
}
const up = (event: PointerEvent) => {
  pointers.delete(event.pointerId)
  if (pointers.size < 2) pinchStart = null
}
const wheel = (event: WheelEvent) => zoomTo(scale.value * (event.deltaY < 0 ? 1.2 : 1 / 1.2))
</script>

<template>
  <v-dialog :model-value="src !== null" fullscreen @update:model-value="emit('close')">
    <div
      class="viewer"
      @pointerdown="down"
      @pointermove="move"
      @pointerup="up"
      @pointercancel="up"
      @wheel.prevent="wheel"
    >
      <img
        v-if="src"
        :src="src"
        alt=""
        class="viewer__img"
        draggable="false"
        :style="{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
        }"
      />
      <!-- Pinned top left, whatever the zoom. -->
      <v-btn
        class="viewer__close"
        icon="mdi-close"
        variant="flat"
        color="rgba(0, 0, 0, 0.5)"
        aria-label="閉じる"
        @pointerdown.stop
        @click="emit('close')"
      />
    </div>
  </v-dialog>
</template>

<style scoped>
.viewer {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
  /* Pinch and drag are handled here, so the page itself never zooms or scrolls. */
  touch-action: none;
  user-select: none;
}

.viewer__img {
  max-width: 100%;
  max-height: 100%;
  transform-origin: center;
}

.viewer__close {
  position: absolute;
  top: max(8px, env(safe-area-inset-top));
  left: 8px;
  z-index: 1;
  color: #fff;
}
</style>
