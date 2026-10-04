<template>
  <div class="pref-agent">
    <h4>{{ t('preferences.agent.title') }}</h4>
    <div class="switch-row">
      <span class="switch-label">{{ t('preferences.agent.mode') }}</span>
      <button
        type="button"
        class="switch"
        role="switch"
        :aria-checked="agentModeEnabled"
        :aria-label="t('preferences.agent.modeSwitch')"
        @click="toggleMode"
      />
    </div>
    <p class="switch-note">
      {{ t('preferences.agent.modeNote') }}
    </p>
    <p
      v-if="!agentModeEnabled"
      class="switch-note"
    >
      {{ t('preferences.agent.modeOff') }}
    </p>
    <p
      v-if="notice"
      class="live"
    >
      {{ notice }}
    </p>

    <section class="section">
      <h6>{{ t('preferences.agent.harness') }}</h6>
      <p
        v-if="turnLocked"
        class="turn-note"
      >
        {{ t('preferences.agent.turnNote') }}
      </p>
      <div
        role="radiogroup"
        :aria-label="t('preferences.agent.activeHarness')"
      >
        <section
          v-for="card in HARNESS_CARDS"
          :key="card.id"
          class="card"
          :class="{ used: agentHarness === card.id, locked: turnLocked }"
        >
          <div class="card-head">
            <h6>{{ card.title }}</h6>
            <label class="use">
              <input
                type="radio"
                name="agent-harness"
                :checked="agentHarness === card.id"
                :disabled="turnLocked"
                :aria-label="t('preferences.agent.useNamed', { name: card.title })"
                @change="useHarness(card.id)"
              >
              {{ t('preferences.agent.use') }}
            </label>
          </div>
          <label
            class="field"
            :for="`path-${card.id}`"
          >{{ t('preferences.agent.path') }}</label>
          <div class="pathrow">
            <input
              :id="`path-${card.id}`"
              type="text"
              spellcheck="false"
              :value="drafts[card.id]"
              :placeholder="t('preferences.agent.pathPlaceholder', { cmd: card.cmd })"
              @input="onPath(card, $event)"
            >
            <button
              type="button"
              class="textbtn"
              :aria-label="t('preferences.agent.browseNamed', { name: card.title })"
              @click="browse(card)"
            >
              {{ t('preferences.agent.browse') }}
            </button>
          </div>
          <p
            v-if="probed"
            class="st"
            :class="kindOf(card) === 'found' ? 'ok' : 'bad'"
          >
            {{ statusText(card) }}
          </p>
          <button
            type="button"
            class="textbtn check"
            :aria-label="t('preferences.agent.checkNamed', { name: card.title })"
            @click="check(card)"
          >
            {{ t('preferences.agent.check') }}
          </button>
          <div class="models">
            <div class="models-head">
              <span>{{ t('preferences.agent.models') }}</span>
              <button
                type="button"
                class="textbtn"
                :aria-label="t('preferences.agent.refreshNamed', { name: card.title })"
                @click="refresh(card)"
              >
                {{ t('preferences.agent.refresh') }}
              </button>
            </div>
            <ul
              v-if="rowsOf(card).length"
              :aria-label="t('preferences.agent.modelsLabel', { name: card.title })"
            >
              <li
                v-for="model in rowsOf(card)"
                :key="model.id"
              >
                {{ model.label }}
              </li>
            </ul>
          </div>
        </section>
      </div>
    </section>

    <section class="section">
      <h6>{{ t('preferences.agent.shellTitle') }}</h6>
      <label
        class="field"
        for="agent-shell"
      >{{ t('preferences.agent.shell') }}</label>
      <input
        id="agent-shell"
        class="shell-input"
        type="text"
        spellcheck="false"
        :value="shellDraft"
        :placeholder="t('preferences.agent.shellPlaceholder')"
        @input="onShell"
      >
    </section>
    <p class="help">
      {{ t('preferences.agent.help') }}
    </p>
  </div>
</template>

