<script setup lang="ts">
import { LIMITS, charLength } from 'utils'
import { ref } from 'vue'

import type { Topic } from '../api/types.ts'
import { useScheduleMutations } from '../composables/useScheduleMutations.ts'
import ConfirmDialog from './ConfirmDialog.vue'

// Topic management (docs/spec.md "予定 > トピック"): rename or delete. Topics are added from the
// event form.
defineProps<{ topics: Topic[]; scheduleName: string }>()
const open = defineModel<boolean>({ required: true })
const { renameTopic, removeTopic } = useScheduleMutations()

const editingId = ref<string | null>(null)
const editingName = ref('')
const startEdit = (topic: Topic) => {
  editingId.value = topic.id
  editingName.value = topic.name
}
const nameError = () => {
  const name = editingName.value.trim()
  if (!name) return 'トピック名を入力してください'
  if (charLength(name) > LIMITS.topicNameMaxLength)
    return `${LIMITS.topicNameMaxLength}文字までです`
  return null
}
const saveEdit = async () => {
  if (!editingId.value || nameError()) return
  await renameTopic.mutateAsync({ id: editingId.value, name: editingName.value.trim() })
  editingId.value = null
}

const deleting = ref<Topic | null>(null)
const confirmDelete = async () => {
  if (!deleting.value) return
  await removeTopic.mutateAsync(deleting.value.id)
  deleting.value = null
}
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card :title="`トピック管理 · ${scheduleName}`">
      <v-card-text>
        <p v-if="topics.length === 0" class="text-medium-emphasis">
          トピックはまだありません。イベントの登録時に入力すると追加されます。
        </p>
        <v-list density="compact">
          <v-list-item v-for="topic in topics" :key="topic.id">
            <v-text-field
              v-if="editingId === topic.id"
              v-model="editingName"
              density="compact"
              autofocus
              :error-messages="nameError() ?? undefined"
              @keyup.enter="saveEdit"
            />
            <span v-else>{{ topic.name }}</span>
            <template #append>
              <template v-if="editingId === topic.id">
                <v-btn
                  icon="mdi-check"
                  variant="text"
                  :loading="renameTopic.isPending.value"
                  @click="saveEdit"
                />
                <v-btn icon="mdi-close" variant="text" @click="editingId = null" />
              </template>
              <template v-else>
                <v-btn
                  icon="mdi-pencil-outline"
                  variant="text"
                  aria-label="名前を変更"
                  @click="startEdit(topic)"
                />
                <v-btn
                  icon="mdi-delete-outline"
                  variant="text"
                  aria-label="削除"
                  @click="deleting = topic"
                />
              </template>
            </template>
          </v-list-item>
        </v-list>
        <p class="text-caption text-medium-emphasis">
          トピックは予定ごとに{{ LIMITS.topicsPerSchedule }}件までです。
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text="閉じる" @click="open = false" />
      </v-card-actions>
    </v-card>
  </v-dialog>
  <ConfirmDialog
    :model-value="deleting !== null"
    :title="`「${deleting?.name}」を削除しますか？`"
    text="このトピックが設定されたイベントは、トピック未設定になります。"
    confirm-text="削除"
    danger
    :loading="removeTopic.isPending.value"
    @update:model-value="deleting = null"
    @confirm="confirmDelete"
  />
</template>
