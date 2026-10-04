<script setup lang="ts">
import { charLength } from 'utils'
import { computed, ref, watch } from 'vue'

// One trimmed name with a length limit (group name, member name).
const props = defineProps<{
  title: string
  label: string
  initial: string
  maxLength: number
  loading?: boolean
}>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ save: [value: string] }>()

const value = ref('')
watch(open, (isOpen) => {
  if (isOpen) value.value = props.initial
})
const error = computed(() => {
  const trimmed = value.value.trim()
  if (!trimmed) return '入力してください'
  if (charLength(trimmed) > props.maxLength) return `${props.maxLength}文字までです`
  return null
})
</script>

<template>
  <v-dialog v-model="open" max-width="400">
    <v-card :title="title">
      <v-card-text>
        <v-text-field
          v-model="value"
          :label="label"
          autofocus
          :error-messages="value ? (error ?? undefined) : undefined"
          @keyup.enter="!error && emit('save', value.trim())"
        />
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text="キャンセル" @click="open = false" />
        <v-btn
          color="primary"
          text="保存"
          :disabled="error !== null"
          :loading="loading"
          @click="emit('save', value.trim())"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>
