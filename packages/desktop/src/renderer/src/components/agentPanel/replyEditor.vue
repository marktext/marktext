<template>
  <textarea
    v-model="draft"
    class="composer"
    rows="3"
    :placeholder="t('comments.replyPlaceholder')"
    @keydown="onKey"
  />
  <div class="turn-row">
    <p class="hint">
      {{ t('comments.addHint') }}
    </p>
    <button
      type="button"
      class="textbtn"
      :disabled="!draft.trim()"
      @click="sendDraft"
    >
      {{ t('comments.add') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const props = defineProps<{
  send: (text: string) => Promise<void>
}>()

const { t } = useI18n()
const draft = ref('')

async function sendDraft (): Promise<void> {
  const text = draft.value.trim()
  if (!text) return
  await props.send(text)
  draft.value = ''
}

async function onKey (event: KeyboardEvent): Promise<void> {
  if (event.key !== 'Enter' || event.isComposing) return
  if (!event.ctrlKey && !event.metaKey) return
  event.preventDefault()
  await sendDraft()
}
</script>
