import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import bus from '../bus'
import {
  AGENT_PANEL_DEFAULT,
  AGENT_PANEL_MAX,
  AGENT_PANEL_MIN,
  TERMINAL_HEIGHT_DEFAULT,
  TERMINAL_HEIGHT_MIN,
  fitAgentPanel
} from '@/agent/chrome/fit'
import { useAgentStore } from './agent'
import { usePreferencesStore } from './preferences'
import { debouncedSendBufferedState } from './bufferedState'

type AgentPanelTab = 'comments' | 'chat'
type LayoutToggle = 'showSideBar' | 'showTabBar' | 'showAgentPanel' | 'showTerminalPanel'

interface LayoutPartial {
  rightColumn?: string
  showSideBar?: boolean
  showTabBar?: boolean
  sideBarWidth?: number | string
  showAgentPanel?: boolean
  agentPanelTab?: AgentPanelTab
  agentPanelWidth?: number | string
  showTerminalPanel?: boolean
  terminalPanelHeight?: number | string
}

interface SetLayoutOptions {
  scheduleBufferUpdate?: boolean
}

const normalizeSideBarWidth = (width: unknown): number => {
  const numericWidth = Number(width)
  return Number.isFinite(numericWidth) ? Math.max(numericWidth, 220) : 280
}

const normalizeAgentPanelWidth = (width: unknown): number => {
  const numericWidth = Number(width)
  if (!Number.isFinite(numericWidth)) return AGENT_PANEL_DEFAULT
  return Math.min(AGENT_PANEL_MAX, Math.max(AGENT_PANEL_MIN, numericWidth))
}

const normalizeTerminalHeight = (height: unknown): number => {
  const numericHeight = Number(height)
  if (!Number.isFinite(numericHeight)) return TERMINAL_HEIGHT_DEFAULT
  return Math.max(TERMINAL_HEIGHT_MIN, numericHeight)
}

const normalizeAgentPanelTab = (tab: unknown): AgentPanelTab =>
  tab === 'chat' ? 'chat' : 'comments'

interface BufferedLayout {
  rightColumn: string | undefined
  showSideBar: boolean
  showTabBar: boolean
  sideBarWidth: number
  showAgentPanel: boolean
  agentPanelTab: AgentPanelTab
  agentPanelWidth: number
  showTerminalPanel: boolean
  terminalPanelHeight: number
}

const createBufferedLayoutState = (state: unknown): BufferedLayout | null => {
  if (!state || typeof state !== 'object') return null
  const s = state as LayoutPartial

  // Pass through `rightColumn` (may be undefined). The pre-migration JS did
  // not coerce to 'files' here — RESTORE_BUFFERED_STATE then routes through
  // SET_LAYOUT which only assigns when the key is defined.
  return {
    rightColumn: s.rightColumn,
    showSideBar: !!s.showSideBar,
    showTabBar: !!s.showTabBar,
    sideBarWidth: normalizeSideBarWidth(s.sideBarWidth),
    showAgentPanel: 'showAgentPanel' in s ? !!s.showAgentPanel : true,
    agentPanelTab: normalizeAgentPanelTab(s.agentPanelTab),
    agentPanelWidth: normalizeAgentPanelWidth(s.agentPanelWidth),
    showTerminalPanel: !!s.showTerminalPanel,
    terminalPanelHeight: normalizeTerminalHeight(s.terminalPanelHeight)
  }
}

const initialWidth = localStorage.getItem('side-bar-width')
const initialSideBarWidth = normalizeSideBarWidth(initialWidth)
const initialAgentPanelWidth = normalizeAgentPanelWidth(localStorage.getItem('agent-panel-width'))
const initialTerminalHeight = normalizeTerminalHeight(localStorage.getItem('terminal-panel-height'))

