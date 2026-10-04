<script setup lang="ts">
import { LIMITS, charLength } from 'utils'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { ApiError, errorMessage } from '../api/call.ts'
import { useGroupMutations, useInviteQuery } from '../composables/useGroupMutations.ts'

// Joining a group from an invite link (docs/spec.md "グループ > 画面 > グループ参加"). A signed-out
// user comes back here after login (and consent) through the router guard's `redirect`.
const props = defineProps<{ token: string }>()
const router = useRouter()
const invite = useInviteQuery(() => props.token)
const { join } = useGroupMutations()

const memberName = ref('')
const nameError = computed(() => {
  const name = memberName.value.trim()
  if (!name) return 'メンバー名を入力してください'
  if (charLength(name) > LIMITS.memberNameMaxLength)
    return `${LIMITS.memberNameMaxLength}文字までです`
  return null
})

/** Why joining can't work (docs/spec.md "グループ > 操作"), shown instead of the form. */
const blocked = computed(() => {
  const error = invite.error.value ?? join.error.value
  if (!(error instanceof ApiError)) return null
  if (['INVITE_INVALID', 'ALREADY_IN_GROUP', 'NOT_FOUND'].includes(error.code))
    return errorMessage(error)
  if (error.code === 'LIMIT_EXCEEDED') return errorMessage(error)
  return null
})

const submit = async () => {
  await join.mutateAsync({ token: props.token, memberName: memberName.value.trim() })
  await router.replace('/group')
}
</script>

<template>
  <v-container class="invite">
    <h1 class="text-h6 font-weight-bold mb-4">グループに参加</h1>
    <v-progress-circular v-if="invite.isPending.value" indeterminate color="primary" />
    <v-alert v-else-if="blocked" type="warning" variant="tonal" :text="blocked">
      <template #append>
        <v-btn variant="text" to="/" text="カレンダーへ" />
      </template>
    </v-alert>
    <template v-else-if="invite.data.value">
      <p class="mb-4">
        「<strong>{{ invite.data.value.groupName }}</strong
        >」に招待されています。グループで表示するあなたの名前を入力してください。
      </p>
      <v-text-field
        v-model="memberName"
        label="メンバー名"
        :error-messages="memberName ? (nameError ?? undefined) : undefined"
      />
      <v-btn
        block
        size="large"
        color="primary"
        text="参加"
        :disabled="nameError !== null"
        :loading="join.isPending.value"
        @click="submit"
      />
    </template>
    <v-alert
      v-else-if="invite.error.value"
      type="error"
      variant="tonal"
      :text="errorMessage(invite.error.value)"
    />
  </v-container>
</template>

<style scoped>
.invite {
  max-width: 480px;
  padding-top: 32px;
}
</style>
