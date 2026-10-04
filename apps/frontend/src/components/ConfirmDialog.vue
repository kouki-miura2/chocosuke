<script setup lang="ts">
// A yes/no question before a destructive action (docs/spec.md: deletes, leaving, withdrawal).
defineProps<{
  title: string
  text?: string
  confirmText?: string
  danger?: boolean
  loading?: boolean
}>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <v-dialog v-model="open" max-width="400">
    <v-card :title="title">
      <v-card-text v-if="text" class="confirm__text">{{ text }}</v-card-text>
      <slot />
      <v-card-actions>
        <v-spacer />
        <v-btn text="キャンセル" @click="open = false" />
        <v-btn
          :color="danger ? 'error' : 'primary'"
          :text="confirmText ?? 'OK'"
          :loading="loading"
          @click="emit('confirm')"
        />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.confirm__text {
  white-space: pre-line;
}
</style>
