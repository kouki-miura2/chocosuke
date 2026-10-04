import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Sign-in in progress (root AGENTS.md "Sign in with Google and terms consent"): the ID token of an
 * account that isn't registered yet, kept in memory only until the consent screen registers it.
 */
export const useAuthStore = defineStore('auth', () => {
  const pendingCredential = ref<string | null>(null)
  return { pendingCredential }
})
