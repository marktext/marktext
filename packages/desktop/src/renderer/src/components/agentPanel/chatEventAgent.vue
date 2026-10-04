<template>
  <!-- eslint-disable vue/no-v-html -->
  <div
    v-if="parts.prose"
    class="answer"
    v-html="html"
  />
  <!-- eslint-enable vue/no-v-html -->
  <template
    v-for="(fence, index) in parts.fences"
    :key="index"
  >
    <button
      type="button"
      class="fold"
      :aria-expanded="openFence === index"
      @click="openFence = openFence === index ? null : index"
    >
      {{ openFence === index ? '▾' : '▸' }} marktext-replies
    </button>
    <pre
      v-if="openFence === index"
      class="detail"
    >{{ fence }}</pre>
  </template>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { splitRepliesFence } from '@/agent/chatTranscript'
import { renderChatMarkdown } from '@/agent/chatMarkdown'
import { sanitize } from '@/util/dompurify'

const props = defineProps<{ text: string }>()
const openFence = ref<number | null>(null)
const parts = computed(() => splitRepliesFence(props.text))
const html = computed(() => sanitize(renderChatMarkdown(parts.value.prose)))
</script>
