import { onlineManager } from '@tanstack/vue-query'
import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Whether the device is offline (docs/spec.md "共通ルール > オフライン"): screens stay readable from
 * the local DB, and everything that changes data is disabled. The browser's guess, so a request can
 * still fail while this says online.
 */
export const useNetworkStore = defineStore('network', () => {
  const offline = ref(!onlineManager.isOnline())
  onlineManager.subscribe((online) => {
    offline.value = !online
  })
  return { offline }
})
