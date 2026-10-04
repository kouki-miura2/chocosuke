<script setup lang="ts">
import { LIMITS, charLength, formatDate } from 'utils'
import { computed, ref } from 'vue'

import type { Member } from '../api/types.ts'
import ConfirmDialog from '../components/ConfirmDialog.vue'
import InviteCard from '../components/InviteCard.vue'
import TextInputDialog from '../components/TextInputDialog.vue'
import { useAppData } from '../composables/useAppData.ts'
import { useGroupMutations } from '../composables/useGroupMutations.ts'

// The group (docs/spec.md "グループ > 画面"): create one, or manage the one the user is in.
const app = useAppData()
const mutations = useGroupMutations()

const group = app.group
const myId = computed(() => app.data.value.userId)
const ownerId = computed(() => group.value?.info.ownerUserId)
const members = computed(() =>
  [...(group.value?.members ?? [])].sort((a, b) => a.joinedAt - b.joinedAt),
)

// Not in a group: create one.
const newGroupName = ref('')
const newMemberName = ref('')
const createError = computed(() => {
  const name = newGroupName.value.trim()
  const member = newMemberName.value.trim()
  if (!name || !member) return 'グループ名とメンバー名を入力してください'
  if (charLength(name) > LIMITS.groupNameMaxLength)
    return `グループ名は${LIMITS.groupNameMaxLength}文字までです`
  if (charLength(member) > LIMITS.memberNameMaxLength)
    return `メンバー名は${LIMITS.memberNameMaxLength}文字までです`
  return null
})
const create = () =>
  mutations.create.mutate({
    name: newGroupName.value.trim(),
    memberName: newMemberName.value.trim(),
  })

// In a group.
const renamingGroup = ref(false)
const renameGroup = async (name: string) => {
  await mutations.rename.mutateAsync(name)
  renamingGroup.value = false
}
const renamingMe = ref(false)
const renameMe = async (memberName: string) => {
  await mutations.renameMember.mutateAsync(memberName)
  renamingMe.value = false
}
const myName = computed(() => members.value.find((m) => m.userId === myId.value)?.memberName ?? '')

type Pending = { kind: 'leave' } | { kind: 'remove'; member: Member } | { kind: 'delete' } | null
const pending = ref<Pending>(null)
const confirmText = computed(() => {
  const p = pending.value
  if (!p) return { title: '', text: '' }
  if (p.kind === 'leave') {
    return {
      title: 'グループから脱退しますか？',
      text:
        myId.value === ownerId.value
          ? 'グループの予定はグループに残ります。作成者が脱退すると、参加が最も古いメンバーが作成者になります（ほかにメンバーがいない場合はグループを削除します）。'
          : 'グループの予定はグループに残り、この端末からは見られなくなります。',
    }
  }
  if (p.kind === 'remove') {
    return {
      title: `${p.member.memberName}さんを除外しますか？`,
      text: '除外されたメンバーは、グループの予定を見られなくなります。',
    }
  }
  return {
    title: 'グループを削除しますか？',
    text: 'グループの予定・トピック・イベント・画像がすべて削除され、全メンバーが未参加になります。',
  }
})
const confirmLoading = computed(
  () =>
    mutations.leave.isPending.value ||
    mutations.removeMember.isPending.value ||
    mutations.remove.isPending.value,
)
const confirm = async () => {
  const p = pending.value
  if (!p) return
  if (p.kind === 'leave') await mutations.leave.mutateAsync()
  else if (p.kind === 'remove') await mutations.removeMember.mutateAsync(p.member.userId)
  else await mutations.remove.mutateAsync()
  pending.value = null
}

const joinedText = (member: Member) =>
  member.userId === ownerId.value
    ? '作成者'
    : `${formatDate(new Date(member.joinedAt), 'yyyy/MM/dd')} 参加`
</script>

