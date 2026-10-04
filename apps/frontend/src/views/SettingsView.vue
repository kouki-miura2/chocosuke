<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import ConfirmDialog from '../components/ConfirmDialog.vue'
import CsvDialog from '../components/CsvDialog.vue'
import { useAccountMutations } from '../composables/useAccountMutations.ts'
import { useAuth } from '../composables/useAuth.ts'
import { needsHomeScreen, pushSupported, usePush, vapidPublicKey } from '../composables/usePush.ts'
import { usePwaInstall } from '../composables/usePwaInstall.ts'
import type { InstallGuide } from '../lib/install.ts'
import { useNotificationStore } from '../stores/notification.ts'
import { useViewStateStore } from '../stores/view-state.ts'

// Settings (docs/spec.md "設定 > 画面").
const router = useRouter()
const viewState = useViewStateStore()
const notification = useNotificationStore()
const { signOut } = useAuth()
const { clearDevice, withdraw } = useAccountMutations()
const push = usePush()

const pushNote = computed(() => {
  if (!vapidPublicKey) return 'このアプリでは通知を設定できません（未設定）'
  if (!pushSupported()) {
    return needsHomeScreen()
      ? 'iPhone・iPadでは、ホーム画面に追加したアプリで通知を受け取れます'
      : 'このブラウザは通知に対応していません'
  }
  if (push.permission.value === 'denied')
    return '通知がブロックされています。ブラウザの設定で許可してください'
  return 'この端末でイベントの通知を受け取ります'
})
const togglePush = async (on: boolean | null) => {
  try {
    await push.toggle(!!on)
  } catch {
    notification.show('通知の設定を変更できませんでした')
  }
}

// Install: the browser's prompt where there is one, else a dialog on how to add the app by hand.
const pwa = usePwaInstall()
const installGuide = ref<InstallGuide | null>(null)
const install = async () => {
  installGuide.value = await pwa.install()
}

const csvOpen = ref(false)
const confirming = ref<'logout' | 'clear' | 'withdraw' | null>(null)

const logout = async () => {
  await signOut.mutateAsync()
  confirming.value = null
  await router.replace({ name: 'login' })
}
const clear = async () => {
  await clearDevice.mutateAsync()
  confirming.value = null
  await router.replace({ name: 'login' })
}
const leave = async () => {
  await withdraw.mutateAsync()
  confirming.value = null
  await router.replace({ name: 'login' })
}
</script>

<template>
  <v-container class="settings">
    <h1 class="text-h6 font-weight-bold mb-2">設定</h1>

    <v-list>
      <v-list-subheader>表示</v-list-subheader>
      <v-list-item title="月表示のイベント">
        <template #append>
          <v-btn-toggle v-model="viewState.monthStyle" mandatory density="compact">
            <v-btn value="bar" text="バー" />
            <v-btn value="dot" text="ドット" />
          </v-btn-toggle>
        </template>
      </v-list-item>
      <v-list-item title="週の始まり">
        <template #append>
          <v-btn-toggle v-model="viewState.weekStart" mandatory density="compact">
            <v-btn :value="0" text="日曜日" />
            <v-btn :value="1" text="月曜日" />
          </v-btn-toggle>
        </template>
      </v-list-item>

      <v-list-subheader>通知</v-list-subheader>
      <v-list-item title="この端末で通知を受け取る" :subtitle="pushNote" lines="two">
        <template #append>
          <v-switch
            :model-value="push.enabled.value"
            :disabled="!vapidPublicKey || !pushSupported() || push.permission.value === 'denied'"
            :loading="push.busy.value"
            color="primary"
            hide-details
            inset
            @update:model-value="togglePush"
          />
        </template>
      </v-list-item>

      <v-list-subheader>データ</v-list-subheader>
      <v-list-item
        prepend-icon="mdi-file-delimited-outline"
        title="CSVダウンロード"
        @click="csvOpen = true"
      />

      <v-list-subheader>このアプリについて</v-list-subheader>
      <v-list-item
        v-if="!pwa.installed.value"
        prepend-icon="mdi-cellphone-arrow-down"
        title="アプリをインストール"
        subtitle="ホーム画面から全画面で開けます"
        @click="install"
      />
      <v-list-item prepend-icon="mdi-file-document-outline" title="利用規約" to="/terms" />
      <v-list-item
        prepend-icon="mdi-shield-account-outline"
        title="プライバシーポリシー"
        to="/privacy"
      />

      <v-list-subheader>アカウント</v-list-subheader>
      <v-list-item prepend-icon="mdi-logout" title="ログアウト" @click="confirming = 'logout'" />
      <v-list-item
        prepend-icon="mdi-cellphone-remove"
        title="この端末のデータを消去"
        @click="confirming = 'clear'"
      />
      <v-list-item
        prepend-icon="mdi-account-remove-outline"
        title="退会"
        base-color="error"
        @click="confirming = 'withdraw'"
      />
    </v-list>

    <CsvDialog v-model="csvOpen" />
    <v-dialog
      :model-value="installGuide !== null"
      max-width="400"
      @update:model-value="installGuide = null"
    >
      <v-card title="ホーム画面に追加する">
        <v-card-text v-if="installGuide === 'ios'">
          Safari の共有ボタン（<v-icon
            icon="mdi-export-variant"
            size="18"
          />）をタップし、「ホーム画面に追加」を選んでください。「Webアプリとして開く」はオンのままにします。
        </v-card-text>
        <v-card-text v-else>
          ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。見つからない場合は、Chrome・Edge・Safari
          で開いてください。
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn text="閉じる" @click="installGuide = null" />
        </v-card-actions>
      </v-card>
    </v-dialog>
    <ConfirmDialog
      :model-value="confirming === 'logout'"
      title="ログアウトしますか？"
      text="この端末に保存したデータは残ります。共用の端末では「この端末のデータを消去」を使ってください。"
      confirm-text="ログアウト"
      :loading="signOut.isPending.value"
      @update:model-value="confirming = null"
      @confirm="logout"
    />
    <ConfirmDialog
      :model-value="confirming === 'clear'"
      title="この端末のデータを消去"
      text="この端末に保存したデータを消去してログアウトします。サーバーのデータは消えません。"
      confirm-text="消去"
      danger
      :loading="clearDevice.isPending.value"
      @update:model-value="confirming = null"
      @confirm="clear"
    />
    <ConfirmDialog
      :model-value="confirming === 'withdraw'"
      title="退会しますか？"
      text="個人の予定・トピック・イベント・画像を削除し、グループから脱退します。作成者の場合は、参加が最も古いメンバーが作成者になります（ほかにメンバーがいなければグループを削除します）。この操作は取り消せません。"
      confirm-text="退会"
      danger
      :loading="withdraw.isPending.value"
      @update:model-value="confirming = null"
      @confirm="leave"
    />
  </v-container>
</template>

<style scoped>
.settings {
  max-width: 720px;
}
</style>
