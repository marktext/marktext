<template>
  <aside
    class="agent-panel"
    :class="{ rail: agentPanelRail }"
    :style="{ width: `${effectiveAgentWidth}px` }"
    :aria-label="t('agent.panel')"
  >
    <div class="title-spacer" />
    <div
      v-if="!agentPanelRail"
      class="agent-tabs"
      role="tablist"
    >
      <button
        type="button"
        role="tab"
        :aria-selected="agentPanelTab === 'comments'"
        :aria-label="commentsLabel"
        @click="selectTab('comments')"
      >
        <span>{{ t('comments.title') }}</span>
        <span
          v-if="unresolvedCount > 0"
          class="mt-agent-badge"
        >{{ unresolvedCount }}</span>
      </button>
      <button
        type="button"
        role="tab"
        :aria-selected="agentPanelTab === 'chat'"
        :aria-label="chatLabel"
        @click="selectTab('chat')"
      >
        <span>{{ t('agent.chat') }}</span>
        <i
          v-if="showTurnOnChatTab"
          class="mt-agent-turn-dot"
          :aria-label="t('agent.turnInProgress')"
        />
      </button>
    </div>
    <div
      v-else
      class="agent-rail"
    >
      <button
        type="button"
        :aria-pressed="agentPanelTab === 'comments'"
        :aria-label="commentsLabel"
        :title="commentsRailTip"
        @click="selectTab('comments')"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M6 6h12a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H11l-4 3v-3H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z" />
        </svg>
        <span
          v-if="unresolvedCount > 0"
          class="mt-agent-badge"
        >{{ unresolvedCount }}</span>
      </button>
      <button
        type="button"
        :aria-pressed="agentPanelTab === 'chat'"
        :aria-label="chatLabel"
        :title="chatRailTip"
        @click="selectTab('chat')"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d="M4.5 6.5h15a1.5 1.5 0 0 1 1.5 1.5v7a1.5 1.5 0 0 1-1.5 1.5H9L5.5 19v-2.5H4.5A1.5 1.5 0 0 1 3 15V8a1.5 1.5 0 0 1 1.5-1.5z" />
          <path d="M8 11h8M8 14h5" />
        </svg>
        <i
          v-if="turnInProgress"
          class="mt-agent-turn-dot"
          :aria-label="t('agent.turnInProgress')"
        />
      </button>
    </div>
    <template v-if="!agentAvailable">
      <p
        v-show="!agentPanelRail"
        class="hint"
      >
        {{ t('agent.notRepo') }}
      </p>
    </template>
    <template v-else>
      <div
        v-show="!agentPanelRail"
        class="agent-body"
      >
        <CommentsTab v-show="agentPanelTab === 'comments'" />
        <ChatTab v-show="agentPanelTab === 'chat'" />
      </div>
    </template>
    <div
      v-show="!agentPanelRail"
      class="drag-bar"
      role="separator"
      aria-orientation="vertical"
      :aria-label="t('agent.panelWidth')"
      @mousedown="onDragStart"
    />
  </aside>
</template>

