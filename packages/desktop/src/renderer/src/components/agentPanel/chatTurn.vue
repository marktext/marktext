<template>
  <section class="turn">
    <ChatEventUser
      v-if="turn.userText"
      :text="turn.userText"
    />
    <template
      v-for="(item, index) in turn.body"
      :key="itemKey(item, index)"
    >
      <ChatEventThought
        v-if="item.type === 'thought'"
        :text="item.text"
      />
      <ChatEventTool
        v-else-if="item.type === 'tool'"
        :tool="item"
      />
      <ChatEventPlan
        v-else-if="item.type === 'plan'"
        :text="item.text"
      />
      <ChatEventAgent
        v-else-if="item.type === 'agent'"
        :text="item.text"
      />
      <ChatEventPermission
        v-else-if="item.type === 'permission'"
        :request="item.request"
      />
    </template>
    <ChatEventSystem
      :turn="turn"
      :running="running"
    />
  </section>
</template>

<script setup lang="ts">
import type { ChatTurn, TurnBody } from '@/agent/chatTranscript'
import ChatEventAgent from './chatEventAgent.vue'
import ChatEventPermission from './chatEventPermission.vue'
import ChatEventPlan from './chatEventPlan.vue'
import ChatEventSystem from './chatEventSystem.vue'
import ChatEventThought from './chatEventThought.vue'
import ChatEventTool from './chatEventTool.vue'
import ChatEventUser from './chatEventUser.vue'

defineProps<{ turn: ChatTurn; running: boolean }>()

const itemKey = (item: TurnBody, index: number): string => {
  if (item.type === 'tool') return `tool-${item.id}`
  if (item.type === 'permission') return `perm-${item.request.requestId}`
  if (item.type === 'agent' || item.type === 'thought') return `${item.type}-${item.messageId}`
  return `${item.type}-${index}`
}
</script>
