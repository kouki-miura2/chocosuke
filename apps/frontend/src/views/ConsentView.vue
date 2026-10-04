<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuth } from '../composables/useAuth.ts'
import { meQueryOptions } from '../composables/useMeQuery.ts'
import { redirectTarget } from '../lib/redirect.ts'
import { useAuthStore } from '../stores/auth.ts'

const route = useRoute()
const router = useRouter()
const queryClient = useQueryClient()
const auth = useAuthStore()
const { agree } = useAuth()

const agreed = ref(false)
/** `register`: a new account; `revised`: the terms changed since the user agreed. */
const mode = ref<'register' | 'revised' | null>(null)

onMounted(async () => {
  if (auth.pendingCredential) {
    mode.value = 'register'
    return
  }
  const me = await queryClient.fetchQuery(meQueryOptions).catch(() => null)
  if (!me) await router.replace({ name: 'login', query: route.query })
  else if (!me.needsConsent) await router.replace(redirectTarget(route.query))
  else mode.value = 'revised'
})

const submit = async () => {
  await agree.mutateAsync()
  await router.replace(redirectTarget(route.query))
}

const cancel = async () => {
  auth.pendingCredential = null
  await router.replace({ name: 'login', query: route.query })
}
</script>

<template>
  <v-container v-if="mode" class="consent">
    <h1 class="text-h6 font-weight-bold mb-4">
      {{ mode === 'register' ? 'はじめに' : '利用規約・プライバシーポリシーを改定しました' }}
    </h1>
    <p class="mb-4">
      {{
        mode === 'register'
          ? 'ご利用の前に、利用規約とプライバシーポリシーをお読みください。'
          : '改定後の内容をお読みのうえ、同意をお願いします。'
      }}
    </p>
    <!-- New tab: leaving this one would lose the sign-in in progress. -->
    <v-list density="compact" class="mb-2">
      <v-list-item to="/terms" target="_blank" title="利用規約" append-icon="mdi-open-in-new" />
      <v-list-item
        to="/privacy"
        target="_blank"
        title="プライバシーポリシー"
        append-icon="mdi-open-in-new"
      />
    </v-list>
    <v-checkbox v-model="agreed" label="利用規約とプライバシーポリシーに同意します" hide-details />
    <v-btn
      block
      size="large"
      color="primary"
      class="mt-4"
      text="同意してはじめる"
      :disabled="!agreed"
      :loading="agree.isPending.value"
      @click="submit"
    />
    <v-btn
      v-if="mode === 'register'"
      block
      variant="text"
      class="mt-2"
      text="戻る"
      @click="cancel"
    />
  </v-container>
</template>

<style scoped>
.consent {
  max-width: 480px;
  padding-top: 48px;
}
</style>