export const useLayoutStore = defineStore('layout', () => {
  const rightColumn = ref<string>('files')
  const showSideBar = ref(false)
  const showTabBar = ref(false)
  const sideBarWidth = ref<number>(initialSideBarWidth)
  const showAgentPanel = ref(true)
  const agentPanelTab = ref<AgentPanelTab>('comments')
  const agentPanelWidth = ref<number>(initialAgentPanelWidth)
  const showTerminalPanel = ref(false)
  const terminalPanelHeight = ref<number>(initialTerminalHeight)
  const viewportWidth = ref(window.innerWidth || 1366)
  const viewportHeight = ref(window.innerHeight || 768)

  // Actual rendered sidebar width. `sideBarWidth` is the right-column width
  // (clamped to ≥220 by `normalizeSideBarWidth`); when `rightColumn` is empty
  // the sidebar collapses to its 45px icon strip. Consumers that need to
  // subtract the sidebar from viewport space must use this, not the raw ref.
  const effectiveSideBarWidth = computed<number>(() => {
    if (!showSideBar.value) return 0
    if (!rightColumn.value) return 45
    return Number(sideBarWidth.value)
  })

  const agentPanelFit = computed(() => {
    return fitAgentPanel({
      windowWidth: viewportWidth.value,
      sideBarWidth: effectiveSideBarWidth.value,
      requestedWidth: agentPanelWidth.value,
      shown: useAgentStore().agentAvailable && showAgentPanel.value
    })
  })

  const effectiveAgentWidth = computed(() => agentPanelFit.value.width)
  const agentPanelRail = computed(() => agentPanelFit.value.rail)
  const agentPanelDeficit = computed(() => agentPanelFit.value.deficit)

  function SET_LAYOUT(
    layout: LayoutPartial,
    { scheduleBufferUpdate = true }: SetLayoutOptions = {}
  ): void {
    if (layout.showSideBar !== undefined) {
      const { windowId } = window.marktext?.env ?? {}
      window.electron.ipcRenderer.send(
        'mt::update-sidebar-menu',
        Number(windowId),
        !!layout.showSideBar
      )
      const preferencesStore = usePreferencesStore()
      preferencesStore.SET_SINGLE_PREFERENCE({
        type: 'sideBarVisibility',
        value: !!layout.showSideBar
      })
    }
    // Match the pre-migration `Object.assign(this, layout)` semantics: assign
    // each known field as-is (no normalization here; SET_SIDE_BAR_WIDTH owns
    // sideBarWidth's normalization), and skip unknown keys silently.
    if (layout.rightColumn !== undefined) rightColumn.value = layout.rightColumn
    if (layout.showSideBar !== undefined) showSideBar.value = !!layout.showSideBar
    if (layout.showTabBar !== undefined) showTabBar.value = !!layout.showTabBar
    if (layout.sideBarWidth !== undefined) sideBarWidth.value = layout.sideBarWidth as number
    if (layout.showAgentPanel !== undefined) showAgentPanel.value = !!layout.showAgentPanel
    if (layout.agentPanelTab !== undefined) {
      agentPanelTab.value = normalizeAgentPanelTab(layout.agentPanelTab)
    }
    if (layout.showTerminalPanel !== undefined) showTerminalPanel.value = !!layout.showTerminalPanel
    if (scheduleBufferUpdate) {
      debouncedSendBufferedState()
    }
  }

  function CREATE_BUFFERED_STATE(): BufferedLayout | null {
    return createBufferedLayoutState({
      rightColumn: rightColumn.value,
      showSideBar: showSideBar.value,
      showTabBar: showTabBar.value,
      sideBarWidth: sideBarWidth.value,
      showAgentPanel: showAgentPanel.value,
      agentPanelTab: agentPanelTab.value,
      agentPanelWidth: agentPanelWidth.value,
      showTerminalPanel: showTerminalPanel.value,
      terminalPanelHeight: terminalPanelHeight.value
    })
  }

  function RESTORE_BUFFERED_STATE(state: unknown): void {
    const layout = createBufferedLayoutState(state)
    if (!layout) return

    SET_SIDE_BAR_WIDTH(layout.sideBarWidth, { scheduleBufferUpdate: false })
    SET_AGENT_PANEL_WIDTH(layout.agentPanelWidth, { scheduleBufferUpdate: false })
    SET_TERMINAL_PANEL_HEIGHT(layout.terminalPanelHeight, { scheduleBufferUpdate: false })
    SET_LAYOUT(
      {
        rightColumn: layout.rightColumn,
        showSideBar: layout.showSideBar,
        showTabBar: layout.showTabBar,
        showAgentPanel: layout.showAgentPanel,
        agentPanelTab: layout.agentPanelTab,
        showTerminalPanel: layout.showTerminalPanel
      },
      { scheduleBufferUpdate: false }
    )
    DISPATCH_LAYOUT_MENU_ITEMS()
  }

  function TOGGLE_LAYOUT_ENTRY(entryName: LayoutToggle): void {
    if (
      (entryName === 'showAgentPanel' || entryName === 'showTerminalPanel') &&
      !useAgentStore().agentAvailable
    ) {
      return
    }

    if (entryName === 'showSideBar') {
      showSideBar.value = !showSideBar.value
      const preferencesStore = usePreferencesStore()
      preferencesStore.SET_SINGLE_PREFERENCE({
        type: 'sideBarVisibility',
        value: !!showSideBar.value
      })
    } else if (entryName === 'showTabBar') {
      showTabBar.value = !showTabBar.value
    } else if (entryName === 'showAgentPanel') {
      showAgentPanel.value = !showAgentPanel.value
    } else if (entryName === 'showTerminalPanel') {
      showTerminalPanel.value = !showTerminalPanel.value
    }
    debouncedSendBufferedState()
  }

  function SET_SIDE_BAR_WIDTH(
    width: number | string,
    { scheduleBufferUpdate = true }: SetLayoutOptions = {}
  ): void {
    const normalizedWidth = normalizeSideBarWidth(width)
    localStorage.setItem('side-bar-width', String(normalizedWidth))
    sideBarWidth.value = normalizedWidth
    if (scheduleBufferUpdate) {
      debouncedSendBufferedState()
    }
  }

  function SET_AGENT_PANEL_WIDTH(
    width: number | string,
    { scheduleBufferUpdate = true }: SetLayoutOptions = {}
  ): void {
    const normalizedWidth = normalizeAgentPanelWidth(width)
    localStorage.setItem('agent-panel-width', String(normalizedWidth))
    agentPanelWidth.value = normalizedWidth
    if (scheduleBufferUpdate) {
      debouncedSendBufferedState()
    }
  }

  function SET_TERMINAL_PANEL_HEIGHT(
    height: number | string,
    { scheduleBufferUpdate = true }: SetLayoutOptions = {}
  ): void {
    const normalizedHeight = normalizeTerminalHeight(height)
    localStorage.setItem('terminal-panel-height', String(normalizedHeight))
    terminalPanelHeight.value = normalizedHeight
    if (scheduleBufferUpdate) {
      debouncedSendBufferedState()
    }
  }

  function layoutToggleValue(entryName: LayoutToggle): boolean {
    if (entryName === 'showSideBar') return showSideBar.value
    if (entryName === 'showTabBar') return showTabBar.value
    if (entryName === 'showAgentPanel') return showAgentPanel.value
    return showTerminalPanel.value
  }

  function LISTEN_FOR_LAYOUT(): void {
    const onResize = (): void => {
      viewportWidth.value = window.innerWidth
      viewportHeight.value = window.innerHeight
    }
    window.addEventListener('resize', onResize)

    watch(
      () => useAgentStore().agentAvailable,
      () => {
        DISPATCH_LAYOUT_MENU_ITEMS()
      },
      { immediate: true }
    )

    window.electron.ipcRenderer.on('mt::set-view-layout', (_e, layout) => {
      const l = layout as unknown as LayoutPartial
      if (l.rightColumn) {
        SET_LAYOUT({
          ...l,
          rightColumn: l.rightColumn === rightColumn.value ? '' : l.rightColumn,
          showSideBar: true
        })
      } else {
        SET_LAYOUT(l)
      }
      DISPATCH_LAYOUT_MENU_ITEMS()
    })

    window.electron.ipcRenderer.on('mt::toggle-view-layout-entry', (_e, entryName) => {
      TOGGLE_LAYOUT_ENTRY(entryName as LayoutToggle)
      DISPATCH_LAYOUT_MENU_ITEMS()
    })

    bus.on('view:toggle-layout-entry', (entryName: unknown) => {
      const name = entryName as LayoutToggle
      TOGGLE_LAYOUT_ENTRY(name)
      const { windowId } = window.marktext?.env ?? {}
      window.electron.ipcRenderer.send('mt::view-layout-changed', Number(windowId), {
        [name]: layoutToggleValue(name)
      })
    })
  }

  function DISPATCH_LAYOUT_MENU_ITEMS(): void {
    const { windowId } = window.marktext?.env ?? {}
    window.electron.ipcRenderer.send('mt::view-layout-changed', Number(windowId), {
      showTabBar: showTabBar.value,
      showSideBar: showSideBar.value,
      showAgentPanel: showAgentPanel.value,
      showTerminalPanel: showTerminalPanel.value,
      agentAvailable: useAgentStore().agentAvailable
    })
  }

  function CHANGE_SIDE_BAR_WIDTH(width: number | string): void {
    SET_SIDE_BAR_WIDTH(width)
  }

  return {
    rightColumn,
    showSideBar,
    showTabBar,
    sideBarWidth,
    effectiveSideBarWidth,
    showAgentPanel,
    agentPanelTab,
    agentPanelWidth,
    showTerminalPanel,
    terminalPanelHeight,
    viewportHeight,
    effectiveAgentWidth,
    agentPanelRail,
    agentPanelDeficit,
    SET_LAYOUT,
    CREATE_BUFFERED_STATE,
    RESTORE_BUFFERED_STATE,
    TOGGLE_LAYOUT_ENTRY,
    SET_SIDE_BAR_WIDTH,
    SET_AGENT_PANEL_WIDTH,
    SET_TERMINAL_PANEL_HEIGHT,
    LISTEN_FOR_LAYOUT,
    DISPATCH_LAYOUT_MENU_ITEMS,
    CHANGE_SIDE_BAR_WIDTH
  }
})
