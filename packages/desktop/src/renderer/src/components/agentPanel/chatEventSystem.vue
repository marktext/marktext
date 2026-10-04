<template>
  <p
    v-if="error"
    class="sys err"
  >
    {{ error }}
  </p>
  <button
    v-if="failed"
    type="button"
    class="btn"
    :disabled="running"
    @click="retry"
  >
    {{ t('agent.retry') }}
  </button>
  <p
    v-if="missing.length > 0"
    class="sys"
  >
    {{ t('agent.missingReplies') }}
    <button
      v-for="id in missing"
      :key="id"
      type="button"
      class="linkish"
      @click="openThread(id)"
    >
      {{ quoteOf(id) }}
    </button>
  </p>
  <p
    v-if="unchanged"
    class="sys"
  >
    {{ t('agent.unchanged') }}
  </p>
  <p
    v-if="stopped"
    class="sys"
  >
    {{ t('agent.stopped') }}
  </p>
  <button
    v-if="changeCount > 0"
    type="button"
    class="linkish"
    @click="openDiff"
  >
    {{ t('agent.turnChanges', { n: changeCount }) }}
  </button>
</template>

<script setup lang="ts">
import type { ChatTurn } from '@/agent/chatTranscript'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import bus from '@/bus'
import { useAgentStore } from '@/store/agent'
import { useCommentsStore } from '@/store/comments'
import { useLayoutStore } from '@/store/layout'

const props = defineProps<{ turn: ChatTurn; running: boolean }>()
const { t } = useI18n()
const finished = computed(() => props.turn.finished)
const error = computed(() => props.turn.error)
const failed = computed(() => finished.value?.stopReason === 'error')
const missing = computed(() => finished.value?.missingReplyThreadIds ?? [])
const changeCount = computed(() => finished.value?.changedPaths.length ?? 0)
const unchanged = computed(() =>
  finished.value?.stopReason === 'end_turn' && changeCount.value === 0
)
const stopped = computed(() => finished.value?.stopReason === 'cancelled')

const quoteOf = (id: string): string => {
  const thread = useCommentsStore().threads.find((item) => item.id === id)
  return thread?.anchor.quote || id
}

const openThread = (id: string): void => {
  useCommentsStore().selectedThreadId = id
  useLayoutStore().SET_LAYOUT({ showAgentPanel: true, agentPanelTab: 'comments' })
  bus.emit('agent:show-in-text')
}

const openDiff = (): void => {
  const done = finished.value
  if (!done) return
  bus.emit('agent:show-turn-diff', { turnId: done.turnId, paths: done.changedPaths })
}

const retry = (): void => {
  useAgentStore().retryLast().catch(() => undefined)
}
</script>
