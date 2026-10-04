<script setup lang="ts">
import { LIMITS, charLength } from 'utils'
import { computed, ref, watch } from 'vue'

import type { Schedule, Scope } from '../api/types.ts'
import { SCHEDULE_COLORS } from '../lib/colors.ts'

// Adding or editing a schedule (docs/spec.md "予定 > 項目"). The scope is chosen only when adding.
const props = defineProps<{
  schedule: Schedule | null
  /** Group schedules can be added only while in a group. */
  inGroup: boolean
  loading: boolean
  /** Names already used, per scope (no duplicates within a scope). */
  takenNames: Record<Scope, string[]>
  /** Whether each scope has room for another schedule. */
  full: Record<Scope, boolean>
}>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ save: [value: { scope: Scope; name: string; color: string }] }>()

const scope = ref<Scope>('personal')
const name = ref('')
const color = ref<string>(SCHEDULE_COLORS[0].key)
watch(open, (isOpen) => {
  if (!isOpen) return
  scope.value = props.schedule?.scope ?? 'personal'
  name.value = props.schedule?.name ?? ''
  color.value = props.schedule?.color ?? SCHEDULE_COLORS[0].key
})

const error = computed(() => {
  const trimmed = name.value.trim()
  if (!trimmed) return '予定名を入力してください'
  if (charLength(trimmed) > LIMITS.scheduleNameMaxLength) {
    return `予定名は${LIMITS.scheduleNameMaxLength}文字までです`
  }
  if (
    props.takenNames[scope.value].some(
      (taken) => taken === trimmed && taken !== props.schedule?.name,
    )
  ) {
    return '同じ名前の予定があります'
  }
  if (!props.schedule && props.full[scope.value]) {
    return scope.value === 'group'
      ? `グループの予定は${LIMITS.groupSchedules}件までです`
      : `個人の予定は${LIMITS.personalSchedules}件までです`
  }
  return null
})
</script>

<template>
  <v-dialog v-model="open" max-width="440">
    <v-card :title="schedule ? '予定を編集' : '予定を追加'">
      <v-card-text class="d-flex flex-column ga-4">
        <v-btn-toggle
          v-if="!schedule"
          v-model="scope"
          mandatory
          divided
          variant="outlined"
          color="primary"
        >
          <v-btn value="personal" prepend-icon="mdi-lock" text="個人" />
          <v-btn
            value="group"
            prepend-icon="mdi-account-group"
            text="グループ"
            :disabled="!inGroup"
          />
        </v-btn-toggle>
        <p class="text-caption text-medium-emphasis">
          {{
            scope === 'group'
              ? 'グループの予定はメンバー全員に表示されます。公開範囲はあとから変更できません。'
              : '個人の予定は自分だけに表示されます。公開範囲はあとから変更できません。'
          }}
        </p>
        <v-text-field
          v-model="name"
          label="予定名"
          :error-messages="name ? (error ?? undefined) : undefined"
        />
        <div class="colors">
          <button
            v-for="option in SCHEDULE_COLORS"
            :key="option.key"
            type="button"
            class="colors__swatch"
            :style="{ background: option.value }"
            :aria-label="option.label"
            @click="color = option.key"
          >
            <v-icon v-if="color === option.key" icon="mdi-check" color="white" />
          </button>
        </div>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text="キャンセル" @click="open = false" />
        <v-btn
          color="primary"
          text="保存"
          :disabled="error !== null"
          :loading="loading"
          @click="emit('save', { scope, name: name.trim(), color })"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.colors {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 10px;
}

.colors__swatch {
  display: grid;
  place-items: center;
  aspect-ratio: 1;
  border-radius: 50%;
}
</style>