<template>
  <v-container class="group">
    <template v-if="!group">
      <h1 class="text-h6 font-weight-bold mb-4">グループ</h1>
      <p class="mb-4 text-medium-emphasis">
        家族などとグループを作ると、グループの予定をメンバーで共有できます。参加できるグループは1つです。
      </p>
      <v-card variant="outlined" title="グループを作成" class="mb-6">
        <v-card-text class="d-flex flex-column ga-3">
          <v-text-field
            v-model="newGroupName"
            label="グループ名（例: 山田家）"
            hide-details="auto"
          />
          <v-text-field
            v-model="newMemberName"
            label="あなたのメンバー名（例: 太郎）"
            hide-details="auto"
          />
          <p v-if="(newGroupName || newMemberName) && createError" class="text-error text-caption">
            {{ createError }}
          </p>
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn
            color="primary"
            variant="flat"
            text="作成"
            :disabled="createError !== null"
            :loading="mutations.create.isPending.value"
            @click="create"
          />
        </v-card-actions>
      </v-card>
      <h2 class="text-subtitle-1 font-weight-bold mb-2">招待されたとき</h2>
      <p class="text-medium-emphasis">
        グループのメンバーに招待のQRコードを表示してもらい、スマホのカメラで読み取ってください。招待リンクを開くと参加画面が表示されます。
      </p>
    </template>

    <template v-else>
      <div class="group__head">
        <h1 class="text-h6 font-weight-bold">{{ group.info.name }}</h1>
        <v-btn
          v-if="myId === ownerId"
          icon="mdi-pencil-outline"
          variant="text"
          size="small"
          aria-label="グループ名を変更"
          @click="renamingGroup = true"
        />
      </div>
      <InviteCard :info="group.info" class="mb-6" />

      <h2 class="text-subtitle-1 font-weight-bold">メンバー {{ members.length }}人</h2>
      <v-list>
        <v-list-item v-for="member in members" :key="member.userId">
          <template #prepend>
            <v-avatar color="primary-container" class="text-on-primary-container">
              {{ [...member.memberName][0] }}
            </v-avatar>
          </template>
          <v-list-item-title>
            {{ member.memberName }}<span v-if="member.userId === myId">（あなた）</span>
          </v-list-item-title>
          <v-list-item-subtitle>{{ joinedText(member) }}</v-list-item-subtitle>
          <template #append>
            <v-menu v-if="member.userId === myId || myId === ownerId">
              <template #activator="{ props: menuProps }">
                <v-btn
                  v-bind="menuProps"
                  icon="mdi-dots-vertical"
                  variant="text"
                  aria-label="メニュー"
                />
              </template>
              <v-list density="compact">
                <template v-if="member.userId === myId">
                  <v-list-item
                    prepend-icon="mdi-pencil-outline"
                    title="メンバー名を変更"
                    @click="renamingMe = true"
                  />
                  <v-list-item
                    prepend-icon="mdi-logout"
                    title="グループから脱退"
                    base-color="error"
                    @click="pending = { kind: 'leave' }"
                  />
                </template>
                <v-list-item
                  v-else
                  prepend-icon="mdi-account-remove-outline"
                  title="除外"
                  base-color="error"
                  @click="pending = { kind: 'remove', member }"
                />
              </v-list>
            </v-menu>
          </template>
        </v-list-item>
      </v-list>

      <v-btn
        v-if="myId === ownerId"
        class="mt-6"
        color="error"
        variant="text"
        prepend-icon="mdi-delete-outline"
        text="グループを削除"
        @click="pending = { kind: 'delete' }"
      />
    </template>

    <TextInputDialog
      v-model="renamingGroup"
      title="グループ名を変更"
      label="グループ名"
      :initial="group?.info.name ?? ''"
      :max-length="LIMITS.groupNameMaxLength"
      :loading="mutations.rename.isPending.value"
      @save="renameGroup"
    />
    <TextInputDialog
      v-model="renamingMe"
      title="メンバー名を変更"
      label="メンバー名"
      :initial="myName"
      :max-length="LIMITS.memberNameMaxLength"
      :loading="mutations.renameMember.isPending.value"
      @save="renameMe"
    />
    <ConfirmDialog
      :model-value="pending !== null"
      :title="confirmText.title"
      :text="confirmText.text"
      :confirm-text="
        pending?.kind === 'leave' ? '脱退' : pending?.kind === 'remove' ? '除外' : '削除'
      "
      danger
      :loading="confirmLoading"
      @update:model-value="pending = null"
      @confirm="confirm"
    />
  </v-container>
</template>

<style scoped>
.group {
  max-width: 720px;
}

.group__head {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 12px;
}
</style>
