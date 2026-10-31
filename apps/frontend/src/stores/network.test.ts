import { onlineManager } from '@tanstack/vue-query'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, expect, test } from 'vite-plus/test'

import { useNetworkStore } from './network.ts'

beforeEach(() => {
  setActivePinia(createPinia())
})

afterEach(() => {
  onlineManager.setOnline(true)
})

test('starts from the online state set at startup', () => {
  onlineManager.setOnline(false)

  expect(useNetworkStore().offline).toBe(true)
})

test('follows the connection going and coming back', () => {
  const network = useNetworkStore()
  expect(network.offline).toBe(false)

  onlineManager.setOnline(false)
  expect(network.offline).toBe(true)

  onlineManager.setOnline(true)
  expect(network.offline).toBe(false)
})
