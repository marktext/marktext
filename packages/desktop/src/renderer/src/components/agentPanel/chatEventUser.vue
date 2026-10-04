<template>
  <div
    v-if="!card"
    class="user"
  >
    {{ text }}
  </div>
  <template v-else>
    <button
      type="button"
      class="tcard"
      :aria-expanded="open"
      @click="open = !open"
    >
      {{ open ? '▾' : '▸' }} {{ t('agent.threadCard', { n: card.count, file: card.file }) }}
    </button>
    <pre
      v-if="open"
      class="sent"
    >{{ text }}</pre>
  </template>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { commentsCard } from '@/agent/chatTranscript'

const props = defineProps<{ text: string }>()
const { t } = useI18n()
const open = ref(false)
const card = computed(() => commentsCard(props.text))
</script>
