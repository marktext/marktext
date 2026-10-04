<template>
  <button
    type="button"
    class="fold"
    :aria-expanded="open"
    @click="open = !open"
  >
    {{ open ? '▾' : '▸' }} {{ t('agent.thought') }}
  </button>
  <pre
    v-if="open"
    class="thought"
  >{{ text }}</pre>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

defineProps<{ text: string }>()
const { t } = useI18n()
const open = ref(false)
</script>
