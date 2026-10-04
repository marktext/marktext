import { randomUUID } from 'crypto'
import os from 'os'
import path from 'path'
import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import type { HarnessStatus } from '@shared/types/agent'
import { isHarnessId } from '@shared/types/agent'
import { COMMENTS_FILE_VERSION, type CommentsMutation } from '@shared/types/comments'
import { bindCommentsService, CommentsServiceError, commentsService } from './comments/commentsService'
import { load } from './comments/commentsStore'
import { anyTurnRunning, onAnyTurnChange, windowTurn } from './comments/windowTurn'
import {
  changedHarnessIds,
  getHarnessStatus,
  harnessPathsFromPreferences,
  invalidateHarnessStatus
} from './harness/harnessRegistry'
import { forgetCachedModels, listModels } from './harness/modelProbe'
import { answerPermission } from './harness/permissionGate'
import { GitDiffError, getUserName, worktreeDiff } from './repo/gitService'
import { repoRegistry } from './repo/repoRegistry'
import { recordEditorSave } from './turn/changeTracker'
import { PtyManager } from './terminal/ptyManager'
import { clearTerminalFocus, setTerminalFocused } from './terminal/terminalFocus'
import { TurnRunner, TurnRunnerError } from './turn/turnRunner'
import type { ThreadPlacement } from './turn/messageBuilder'
import { setWindowAgentHost, shutdownWindowAgent } from './windowAgentHost'
import { onInternalChannel } from '../utils/internalIpc'

let harnessStatuses: HarnessStatus[] = []
let editorSavesHooked = false
let turnPresenceHooked = false

/** First save, overwrite, and save-as all write a file the user asked for. */
const hookEditorSaves = (): void => {
  if (editorSavesHooked) return
  editorSavesHooked = true
  const note = (windowId: number, pathname: string): void => {
    recordEditorSave(windowId, pathname)
  }
  onInternalChannel('window-file-saved', note)
  onInternalChannel('window-add-file-path', note)
  onInternalChannel('window-change-file-path', note)
}

/** Statuses last published to windows. Empty until the first probe finishes. */
export const currentHarnessStatuses = (): HarnessStatus[] => harnessStatuses

export const replaceHarnessStatuses = (next: HarnessStatus[]): void => {
  harnessStatuses = next
}

export const sendHarnessStatus = (win: BrowserWindow): void => {
  if (win.isDestroyed()) return
  win.webContents.send('mt::agent::harness-status-changed', currentHarnessStatuses())
}

const publishHarnessStatus = (statuses: HarnessStatus[]): void => {
  replaceHarnessStatuses(statuses)
  for (const win of BrowserWindow.getAllWindows()) sendHarnessStatus(win)
}

export interface AgentIpcDeps {
  harnessPath: (key: string) => unknown
  userDataPath?: string
  appPath?: string
}

const turnRunners = new Map<number, TurnRunner>()
let terms: PtyManager | null = null

const turnRunnerFor = (windowId: number, deps?: AgentIpcDeps): TurnRunner => {
  const existing = turnRunners.get(windowId)
  if (existing) return existing
  const runner = new TurnRunner({
    modeEnabled: () => agentModeEnabled(deps),
    preference: (key) => deps?.harnessPath(key),
    userDataPath: deps?.userDataPath || os.tmpdir(),
    appPath: deps?.appPath || process.cwd(),
    now: () => new Date().toISOString(),
    newId: () => randomUUID(),
    onEvent: (targetId, event) => {
      const win = BrowserWindow.fromId(targetId)
      if (!win || win.isDestroyed()) return
      win.webContents.send('mt::agent::event', event)
    }
  })
  turnRunners.set(windowId, runner)
  setWindowAgentHost(windowId, {
    hasActiveTurn: () => runner.hasActiveTurn(),
    cancelTurn: () => runner.cancelTurn(),
    disposeHarness: () => runner.disposeHarness(),
    disposePty: () => {
      clearTerminalFocus(windowId)
      return terms?.disposeWindow(windowId) ?? Promise.resolve()
    }
  })
  return runner
}

const repoOf = (windowId: number): string | null => {
  const state = repoRegistry.state(windowId)
  return state.kind === 'repo' ? state.root : null
}

const agentModeEnabled = (deps?: AgentIpcDeps): boolean =>
  deps?.harnessPath('agentModeEnabled') !== false