<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { useAgentStore } from '@/store/agent'
import { useCommentsStore } from '@/store/comments'
import { useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import ChatTab from './chatTab.vue'
import CommentsTab from './commentsTab.vue'

const { t } = useI18n()
const layoutStore = useLayoutStore()
const { unresolvedCount } = storeToRefs(useCommentsStore())
const agentStore = useAgentStore()
const { agentAvailable, turnInProgress } = storeToRefs(agentStore)

// A non-repo folder still shows the panel, but there is no session to attach.
watch(
  agentAvailable,
  (ready) => {
    if (ready) agentStore.attachPanel().catch(() => undefined)
    else agentStore.detachPanel()
  },
  { immediate: true }
)
watch(
  () => useEditorStore().currentFile?.pathname ?? '',
  (pathname) => {
    const hint = pathname && window.path?.dirname ? window.path.dirname(pathname) : ''
    agentStore.refreshRepoState(hint)
  }
)
onUnmounted(() => {
  agentStore.detachPanel()
})
const {
  agentPanelTab,
  agentPanelWidth,
  effectiveAgentWidth,
  agentPanelRail,
  agentPanelDeficit
} = storeToRefs(layoutStore)

const commentsLabel = computed(() => {
  const title = t('comments.title')
  if (unresolvedCount.value <= 0) return title
  return `${title}, ${t('comments.unresolvedCount', { n: unresolvedCount.value })}`
})

const showTurnOnChatTab = computed(
  () => turnInProgress.value && agentPanelTab.value !== 'chat'
)

const chatLabel = computed(() => {
  const title = t('agent.chat')
  if (!showTurnOnChatTab.value && !(agentPanelRail.value && turnInProgress.value)) return title
  return `${title}, ${t('agent.turnInProgress')}`
})

const roomTip = computed(() => {
  if (agentPanelDeficit.value <= 0) return ''
  return t('agent.railTip', { n: agentPanelDeficit.value })
})

const commentsRailTip = computed(() => roomTip.value || t('comments.title'))
const chatRailTip = computed(() => {
  const turn = turnInProgress.value ? t('agent.turnInProgress') : ''
  return [turn, roomTip.value || t('agent.chat')].filter(Boolean).join('. ')
})

const selectTab = (tab: 'comments' | 'chat'): void => {
  layoutStore.SET_LAYOUT({ agentPanelTab: tab })
}

const onDragStart = (event: MouseEvent): void => {
  if (event.button !== 0) return
  event.preventDefault()
  const origin = event.clientX
  const start = agentPanelWidth.value

  const move = (ev: MouseEvent): void => {
    layoutStore.SET_AGENT_PANEL_WIDTH(start - (ev.clientX - origin), {
      scheduleBufferUpdate: false
    })
  }
  const up = (): void => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    layoutStore.SET_AGENT_PANEL_WIDTH(agentPanelWidth.value)
  }

  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}
</script>

<style scoped>
.agent-panel {
  position: relative;
  box-sizing: border-box;
  flex: none;
  display: flex;
  flex-direction: column;
  min-width: 0;
  height: 100%;
  background: var(--sideBarBgColor);
  color: var(--sideBarColor);
  border-left: 1px solid var(--itemBgColor);
  overflow: hidden;
  user-select: none;
}

.title-spacer {
  height: var(--titleBarHeight);
  flex: none;
  background: var(--sideBarBgColor);
}

.agent-tabs {
  height: 28px;
  flex: none;
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--editorColor10);
}

.agent-tabs button,
.agent-rail button {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  color: var(--sideBarColor);
  cursor: pointer;
  font: inherit;
}

.agent-tabs button {
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}

.agent-tabs button[aria-selected='true'] {
  color: var(--sideBarTitleColor);
  background: var(--itemBgColor);
  box-shadow: inset 0 -2px 0 var(--themeColor);
}

.agent-rail {
  display: flex;
  flex-direction: column;
}

.agent-rail button {
  width: 45px;
  height: 45px;
  justify-content: center;
  color: var(--sideBarIconColor);
}

.agent-rail button[aria-pressed='true'] {
  color: var(--themeColor);
}

.agent-rail svg {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linejoin: round;
  stroke-linecap: round;
}

.agent-rail .mt-agent-badge {
  position: absolute;
  top: 6px;
  right: 4px;
}

.agent-rail .mt-agent-turn-dot {
  position: absolute;
  right: 7px;
  bottom: 7px;
}

.agent-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.hint {
  margin: 8px 12px;
  font-size: 12px;
  color: var(--sideBarTextColor);
}

.drag-bar {
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 4px;
  z-index: 3;
  cursor: col-resize;
}

.drag-bar:hover::after {
  content: '';
  position: absolute;
  top: 0;
  bottom: 0;
  left: 0;
  width: 2px;
  background: var(--iconColor);
}

button:focus-visible {
  outline: 1px solid var(--themeColor);
  outline-offset: -1px;
}
</style>
