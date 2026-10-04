<script setup lang="ts">
import { computed } from 'vue'

import { documents } from '../legal/documents.ts'
import { formatYmd } from '../lib/format.ts'

const props = defineProps<{ document: 'terms' | 'privacy' }>()
const doc = computed(() => documents[props.document])
</script>

<template>
  <v-container class="legal">
    <h1 class="text-h5 font-weight-bold mb-2">{{ doc.title }}</h1>
    <p class="text-medium-emphasis mb-6">制定・改定日: {{ formatYmd(doc.revisedAt) }}</p>
    <p class="mb-6">{{ doc.intro }}</p>
    <section v-for="section in doc.sections" :key="section.heading" class="mb-6">
      <h2 class="text-subtitle-1 font-weight-bold mb-2">{{ section.heading }}</h2>
      <p v-for="(paragraph, i) in section.paragraphs" :key="i" class="mb-2">{{ paragraph }}</p>
    </section>
  </v-container>
</template>

<style scoped>
.legal {
  max-width: 720px;
  line-height: 1.8;
}
</style>