<script setup lang="ts">
import type { HarnessId, HarnessStatus, ListModelsResult, ModelOption } from '@shared/types/agent'
import { onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import {
  HARNESS_CARDS,
  harnessCardKind,
  harnessChangeAllowed,
  modelRows,
  type HarnessCardKind,
  type HarnessMeta
} from '@/agent/harnessCard'
import { usePreferencesStore } from '@/store/preferences'

const { t } = useI18n()
const preferencesStore = usePreferencesStore()
const { agentModeEnabled, agentHarness } = storeToRefs(preferencesStore)

const drafts = reactive<Record<HarnessId, string>>({
  opencode: '',
  pi: '',
  cursor: ''
})
const shellDraft = ref('')
const statuses = ref<HarnessStatus[]>([])
const catalogs = ref<Partial<Record<HarnessId, ListModelsResult>>>({})
const turnLocked = ref(false)
const probed = ref(false)
const notice = ref('')
const timers = new Map<string, ReturnType<typeof setTimeout>>()
let offStatus: (() => void) | null = null
let offTurn: (() => void) | null = null

const statusOf = (id: HarnessId): HarnessStatus | undefined =>
  statuses.value.find((item) => item.id === id)

const kindOf = (card: HarnessMeta): HarnessCardKind =>
  harnessCardKind(statusOf(card.id), catalogs.value[card.id] ?? null)

const rowsOf = (card: HarnessMeta): ModelOption[] => modelRows(catalogs.value[card.id] ?? null)

const save = (type: string, value: string | boolean): void => {
  preferencesStore.SET_SINGLE_PREFERENCE({ type, value })
}

const flushSave = (key: string, value: string): void => {
  const pending = timers.get(key)
  if (pending) clearTimeout(pending)
  timers.delete(key)
  save(key, value)
}

const queueSave = (key: string, value: string): void => {
  const pending = timers.get(key)
  if (pending) clearTimeout(pending)
  timers.set(key, setTimeout(() => {
    timers.delete(key)
    save(key, value)
  }, 400))
}

const syncDrafts = (): void => {
  for (const card of HARNESS_CARDS) {
    const node = document.getElementById(`path-${card.id}`)
    if (node === document.activeElement) continue
    drafts[card.id] = preferencesStore[card.pathKey]
  }
  const shell = document.getElementById('agent-shell')
  if (shell !== document.activeElement) shellDraft.value = preferencesStore.agentTerminalShell
}

watch(
  () => [
    preferencesStore.agentOpencodePath,
    preferencesStore.agentPiPath,
    preferencesStore.agentCursorPath,
    preferencesStore.agentTerminalShell
  ],
  syncDrafts,
  { immediate: true }
)

const toggleMode = (): void => {
  save('agentModeEnabled', !agentModeEnabled.value)
}

const useHarness = (id: HarnessId): void => {
  if (!harnessChangeAllowed(turnLocked.value)) return
  save('agentHarness', id)
}

const onPath = (card: HarnessMeta, event: Event): void => {
  const value = (event.target as HTMLInputElement).value
  drafts[card.id] = value
  queueSave(card.pathKey, value)
}

const onShell = (event: Event): void => {
  const value = (event.target as HTMLInputElement).value
  shellDraft.value = value
  queueSave('agentTerminalShell', value)
}

const loadModels = async (id: HarnessId, refresh: boolean): Promise<void> => {
  const result = await window.agent.listModels(id, { refresh })
  catalogs.value = { ...catalogs.value, [id]: result }
}

const noticeFor = (card: HarnessMeta): string => {
  const kind = kindOf(card)
  if (kind === 'login') return t('preferences.agent.signInStill')
  if (kind === 'no_models') return t('preferences.agent.stillNoModels', { name: card.title })
  if (kind === 'missing') return t('preferences.agent.stillMissing', { cmd: card.cmd })
  if (kind === 'found') return t('preferences.agent.programFound')
  return t('preferences.agent.checked')
}

const check = async (card: HarnessMeta): Promise<void> => {
  flushSave(card.pathKey, drafts[card.id])
  try {
    statuses.value = await window.agent.getHarnessStatus()
    probed.value = true
    await loadModels(card.id, true)
  } catch {
    return
  }
  notice.value = noticeFor(card)
}

const refresh = async (card: HarnessMeta): Promise<void> => {
  try {
    await loadModels(card.id, true)
  } catch {
    return
  }
  notice.value = kindOf(card) === 'no_models'
    ? t('preferences.agent.listEmpty', { name: card.title })
    : t('preferences.agent.listRefreshed')
}

const browse = async (card: HarnessMeta): Promise<void> => {
  const picked = await window.electron.ipcRenderer.invoke('mt::ask-for-file-path')
  if (!picked) return
  drafts[card.id] = picked
  flushSave(card.pathKey, picked)
  notice.value = t('preferences.agent.pathSelected')
}

const statusText = (card: HarnessMeta): string => {
  const status = statusOf(card.id)
  const kind = kindOf(card)
  if (kind === 'found') {
    return t('preferences.agent.found', { bin: status?.resolvedPath || drafts[card.id] })
  }
  if (kind === 'login') return t('preferences.agent.login')
  if (kind === 'no_models') return t('preferences.agent.noModels', { name: card.title })
  if (kind === 'failed') {
    const detail = status?.message ? `: ${status.message}` : ''
    return t('preferences.agent.initFailed', { detail })
  }
  return t('preferences.agent.missing', { cmd: `\`${card.cmd}\`` })
}

const reload = async (): Promise<void> => {
  turnLocked.value = await window.agent.getTurnActive()
  statuses.value = await window.agent.getHarnessStatus()
  probed.value = true
  await Promise.all(HARNESS_CARDS.map((card) => {
    if (!statusOf(card.id)?.found) return Promise.resolve()
    return loadModels(card.id, false)
  }))
}

onMounted(() => {
  offStatus = window.agent.onHarnessStatusChanged((next) => {
    statuses.value = next
  })
  offTurn = window.agent.onTurnActive((active) => {
    turnLocked.value = active
  })
  reload().catch(() => undefined)
})

onBeforeUnmount(() => {
  offStatus?.()
  offTurn?.()
  for (const pending of timers.values()) clearTimeout(pending)
  timers.clear()
})
</script>

<style scoped>
.switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin: 12px 0 4px;
}

