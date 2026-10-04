<template>
  <p class="plan-label">
    {{ t('agent.plan') }}
  </p>
  <ul class="plan">
    <li
      v-for="(line, index) in lines"
      :key="index"
    >
      <span
        class="box"
        :class="{ on: line.done }"
      />
      <span>{{ line.text }}</span>
    </li>
  </ul>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{ text: string }>()
const { t } = useI18n()

const lines = computed(() =>
  props.text.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const done = /^\[x\]\s+/i.test(line)
    const text = line.replace(/^\[[ xX]\]\s+/, '')
    return { done, text }
  })
)
</script>