const requireAgentMode = (deps?: AgentIpcDeps): void => {
  if (!agentModeEnabled(deps)) {
    throw new TurnRunnerError('agent_mode_disabled', 'agent mode is off')
  }
}

const stopAllAgents = (): Promise<void> => {
  const ids = [...turnRunners.keys()]
  return Promise.all(ids.map((windowId) =>
    shutdownWindowAgent(windowId).catch((err: unknown) => {
      log.error(err)
    })
  )).then(() => undefined)
}

export const registerAgentIpc = (deps?: AgentIpcDeps): void => {
  hookEditorSaves()
  terms = new PtyManager({
    shellPreference: () => deps?.harnessPath('agentTerminalShell'),
    repoRoot: repoOf,
    newId: () => randomUUID(),
    onData: (windowId, termId, data) => {
      const win = BrowserWindow.fromId(windowId)
      if (!win || win.isDestroyed()) return
      win.webContents.send('mt::term::data', termId, data)
    },
    onExit: (windowId, termId, code) => {
      const win = BrowserWindow.fromId(windowId)
      if (!win || win.isDestroyed()) return
      win.webContents.send('mt::term::exit', termId, code)
    }
  })
  bindCommentsService({
    now: () => new Date().toISOString(),
    newId: () => randomUUID(),
    userName: (root) => getUserName(root),
    turnOf: windowTurn,
    repoOf,
    onChanged: (root, file) => {
      const windowId = repoRegistry.owner(root)
      if (windowId == null) return
      const win = BrowserWindow.fromId(windowId)
      if (!win || win.isDestroyed()) return
      win.webContents.send('mt::comments::changed', { file })
    }
  })

  const readHarnessPaths = (): ReturnType<typeof harnessPathsFromPreferences> | Record<string, never> =>
    deps ? harnessPathsFromPreferences(deps.harnessPath) : {}

  const modelCachePath = (): string =>
    path.join(deps?.userDataPath || os.tmpdir(), 'agent', 'model-cache.json')

  const publishProbe = (): void => {
    getHarnessStatus(readHarnessPaths())
      .then(publishHarnessStatus)
      .catch((err: unknown) => {
        log.error(err)
      })
  }

  ipcMain.handle('mt::agent::answer-permission', (_event, requestId: string, optionId: string) => {
    requireAgentMode(deps)
    answerPermission(requestId, optionId)
  })

  ipcMain.handle('mt::agent::list-models', async(event, harness: unknown, options: { refresh?: boolean }) => {
    requireAgentMode(deps)
    if (!isHarnessId(harness)) return { ok: false as const, reason: 'init_failed' as const }
    const win = BrowserWindow.fromWebContents(event.sender)
    const paths = readHarnessPaths()
    return listModels({
      harness,
      refresh: options?.refresh === true,
      repoRoot: win ? repoOf(win.id) : null,
      configuredPath: paths[harness] ?? '',
      cacheFile: modelCachePath()
    })
  })

  ipcMain.handle('mt::agent::get-harness-status', async() => {
    requireAgentMode(deps)
    const statuses = await getHarnessStatus(readHarnessPaths())
    replaceHarnessStatuses(statuses)
    return statuses
  })

  ipcMain.handle('mt::agent::get-turn-active', () => anyTurnRunning())

  if (!turnPresenceHooked) {
    turnPresenceHooked = true
    onAnyTurnChange((active) => {
      for (const win of BrowserWindow.getAllWindows()) {
        if (!win.isDestroyed()) win.webContents.send('mt::agent::turn-active', active)
      }
    })
  }

  onInternalChannel('broadcast-preferences-changed', (change: object) => {
    const record = change as Record<string, unknown>
    if (record.agentModeEnabled === false) {
      stopAllAgents().catch((err: unknown) => {
        log.error(err)
      })
    }
    const ids = changedHarnessIds(change)
    if (ids.length > 0) {
      invalidateHarnessStatus(ids)
      forgetCachedModels(modelCachePath(), ids)
    }
    const turnedOn = record.agentModeEnabled === true
    if (isHarnessId(record.agentHarness)) {
      const next = record.agentHarness
      for (const runner of turnRunners.values()) {
        runner.applyHarnessPreference(next).catch((err: unknown) => {
          log.error(err)
        })
      }
    }
    if (!agentModeEnabled(deps) || (ids.length === 0 && !turnedOn)) return
    publishProbe()
  })

  if (deps && agentModeEnabled(deps)) publishProbe()

  ipcMain.handle('mt::agent::get-repo-state', (event) => {
    requireAgentMode(deps)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { kind: 'none' as const }
    return repoRegistry.state(win.id)
  })

  ipcMain.handle('mt::git::diff', (event, request: { paths?: string[] } | undefined) => {
    requireAgentMode(deps)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return Promise.reject(new Error('no window'))
    const root = repoOf(win.id)
    if (!root) return Promise.reject(new GitDiffError())
    return worktreeDiff(root, request?.paths)
  })

  ipcMain.handle('mt::term::create', (event, size: { cols?: number, rows?: number } | undefined) => {
    requireAgentMode(deps)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return Promise.reject(new Error('no window'))
    turnRunnerFor(win.id, deps)
    return terms?.create(win.id, { cols: size?.cols ?? 80, rows: size?.rows ?? 24 })
  })

  ipcMain.handle('mt::term::kill', (event, termId: string) => {
    requireAgentMode(deps)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || typeof termId !== 'string') return
    terms?.kill(win.id, termId)
  })

  ipcMain.on('mt::term::input', (event, termId: unknown, data: unknown) => {
    if (!agentModeEnabled(deps)) return
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || typeof termId !== 'string' || typeof data !== 'string') return
    terms?.input(win.id, termId, data)
  })

  ipcMain.on('mt::term::set-focused', (event, focused: unknown) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || typeof focused !== 'boolean') return
    setTerminalFocused(win.id, focused)
  })

  ipcMain.on('mt::term::resize', (event, termId: unknown, cols: unknown, rows: unknown) => {
    if (!agentModeEnabled(deps)) return
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win || typeof termId !== 'string' || typeof cols !== 'number' || typeof rows !== 'number') return
    terms?.resize(win.id, termId, cols, rows)
  })

  ipcMain.handle('mt::comments::load', async(event, file: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { kind: 'parse_error' as const, path: file, message: 'no window' }
    const root = repoOf(win.id)
    if (!root) return { kind: 'ok' as const, file: { version: COMMENTS_FILE_VERSION, file, threads: [] } }
    return load(root, file)
  })

  ipcMain.handle('mt::agent::send-threads', (event, file: string, threadIds: string[], anchors: ThreadPlacement[]) => {
    requireAgentMode(deps)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return Promise.reject(new Error('no window'))
    return turnRunnerFor(win.id, deps).sendThreads(win.id, file, threadIds ?? [], anchors ?? [])
  })

  ipcMain.handle('mt::agent::send-message', (event, text: string) => {
    requireAgentMode(deps)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return Promise.reject(new Error('no window'))
    return turnRunnerFor(win.id, deps).sendMessage(win.id, text)
  })

  ipcMain.handle('mt::agent::cancel-turn', (event) => {
    requireAgentMode(deps)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return Promise.resolve()
    return turnRunnerFor(win.id, deps).cancelTurn()
  })

  ipcMain.handle('mt::agent::get-selection', (event) => {
    requireAgentMode(deps)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return null
    return turnRunnerFor(win.id, deps).getSelection(win.id)
  })

  ipcMain.handle('mt::agent::set-selection', (event, model: unknown) => {
    requireAgentMode(deps)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return Promise.reject(new Error('no window'))
    if (typeof model !== 'string' || model.length === 0) {
      return Promise.reject(new Error('bad selection'))
    }
    return turnRunnerFor(win.id, deps).setSelection(win.id, model)
  })

  ipcMain.handle('mt::agent::list-sessions', (event, harness: unknown) => {
    requireAgentMode(deps)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return Promise.reject(new Error('no window'))
    if (!isHarnessId(harness)) return Promise.reject(new Error('bad harness'))
    return turnRunnerFor(win.id, deps).listSessions(win.id, harness)
  })

  ipcMain.handle('mt::agent::open-session', (event, harness: unknown, sessionId: unknown) => {
    requireAgentMode(deps)
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return Promise.reject(new Error('no window'))
    if (!isHarnessId(harness) || typeof sessionId !== 'string') {
      return Promise.reject(new Error('bad session'))
    }
    return turnRunnerFor(win.id, deps).openSession(win.id, harness, sessionId)
  })

  ipcMain.handle('mt::comments::mutate', async(event, mutation: CommentsMutation) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) throw new CommentsServiceError('not_a_repo', 'no window')
    const root = repoOf(win.id)
    if (!root) throw new CommentsServiceError('not_a_repo', 'the window has no repository')
    return commentsService().apply(win.id, root, mutation)
  })
}
