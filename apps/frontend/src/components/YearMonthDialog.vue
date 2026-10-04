<script setup lang="ts">
import { LIMITS, selectableDateRange } from 'utils'
import { computed, ref, watch } from 'vue'

// Year-month picker (docs/spec.md "カレンダー > 年月選択"): the shown month filled, the current
// month outlined, only the months that can be shown.
const props = defineProps<{ month: string; today: string }>()
const open = defineModel<boolean>({ required: true })
const emit = defineEmits<{ select: [month: string] }>()

const range = computed(() => selectableDateRange(new Date()))
const minYear = LIMITS.calendarMinYear
const maxYear = computed(() => Number(range.value.max.slice(0, 4)))
const year = ref(Number(props.month.slice(0, 4)))
const choosingYear = ref(false)
watch(open, (isOpen) => {
  if (isOpen) {
    year.value = Number(props.month.slice(0, 4))
    choosingYear.value = false
  }
})

const years = computed(() =>
  Array.from({ length: maxYear.value - minYear + 1 }, (_, i) => minYear + i),
)
const key = (y: number, m: number) => `${y}-${String(m).padStart(2, '0')}`

const choose = (m: number) => {
  emit('select', `${key(year.value, m)}-01`)
  open.value = false
}
</script>

<template>
  <v-dialog v-model="open" max-width="360">
    <v-card title="年月を選択">
      <v-card-text>
        <div class="d-flex align-center justify-space-between mb-2">
          <v-btn
            icon="mdi-chevron-left"
            variant="text"
            :disabled="year <= minYear"
            @click="year--"
          />
          <v-btn variant="text" append-icon="mdi-menu-down" @click="choosingYear = !choosingYear">
            {{ year }}年
          </v-btn>
          <v-btn
            icon="mdi-chevron-right"
            variant="text"
            :disabled="year >= maxYear"
            @click="year++"
          />
        </div>
        <div v-if="choosingYear" class="grid">
          <v-btn
            v-for="y in years"
            :key="y"
            :variant="y === year ? 'flat' : 'text'"
            :color="y === year ? 'primary' : undefined"
            @click="((year = y), (choosingYear = false))"
          >
            {{ y }}
          </v-btn>
        </div>
        <div v-else class="grid">
          <v-btn
            v-for="m in 12"
            :key="m"
            :variant="
              key(year, m) === month.slice(0, 7)
                ? 'flat'
                : key(year, m) === today.slice(0, 7)
                  ? 'outlined'
                  : 'text'
            "
            :color="
              key(year, m) === month.slice(0, 7) || key(year, m) === today.slice(0, 7)
                ? 'primary'
                : undefined
            "
            @click="choose(m)"
          >
            {{ m }}月
          </v-btn>
        </div>
        <p class="text-caption text-medium-emphasis mt-4">
          {{ minYear }}年1月 〜 {{ maxYear }}年12月 を表示できます
        </p>
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn text="キャンセル" @click="open = false" />
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}
</style>
