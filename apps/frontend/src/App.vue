<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'

import { useNotificationStore } from './stores/notification.ts'

const notification = useNotificationStore()
const route = useRoute()
const showNav = computed(() => route.meta.nav === true)

// The home indicator of an iPhone running the app full screen (PWA): the bottom navigation grows by
// that inset and keeps its buttons above it. Vuetify's layout takes the height as a number, so the
// inset (`env(safe-area-inset-bottom)`, 0 elsewhere) is measured from a hidden probe.
const NAV_HEIGHT = 56
const safeAreaProbe = ref<HTMLElement | null>(null)
const safeAreaBottom = ref(0)
const measureSafeArea = () => {
  if (safeAreaProbe.value) {
    safeAreaBottom.value = parseFloat(getComputedStyle(safeAreaProbe.value).paddingBottom) || 0
  }
}
onMounted(() => {
  measureSafeArea()
  window.addEventListener('resize', measureSafeArea)
})
onBeforeUnmount(() => window.removeEventListener('resize', measureSafeArea))

const tabs = [
  { to: '/', icon: 'mdi-calendar-month', label: 'カレンダー' },
  { to: '/schedules', icon: 'mdi-label-outline', label: '予定' },
  { to: '/group', icon: 'mdi-account-group-outline', label: 'グループ' },
  { to: '/settings', icon: 'mdi-cog-outline', label: '設定' },
]
</script>

<template>
  <v-app>
    <v-main>
      <router-view />
    </v-main>
    <v-bottom-navigation
      v-if="showNav"
      grow
      color="primary"
      :height="NAV_HEIGHT + safeAreaBottom"
      class="bottom-nav"
    >
      <v-btn v-for="tab in tabs" :key="tab.to" :to="tab.to" :value="tab.to" exact rounded="0">
        <v-icon :icon="tab.icon" />
        <span>{{ tab.label }}</span>
      </v-btn>
    </v-bottom-navigation>
    <div ref="safeAreaProbe" class="safe-area-probe" aria-hidden="true" />
    <v-snackbar v-model="notification.visible" location="bottom" :timeout="4000">
      {{ notification.message }}
    </v-snackbar>
    <!-- docs/spec.md "共通ルール > 画面": a phone held sideways asks to turn it back. -->
    <div class="portrait-only">
      <v-icon icon="mdi-phone-rotate-portrait" size="48" />
      <p>縦向きでご利用ください</p>
    </div>
  </v-app>
</template>

<style scoped>
.safe-area-probe {
  position: fixed;
  visibility: hidden;
  pointer-events: none;
  padding-bottom: env(safe-area-inset-bottom);
}

/* The buttons keep their height; the inset below them stays clear of the home indicator. */
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}

.bottom-nav :deep(.v-btn) {
  height: 56px; /* NAV_HEIGHT */
}

.portrait-only {
  display: none;
}

@media (orientation: landscape) and (max-height: 599px) {
  .portrait-only {
    position: fixed;
    inset: 0;
    z-index: 3000;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 16px;
    background: rgb(var(--v-theme-background));
  }
}
</style>
