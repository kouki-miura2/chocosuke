<script setup lang="ts">
// Full-screen image (docs/spec.md "イベント > 画面": tap a thumbnail; pinch to zoom). Pinch zoom is
// the browser's own, so the image is just allowed to be zoomed and scrolled.
defineProps<{ src: string | null }>()
const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <v-dialog :model-value="src !== null" fullscreen @update:model-value="emit('close')">
    <div class="viewer" @click.self="emit('close')">
      <v-btn
        class="viewer__close"
        icon="mdi-close"
        variant="text"
        color="white"
        @click="emit('close')"
      />
      <img v-if="src" :src="src" alt="" class="viewer__img" />
    </div>
  </v-dialog>
</template>

<style scoped>
.viewer {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  overflow: auto;
  background: #000;
  touch-action: pan-x pan-y pinch-zoom;
}

.viewer__img {
  max-width: 100%;
  max-height: 100%;
}

.viewer__close {
  position: fixed;
  top: 8px;
  right: 8px;
  z-index: 1;
}
</style>
