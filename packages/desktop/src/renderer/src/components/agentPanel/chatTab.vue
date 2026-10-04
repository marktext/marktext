<template>
  <section
    class="mt-chat"
    :aria-label="t('agent.chat')"
  >
    <header class="head">
      <p class="harness-label">
        {{ harnessLabel }}
      </p>
      <div
        v-if="showModel"
        class="hrow"
      >
        <select
          :aria-label="t('agent.model')"
          :value="modelValue"
          :disabled="noModels || running"
          @change="onModel"
        >
          <option
            v-if="noModels"
            value=""
            disabled
          >
            {{ t('agent.noModelsOption') }}
          </option>
          <option
            v-for="model in modelList"
            :key="model.id"
            :value="model.id"
          >
            {{ model.label }}
          </option>
        </select>
        <button
          type="button"
          class="iconbtn"
          :aria-label="t('agent.refreshModels')"
          :title="t('agent.refreshModels')"
          @click="refresh"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path
              d="M13 8a5 5 0 1 1-1.5-3.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
            />
            <path
              d="M13 2.5V5.5H10"
              fill="none"
              stroke="currentColor"
              stroke-width="1.3"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
          </svg>
        </button>
      </div>
      <div
        v-if="showSessions"
        class="hrow"
      >
        <select
          :aria-label="t('agent.session')"
          :value="activeSession?.id ?? ''"
          :disabled="running"
          @change="onSession"
        >
          <option
            v-for="session in sessions"
            :key="session.id"
            :value="session.id"
          >
            {{ sessionLabel(session) }}
          </option>
        </select>
        <button
          type="button"
          class="textbtn"
          :disabled="running"
          @click="startNew"
        >
          {{ t('agent.newChat') }}
        </button>
      </div>
      <div
        v-if="sessionStaysOnModel"
        class="banner"
      >
        <span>{{ t('agent.modelStays', { model: sessionStaysOnModel }) }}</span>
        <button
          type="button"
          class="textbtn"
          :disabled="running"
          @click="startNew"
        >
          {{ t('agent.newChat') }}
        </button>
      </div>
    </header>
    <div
      v-if="blockedMessage"
      class="block"
    >
      <p>{{ blockedMessage }}</p>
    </div>
    <div
      v-else-if="noModels"
      class="block"
    >
      <p>{{ t('agent.noModels') }}</p>
    </div>
    <div
      v-else
      ref="logEl"
      class="log"
    >
      <p
        v-if="turns.length === 0"
        class="empty"
      >
        {{ t('agent.emptySession') }}
      </p>
      <ChatTurn
        v-for="turn in turns"
        :key="turn.key"
        :turn="turn"
        :running="running"
      />
    </div>
    <footer
      v-if="showComposer"
      class="foot"
    >
      <textarea
        v-model="draft"
        class="composer"
        rows="2"
        :placeholder="t('agent.draftPlaceholder')"
        @keydown.ctrl.enter.prevent="submit"
        @keydown.meta.enter.prevent="submit"
      />
      <p
        v-if="!running"
        class="hint"
      >
        {{ t('agent.draftHint') }}
      </p>
      <button
        v-if="!running"
        type="button"
        class="primary"
        :disabled="!draft.trim()"
        @click="submit"
      >
        {{ t('agent.send') }}
      </button>
      <button
        v-else
        type="button"
        class="btn"
        @click="stop"
      >
        {{ t('agent.stop') }}
      </button>
    </footer>
  </section>
</template>

<script setup lang="ts">
import type { HarnessId, SessionSummary } from '@shared/types/agent'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { groupTurns } from '@/agent/chatTranscript'
import { useAgentStore } from '@/store/agent'
import { usePreferencesStore } from '@/store/preferences'
import ChatTurn from './chatTurn.vue'
import './chat.css'

const HARNESS_LABEL: Record<HarnessId, string> = {
  opencode: 'OpenCode',
  pi: 'Pi',
  cursor: 'Cursor'
}

const { t } = useI18n()
const agent = useAgentStore()
const preferences = usePreferencesStore()
const draft = ref('')
const logEl = ref<HTMLElement | null>(null)

const harness = computed(() => preferences.agentHarness)
const harnessLabel = computed(() => HARNESS_LABEL[harness.value])
const status = computed(() => agent.harnessStatuses.find((item) => item.id === harness.value))
const modelList = computed(() => agent.models[harness.value] ?? [])
const knownModels = computed(() => harness.value in agent.models)
const noModels = computed(() => knownModels.value && modelList.value.length === 0 && !blockedMessage.value)
const running = computed(() => agent.turn.state === 'running')
const turns = computed(() => groupTurns(agent.events))
const sessions = computed(() => agent.sessions)
const activeSession = computed(() => agent.activeSession)
const sessionStaysOnModel = computed(() => agent.sessionStaysOnModel)
const modelValue = computed(() => agent.selection?.model ?? '')

const blockedMessage = computed(() => {
  const current = status.value
  if (!current) return ''
  if (current.reason === 'auth_required') return t('agent.login')
  if (!current.found || current.reason === 'not_found' || current.reason === 'not_executable') {
    if (harness.value === 'pi') return t('agent.piMissing')
    if (harness.value === 'cursor') return t('agent.cursorMissing')
    return t('agent.programMissing')
  }
  if (current.reason === 'init_failed') return current.message || t('agent.crash')
  return ''
})

const showModel = computed(() => blockedMessage.value === '')
const showSessions = computed(() => !blockedMessage.value && !noModels.value)
const showComposer = computed(() => showSessions.value)

const sessionLabel = (session: SessionSummary): string => {
  const title = session.title || t('agent.newChat')
  const date = new Date(session.updatedAt)
  const when = Number.isNaN(date.getTime()) ? session.updatedAt : date.toLocaleString()
  return `${title} · ${when}`
}

watch(turns, () => {
  nextTick(() => {
    const node = logEl.value
    if (node) node.scrollTop = node.scrollHeight
  }).catch(() => undefined)
})

const onModel = (event: Event): void => {
  const value = (event.target as HTMLSelectElement).value
  if (!value) return
  agent.setModel(value).catch(() => undefined)
}

const onSession = (event: Event): void => {
  const value = (event.target as HTMLSelectElement).value
  agent.selectSession(value).catch(() => undefined)
}

const startNew = (): void => {
  agent.newChat().catch(() => undefined)
}

const refresh = (): void => {
  agent.refreshModels().catch(() => undefined)
}

const submit = (): void => {
  const text = draft.value
  if (!text.trim() || running.value) return
  draft.value = ''
  agent.sendMessage(text).catch(() => undefined)
}

const stop = (): void => {
  agent.cancelTurn().catch(() => undefined)
}
</script>
