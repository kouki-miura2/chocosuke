<script setup lang="ts">
import QRCode from 'qrcode'
import { computed, ref, watch } from 'vue'

import type { GroupInfo } from '../api/types.ts'
import { useGroupMutations } from '../composables/useGroupMutations.ts'
import { formatDateTime } from '../lib/format.ts'
import { useNotificationStore } from '../stores/notification.ts'

// The invite (docs/spec.md "グループ > 画面"): QR code made on the device, expiry, copy, reissue.
const props = defineProps<{ info: GroupInfo }>()
const { reissueInvite } = useGroupMutations()
const notification = useNotificationStore()

const link = computed(() => `${window.location.origin}/invite/${props.info.inviteToken}`)
const expired = computed(() => props.info.inviteExpiresAt <= Date.now())
const qr = ref('')
watch(
  link,
  async (url) => {
    qr.value = await QRCode.toDataURL(url, { width: 220, margin: 1 })
  },
  { immediate: true },
)

const copy = async () => {
  try {
    await navigator.clipboard.writeText(link.value)
    notification.show('招待リンクをコピーしました')
  } catch {
    notification.show('コピーできませんでした')
  }
}
</script>

<template>
  <v-card variant="outlined" class="invite">
    <v-card-title class="text-subtitle-1 font-weight-bold">メンバーを招待</v-card-title>
    <v-card-text class="invite__body">
      <div class="invite__qr" :class="{ 'invite__qr--expired': expired }">
        <img v-if="qr" :src="qr" alt="招待リンクのQRコード" width="180" height="180" />
      </div>
      <p class="invite__text">家族のスマホのカメラで読み取ると<br />グループに参加できます</p>
      <v-chip v-if="expired" color="error" variant="tonal" size="small"
        >期限切れ · 再発行してください</v-chip
      >
      <p v-else class="invite__expiry">有効期限 {{ formatDateTime(info.inviteExpiresAt) }}</p>
    </v-card-text>
    <v-card-actions class="justify-center">
      <v-btn
        prepend-icon="mdi-link-variant"
        text="リンクをコピー"
        :disabled="expired"
        @click="copy"
      />
      <v-btn
        prepend-icon="mdi-refresh"
        text="再発行"
        :loading="reissueInvite.isPending.value"
        @click="reissueInvite.mutate()"
      />
    </v-card-actions>
  </v-card>
</template>

<style scoped>
.invite__body {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
}

.invite__qr--expired {
  opacity: 0.2;
}

.invite__text {
  color: #44474e;
  line-height: 1.6;
}

.invite__expiry {
  color: #5b5f68;
  font-size: 12px;
}
</style>
