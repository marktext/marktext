<template>
  <div
    v-if="reply"
    class="reply"
  >
    <button
      type="button"
      class="linkish"
      @click="openReply"
    >
      {{ t('agent.replyTo') }} {{ label }}
    </button>
  </div>
  <template v-else>
    <button
      type="button"
      class="tool"
      :aria-expanded="open"
      :aria-label="`${kindLabel} ${pathLabel}`"
      @click="open = !open"
    >
      <span class="path">{{ pathLabel }}</span>
      <span
        class="st"
        :class="{ err: tool.status === 'failed' }"
      >{{ statusLabel }}</span>
    </button>
    <pre
      v-if="open"
      class="detail"
    >{{ detail }}</pre>
  </template>
</template>

<script setup lang="ts">
import type { ToolRow } from '@/agent/chatTranscript'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { isReplyTool, replyThreadId } from '@/agent/chatTranscript'
import bus from '@/bus'
import { useCommentsStore } from '@/store/comments'
import { useLayoutStore } from '@/store/layout'

const props = defineProps<{ tool: ToolRow }>()
const { t } = useI18n()
const open = ref(false)
const reply = computed(() => isReplyTool(props.tool.title))
const threadId = computed(() => replyThreadId(props.tool.title))

const label = computed(() => {
  const id = threadId.value
  if (!id) return props.tool.title.replace(/marktext\.reply_to_thread/ig, '').trim()
  const thread = useCommentsStore().threads.find((item) => item.id === id)
  return thread?.anchor.quote || id
})

const pathLabel = computed(() =>
  props.tool.locations[0] || props.tool.diffPaths[0] || props.tool.title
)

const kindLabel = computed(() => {
  const name = props.tool.title.toLowerCase()
  if (name.includes('search') || name.includes('grep')) return t('agent.toolSearch')
  if (name.includes('command') || name.includes('shell') || name.includes('exec')) return t('agent.toolCommand')
  if (name.includes('read')) return t('agent.toolRead')
  if (name.includes('mcp')) return t('agent.toolMcp')
  return t('agent.toolEdit')
})

const statusLabel = computed(() => {
  if (props.tool.status === 'failed') return t('agent.statusError')
  if (props.tool.status === 'pending' || props.tool.status === 'in_progress') return t('agent.statusRunning')
  return t('agent.statusDone')
})

const detail = computed(() =>
  [...props.tool.locations, ...props.tool.diffPaths].filter((item, index, all) => all.indexOf(item) === index).join('\n')
)

const openReply = (): void => {
  const id = threadId.value
  if (!id) return
  const comments = useCommentsStore()
  comments.selectedThreadId = id
  useLayoutStore().SET_LAYOUT({ showAgentPanel: true, agentPanelTab: 'comments' })
  bus.emit('agent:show-in-text')
}
</script>
