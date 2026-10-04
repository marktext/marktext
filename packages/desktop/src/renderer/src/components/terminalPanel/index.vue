<template>
  <div class="terminal-panel">
    <div
      class="term-handle"
      :class="{ open: showTerminalPanel }"
      role="separator"
      aria-orientation="horizontal"
      :aria-label="t('terminal.height')"
      @mousedown="onDragStart"
    />
    <section
      v-show="showTerminalPanel"
      ref="panelRoot"
      class="terminal"
      :style="{ height: `${renderedHeight}px` }"
      :aria-label="t('terminal.title')"
      @focusin="onFocusIn"
      @focusout="onFocusOut"
    >
      <div
        class="term-tabs"
        role="tablist"
        :aria-label="t('terminal.tabs')"
      >
        <div
          v-for="tab in tabs"
          :key="tab.slot"
          class="term-tab"
          :class="{ active: tab.slot === activeSlot }"
        >
          <button
            type="button"
            class="term-tab-name"
            role="tab"
            :aria-selected="tab.slot === activeSlot"
            @click="activate(tab.slot)"
          >
            {{ tab.name }}
          </button>
          <button
            type="button"
            class="term-tab-x"
            :aria-label="t('terminal.close', { name: tab.name })"
            @click="closeTab(tab)"
          >
            <svg
              viewBox="0 0 16 16"
              aria-hidden="true"
            >
              <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" />
            </svg>
          </button>
        </div>
        <button
          type="button"
          class="term-plus"
          :aria-label="t('terminal.new')"
          @click="addTab"
        >
          <svg
            viewBox="0 0 16 16"
            aria-hidden="true"
          >
            <path d="M8 3.5v9M3.5 8h9" />
          </svg>
        </button>
        <span
          class="term-cwd"
          :title="cwd"
          :aria-label="t('terminal.root')"
        >{{ cwd }}</span>
        <button
          type="button"
          class="term-text"
          :disabled="active?.exited != null"
          @click="clearScreen"
        >
          {{ t('terminal.clear') }}
        </button>
        <button
          type="button"
          class="term-text"
          :aria-label="t('terminal.collapseButton')"
          @click="collapse"
        >
          {{ t('terminal.collapse') }}
        </button>
      </div>
      <div class="term-body">
        <div
          v-for="tab in tabs"
          v-show="tab.slot === activeSlot"
          :key="tab.slot"
          class="term-host"
          :data-slot="tab.slot"
        />
        <div
          v-if="active && active.exited != null"
          class="term-exit"
          :class="{ failed: active.exited.code !== 0 }"
        >
          <span>{{ t('terminal.exited', { n: active.exited.code ?? '—' }) }}</span>
          <button
            type="button"
            class="term-text"
            @click="restart"
          >
            {{ t('terminal.restart') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { clampTerminalHeight, TERMINAL_COLLAPSE_BELOW } from '@/agent/chrome/fit'
import { terminalColors } from '@/agent/terminalTheme'
import { useAgentStore } from '@/store/agent'
import { useLayoutStore } from '@/store/layout'
import { usePreferencesStore } from '@/store/preferences'

interface TermExitState {
  code: number | null
}

interface TermTab {
  slot: number
  termId: string
  name: string
  /** Null while the shell is running. */
  exited: TermExitState | null
}

interface Host {
  term: Terminal
  fit: FitAddon
  observer: ResizeObserver
}

const { t } = useI18n()
const layoutStore = useLayoutStore()
const preferences = usePreferencesStore()
const { showTerminalPanel, terminalPanelHeight, viewportHeight } = storeToRefs(layoutStore)
const { repoState } = storeToRefs(useAgentStore())

const renderedHeight = computed(() =>
  clampTerminalHeight(terminalPanelHeight.value, viewportHeight.value || 768)
)
const cwd = computed(() => repoState.value.kind === 'repo' ? repoState.value.root : '')

const panelRoot = ref<HTMLElement | null>(null)
const tabs = ref<TermTab[]>([])
const activeSlot = ref<number | null>(null)
const active = computed(() => tabs.value.find((tab) => tab.slot === activeSlot.value) ?? null)

const hosts = new Map<string, Host>()
const earlyData = new Map<string, string>()
const earlyExit = new Map<string, number | null>()
let slotSeq = 0
let offData: (() => void) | null = null
let offExit: (() => void) | null = null

const readTheme = () => terminalColors((name) => getComputedStyle(document.body).getPropertyValue(name))

const paint = (): void => {
  const theme = readTheme()
  for (const host of hosts.values()) host.term.options.theme = theme
}

const fitTab = (tab: TermTab): void => {
  if (!tab.termId || tab.exited != null) return
  const host = hosts.get(tab.termId)
  if (!host) return
  host.fit.fit()
  window.term.resize(tab.termId, host.term.cols, host.term.rows)
}

const disposeHost = (termId: string): void => {
  const host = hosts.get(termId)
  if (!host) return
  host.observer.disconnect()
  host.term.dispose()
  hosts.delete(termId)
}

const openPty = async (tab: TermTab): Promise<void> => {
  await nextTick()
  const node = panelRoot.value?.querySelector(`[data-slot="${tab.slot}"]`)
  if (!(node instanceof HTMLElement)) throw new Error('terminal host is missing')
  const term = new Terminal({
    fontFamily: '"DejaVu Sans Mono", "Source Code Pro", monospace',
    fontSize: 13,
    theme: readTheme(),
    cursorBlink: true,
    convertEol: true
  })
  const fit = new FitAddon()
  term.loadAddon(fit)
  term.open(node)
  fit.fit()
  const observer = new ResizeObserver(() => {
    if (activeSlot.value !== tab.slot || !tab.termId || tab.exited != null) return
    fit.fit()
    window.term.resize(tab.termId, term.cols, term.rows)
  })
  observer.observe(node)
  let typed = ''
  term.onData((data) => {
    if (tab.exited != null) return
    if (!tab.termId) {
      typed += data
      return
    }
    window.term.input(tab.termId, data)
  })
  try {
    const created = await window.term.create({
      cols: Math.max(1, term.cols),
      rows: Math.max(1, term.rows)
    })
    tab.termId = created.termId
    tab.name = `${created.shell} ${tab.slot}`
    hosts.set(created.termId, { term, fit, observer })
    const pending = earlyData.get(created.termId)
    if (pending) {
      earlyData.delete(created.termId)
      term.write(pending)
    }
    if (earlyExit.has(created.termId)) {
      tab.exited = { code: earlyExit.get(created.termId) ?? null }
    }
    if (typed && tab.exited == null) window.term.input(created.termId, typed)
    if (tab.exited != null) term.options.disableStdin = true
    term.focus()
  } catch (error) {
    observer.disconnect()
    term.dispose()
    throw error
  }
}

const addTab = async (): Promise<void> => {
  const tab: TermTab = { slot: ++slotSeq, termId: '', name: String(slotSeq), exited: null }
  tabs.value = [...tabs.value, tab]
  activeSlot.value = tab.slot
  try {
    await openPty(tab)
  } catch {
    tabs.value = tabs.value.filter((item) => item.slot !== tab.slot)
    if (activeSlot.value === tab.slot) {
      activeSlot.value = tabs.value[tabs.value.length - 1]?.slot ?? null
    }
  }
}

const activate = (slot: number): void => {
  activeSlot.value = slot
  const tab = tabs.value.find((item) => item.slot === slot)
  nextTick(() => {
    if (tab) fitTab(tab)
    if (tab?.termId) hosts.get(tab.termId)?.term.focus()
  }).catch(() => undefined)
}

const closeTab = (tab: TermTab): void => {
  if (tab.termId && tab.exited == null) window.term.kill(tab.termId).catch(() => undefined)
  if (tab.termId) disposeHost(tab.termId)
  const rest = tabs.value.filter((item) => item.slot !== tab.slot)
  tabs.value = rest
  if (rest.length === 0) {
    activeSlot.value = null
    collapse()
    return
  }
  if (activeSlot.value === tab.slot) {
    activeSlot.value = rest[rest.length - 1]?.slot ?? null
    const next = rest[rest.length - 1]
    if (next) nextTick(() => fitTab(next)).catch(() => undefined)
  }
}

const clearScreen = (): void => {
  const tab = active.value
  if (!tab?.termId || tab.exited != null) return
  hosts.get(tab.termId)?.term.clear()
}

const restart = (): void => {
  const tab = active.value
  if (!tab || tab.exited == null) return
  if (tab.termId) disposeHost(tab.termId)
  tab.termId = ''
  tab.exited = null
  openPty(tab).catch(() => undefined)
}

const collapse = (): void => {
  layoutStore.TOGGLE_LAYOUT_ENTRY('showTerminalPanel')
  layoutStore.DISPATCH_LAYOUT_MENU_ITEMS()
}

const onDragStart = (event: MouseEvent): void => {
  if (event.button !== 0) return
  event.preventDefault()
  const origin = event.clientY
  const start = showTerminalPanel.value ? renderedHeight.value : 0

  const move = (ev: MouseEvent): void => {
    const next = start - (ev.clientY - origin)
    if (next < TERMINAL_COLLAPSE_BELOW) {
      if (showTerminalPanel.value) {
        layoutStore.SET_LAYOUT({ showTerminalPanel: false }, { scheduleBufferUpdate: false })
      }
      return
    }
    layoutStore.SET_LAYOUT({ showTerminalPanel: true }, { scheduleBufferUpdate: false })
    layoutStore.SET_TERMINAL_PANEL_HEIGHT(
      clampTerminalHeight(next, viewportHeight.value || 768),
      { scheduleBufferUpdate: false }
    )
  }
  const up = (): void => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    layoutStore.SET_TERMINAL_PANEL_HEIGHT(terminalPanelHeight.value)
    layoutStore.DISPATCH_LAYOUT_MENU_ITEMS()
    const tab = active.value
    if (tab) fitTab(tab)
  }

  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}

// Editor shortcuts are registered in the main process and swallow the key
// before xterm sees it. The panel toggle is the one shortcut that still runs.
const onFocusIn = (): void => {
  window.term.setFocused(true)
}

const onFocusOut = (event: FocusEvent): void => {
  const next = event.relatedTarget
  if (next instanceof Node && panelRoot.value?.contains(next)) return
  window.term.setFocused(false)
}

watch(showTerminalPanel, (open) => {
  if (!open) {
    window.term?.setFocused(false)
    return
  }
  if (tabs.value.length === 0) {
    addTab().catch(() => undefined)
    return
  }
  const tab = active.value
  if (tab) nextTick(() => fitTab(tab)).catch(() => undefined)
}, { immediate: true })

watch(() => [preferences.theme, preferences.customCss], () => {
  nextTick(() => paint()).catch(() => undefined)
})

onMounted(() => {
  offData = window.term.onData((termId, data) => {
    const host = hosts.get(termId)
    if (host) host.term.write(data)
    else earlyData.set(termId, (earlyData.get(termId) ?? '') + data)
  })
  offExit = window.term.onExit((termId, code) => {
    earlyExit.set(termId, code)
    const tab = tabs.value.find((item) => item.termId === termId)
    if (!tab) return
    tab.exited = { code }
    const host = hosts.get(termId)
    if (host) host.term.options.disableStdin = true
  })
})

onBeforeUnmount(() => {
  offData?.()
  offExit?.()
  window.term?.setFocused(false)
  for (const tab of tabs.value) {
    if (tab.termId && tab.exited == null) window.term.kill(tab.termId).catch(() => undefined)
    if (tab.termId) disposeHost(tab.termId)
  }
})
</script>

<style scoped>
.terminal-panel {
  flex: none;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.term-handle {
  flex: none;
  height: 6px;
  cursor: ns-resize;
  position: relative;
  z-index: 2;
}

.term-handle::after {
  content: '';
  position: absolute;
  left: 0;
  right: 0;
  top: 2px;
  height: 2px;
  background: transparent;
}

.term-handle:hover::after,
.term-handle.open::after {
  background: var(--iconColor);
}

.terminal {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--editorBgColor);
  color: var(--editorColor);
  border-top: 1px solid var(--itemBgColor);
}

.term-tabs {
  height: 28px;
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
  background: var(--sideBarBgColor);
  user-select: none;
  min-width: 0;
}

.term-tab {
  height: 28px;
  display: flex;
  align-items: stretch;
  flex: none;
  color: var(--sideBarColor);
  font-size: 12px;
}

.term-tab.active {
  color: var(--sideBarTitleColor);
  box-shadow: inset 0 -2px 0 var(--themeColor);
}

.term-tab-name,
.term-tab-x,
.term-plus,
.term-text {
  border: none;
  background: none;
  color: inherit;
  cursor: pointer;
  font: inherit;
}

.term-tab-name {
  height: 28px;
  padding: 0 4px 0 10px;
}

.term-tab-x,
.term-plus {
  width: 22px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--sideBarIconColor);
}

.term-tab-x svg,
.term-plus svg {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.3;
  stroke-linecap: round;
}

.term-plus {
  width: 28px;
}

.term-cwd {
  flex: 1;
  min-width: 0;
  margin-left: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  color: var(--editorColor50);
}

.term-text {
  height: 28px;
  padding: 0 8px;
  font-size: 12px;
  color: var(--sideBarTitleColor);
}

.term-text:disabled {
  cursor: default;
  opacity: 0.45;
}

.term-tab-name:focus-visible,
.term-tab-x:focus-visible,
.term-plus:focus-visible,
.term-text:focus-visible {
  outline: 1px solid var(--themeColor);
  outline-offset: -1px;
}

.term-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.term-host {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.term-host :deep(.xterm) {
  height: 100%;
  padding: 4px 8px 0;
}

.term-exit {
  flex: none;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 10px;
  font-size: 12px;
  background: var(--sideBarBgColor);
  border-top: 1px solid var(--editorColor10);
}

.term-exit.failed {
  color: #b42318;
}

:global(body.dark) .term-exit.failed {
  color: #ffb4ab;
}
</style>
