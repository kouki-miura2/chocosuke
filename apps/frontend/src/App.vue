<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { runningStandalone } from './composables/usePwaInstall.ts'
import { usePwaUpdate } from './composables/usePwaUpdate.ts'
import { useNotificationStore } from './stores/notification.ts'

const notification = useNotificationStore()
const route = useRoute()
const showNav = computed(() => route.meta.nav === true)
const { needRefresh, update } = usePwaUpdate()

// Full screen from the home screen, the bottom navigation sits right at the screen's edge (by the
// home indicator of an iPhone): taller there than in a browser tab (Vuetify's default 56px).
const navHeight = runningStandalone() ? 76 : 56

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
    <v-bottom-navigation v-if="showNav" grow color="primary" :height="navHeight">
      <v-btn v-for="tab in tabs" :key="tab.to" :to="tab.to" :value="tab.to" exact rounded="0">
        <v-icon :icon="tab.icon" />
        <span>{{ tab.label }}</span>
      </v-btn>
    </v-bottom-navigation>
    <v-snackbar
      v-model="notification.visible"
      location="bottom"
      :timeout="4000"
      :class="`snackbar--${notification.kind}`"
    >
      {{ notification.message }}
    </v-snackbar>
    <!-- A new version of the app: stays until tapped, behind any other message shown meanwhile. -->
    <v-snackbar
      :model-value="needRefresh && !notification.visible"
      location="bottom"
      :timeout="-1"
      class="snackbar--info"
    >
      新しいバージョンがあります
      <template #actions>
        <v-btn variant="text" @click="needRefresh = false">後で</v-btn>
        <v-btn variant="text" color="primary-container" @click="update">更新</v-btn>
      </template>
    </v-snackbar>
    <!-- docs/spec.md "共通ルール > 画面": a phone held sideways asks to turn it back. -->
    <div class="portrait-only">
      <v-icon icon="mdi-phone-rotate-portrait" size="48" />
      <p>縦向きでご利用ください</p>
    </div>
  </v-app>
</template>

<style scoped>
/* Errors on a slightly see-through red, notices on dark grey; white text on both. */
.snackbar--error :deep(.v-snackbar__wrapper) {
  background: rgb(var(--v-theme-error), 0.92);
  color: #fff;
}

.snackbar--info :deep(.v-snackbar__wrapper) {
  background: rgb(27, 28, 30, 0.92);
  color: #fff;
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