.switch-label {
  font-size: 14px;
}

.switch-note {
  margin: 0 0 8px;
  font-size: 12px;
  font-style: italic;
  color: var(--editorColor80);
}

.switch {
  width: 36px;
  height: 18px;
  border-radius: 9px;
  border: 2px solid var(--iconColor);
  background: transparent;
  position: relative;
  cursor: pointer;
  padding: 0;
  flex: none;
}

.switch::after {
  content: '';
  position: absolute;
  top: 1px;
  left: 2px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--iconColor);
}

.switch[aria-checked='true'] {
  border-color: var(--themeColor);
  background: var(--themeColor);
}

.switch[aria-checked='true']::after {
  left: 18px;
  background: #fff;
}

.section {
  margin: 28px 0;
}

.turn-note,
.live {
  margin: 0 0 12px;
  padding: 8px 10px;
  font-size: 13px;
  background: var(--themeColor10);
  color: var(--editorColor80);
}

.card {
  margin: 0 0 12px;
  padding: 12px;
  border: 1px solid var(--editorColor10);
  background: var(--editorBgColor);
}

.card.used {
  box-shadow: inset 3px 0 0 var(--themeColor);
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.card-head h6 {
  margin: 0;
}

.use {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  cursor: pointer;
}

.card.locked .use {
  opacity: 0.4;
  cursor: default;
}

.use input {
  accent-color: var(--themeColor);
}

.field {
  display: block;
  margin: 0 0 4px;
  font-size: 13px;
  color: var(--editorColor80);
}

.pathrow {
  display: flex;
  gap: 8px;
  align-items: center;
}

.pathrow input,
.shell-input {
  flex: 1;
  min-width: 0;
  height: 28px;
  padding: 0 8px;
  border: 1px solid var(--editorColor10);
  background: var(--editorBgColor);
  color: inherit;
  font-size: 13px;
}

.shell-input {
  width: 100%;
  box-sizing: border-box;
}

.textbtn {
  background: none;
  border: 1px solid var(--editorColor10);
  padding: 3px 8px;
  font-size: 12px;
  cursor: pointer;
  color: var(--editorColor80);
  flex: none;
}

.check {
  margin-top: 8px;
}

.st {
  margin: 8px 0 0;
  font-size: 13px;
}

.st.ok {
  color: var(--diffInsFg, #146c3a);
}

.st.bad {
  color: var(--tagReadFg, #7a1e1e);
}

.models {
  margin-top: 10px;
}

.models-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.models-head span {
  font-size: 13px;
  color: var(--editorColor80);
}

.models ul {
  margin: 6px 0 0;
  padding: 0;
  list-style: none;
}

.models li {
  padding: 3px 0;
  font-family: 'DejaVu Sans Mono', 'Source Code Pro', monospace;
  font-size: 12px;
  color: var(--editorColor);
}

.help {
  margin: 8px 0 0;
  font-size: 12px;
  font-style: italic;
  color: var(--editorColor80);
  line-height: 1.5;
}
</style>
