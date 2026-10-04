<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useAuth } from '../composables/useAuth.ts'
import { googleClientId, useGoogleButton } from '../composables/useGoogleButton.ts'
import { redirectTarget } from '../lib/redirect.ts'
import { useNotificationStore } from '../stores/notification.ts'

const route = useRoute()
const router = useRouter()
const { signIn } = useAuth()
const notification = useNotificationStore()
const appTitle = import.meta.env.VITE_APP_TITLE

const onCredential = async (credential: string) => {
  const next = await signIn.mutateAsync(credential)
  const redirect = redirectTarget(route.query)
  await router.replace(next === 'consent' ? { name: 'consent', query: { redirect } } : redirect)
}

const buttonContainer = ref<HTMLElement | null>(null)
useGoogleButton(
  buttonContainer,
  (credential) => void onCredential(credential),
  () => notification.show('Googleのログインを読み込めませんでした'),
)

// Development login (root AGENTS.md "Public config values for the frontend"): only in `vp dev`
// without a client id, and only accepted by a backend with `DEV_LOGIN=true`.
const devLogin = !googleClientId && import.meta.env.DEV
const devName = ref('alice')
</script>

<template>
  <v-container class="login fill-height">
    <div class="login__body">
      <div class="login__logo">
        <v-icon icon="mdi-calendar-month" size="48" color="white" />
      </div>
      <h1 class="text-h5 font-weight-bold">{{ appTitle }}</h1>
      <p class="login__catch">自分の予定も、家族の予定も、<br />ひとつのカレンダーで。</p>

      <div v-if="googleClientId" ref="buttonContainer" class="login__google" />
      <template v-else-if="devLogin">
        <v-text-field
          v-model="devName"
          label="開発用ログイン（アカウント名）"
          hide-details
          class="w-100"
        />
        <v-btn
          block
          color="primary"
          text="開発用ログイン"
          :loading="signIn.isPending.value"
          @click="onCredential(`dev:${devName}`)"
        />
      </template>
      <!-- Without a client id: a disabled stand-in shaped like the Google button. -->
      <v-btn
        v-else
        disabled
        variant="outlined"
        rounded="pill"
        size="large"
        height="40"
        prepend-icon="mdi-google"
        text="Googleでログイン"
        class="login__google"
      />

      <p class="login__note">
        はじめての方は、ログインのあとに
        <router-link to="/terms" target="_blank">利用規約</router-link>・<router-link
          to="/privacy"
          target="_blank"
          >プライバシーポリシー</router-link
        >への同意をお願いします。
      </p>
    </div>
  </v-container>
</template>

<style scoped>
.login {
  justify-content: center;
}

.login__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  width: 100%;
  max-width: 400px;
  text-align: center;
}

.login__logo {
  display: grid;
  place-items: center;
  width: 88px;
  height: 88px;
  border-radius: 24px;
  background: rgb(var(--v-theme-primary));
}

.login__catch {
  color: #44474e;
  line-height: 1.7;
}

.login__google {
  width: 100%;
  max-width: 400px;
  min-height: 40px;
  display: flex;
  justify-content: center;
}

.login__note {
  font-size: 12px;
  color: #5b5f68;
  line-height: 1.6;
}
</style>
