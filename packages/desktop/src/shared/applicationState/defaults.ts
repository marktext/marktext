import { SessionLifecycle } from '../types/applicationState'
import type { ApplicationState, WindowLayoutState } from '../types/applicationState'

export const createDefaultLayout = (
  preferences: { tocPosition: 'left' | 'right'; sourceCodeModeEnabled: boolean } = {
    tocPosition: 'left',
    sourceCodeModeEnabled: false
  }
): WindowLayoutState => ({
  sidebar: {
    visible: false,
    activeView: 'files',
    preferredWidthPx: 280,
    openedFiles: { expanded: true, preferredHeightPx: 112 }
  },
  outline: { visible: true, position: preferences.tocPosition, preferredWidthPx: 220 },
  tabBar: { visible: false },
  modes: { sourceCode: preferences.sourceCodeModeEnabled, focus: false, typewriter: false }
})

export const createEmptyApplicationState = (
  sessionId: string,
  nowMs: number
): ApplicationState => ({
  schemaVersion: 1,
  revision: 0,
  updatedAtMs: nowMs,
  session: {
    id: sessionId,
    lifecycle: SessionLifecycle.RUNNING,
    windows: [],
    activeWindowId: null,
    lastWindow: null
  },
  lastActiveWorkspaceId: null,
  recentWorkspaces: [],
  recentEmptyWindowLayout: null
})
