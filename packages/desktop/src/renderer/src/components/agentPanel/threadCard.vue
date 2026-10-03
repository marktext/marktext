<template>
  <button
    type="button"
    class="card"
    :data-thread="thread.id"
    :aria-current="selected ? 'true' : undefined"
    @click="emit('select')"
  >
    <span class="quote">{{ thread.anchor.quote }}</span>
    <span
      v-if="first"
      class="meta"
    >{{ meta }}</span>
    <span
      v-if="orphaned || missingReply || thread.status === 'closed'"
      class="tags"
    >
      <span
        v-if="orphaned"
        class="tag tag-orphan"
      >{{ t('comments.badgeOrphan') }}</span>
      <span
        v-if="missingReply"
        class="tag tag-noreply"
      >{{ t('comments.badgeNoAgent') }}</span>
      <span
        v-if="thread.status === 'closed'"
        class="tag tag-closed"
      >{{ t('comments.badgeClosed') }}</span>
    </span>
  </button>
</template>

<script setup lang="ts">
import type { Thread } from '@shared/types/comments'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { formatWhen, harnessLabel, personName } from './commentsFormat'

const props = defineProps<{
  thread: Thread
  selected: boolean
  orphaned: boolean
  missingReply: boolean
  userName: string
}>()

const emit = defineEmits<{ select: [] }>()
const { t, locale } = useI18n()

const first = computed(() => props.thread.messages[0])

const author = computed(() => {
  const message = first.value
  if (!message) return ''
  if (message.author.kind === 'agent') {
    return `${harnessLabel(message.author.harness)} · ${message.author.model}`
  }
  return personName(message.author.name, props.userName)
})

const meta = computed(() => {
  const message = first.value
  if (!message) return ''
  const when = formatWhen(message.createdAt, locale.value, t('comments.justNow'))
  const replies = t('comments.replyCount', { n: props.thread.messages.length })
  return `${author.value} · ${when} · ${replies}`
})
</script>
