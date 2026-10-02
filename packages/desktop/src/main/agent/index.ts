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
import { windowTurn } from './comments/windowTurn'
import {
  changedHarnessIds,
  getHarnessStatus,
  harnessPathsFromPreferences,
  invalidateHarnessStatus
} from './harness/harnessRegistry'
import { listModels } from './harness/modelProbe'
import { answerPermission } from './harness/permissionGate'
import { getUserName } from './repo/gitService'
import { repoRegistry } from './repo/repoRegistry'
import { recordEditorSave } from './turn/changeTracker'
import { TurnRunner } from './turn/turnRunner'
import type { ThreadPlacement } from './turn/messageBuilder'
import { setWindowAgentHost } from './windowAgentHost'
import { onInternalChannel } from '../utils/internalIpc'

let harnessStatuses: HarnessStatus[] = []
let editorSavesHooked = false

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

const turnRunnerFor = (windowId: number, deps?: AgentIpcDeps): TurnRunner => {
  const existing = turnRunners.get(windowId)
  if (existing) return existing
  const runner = new TurnRunner({
    modeEnabled: () => deps?.harnessPath('agentModeEnabled') !== false,
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
    disposePty: () => Promise.resolve()
  })
  return runner
}

const repoOf = (windowId: number): string | null => {
  const state = repoRegistry.state(windowId)
  return state.kind === 'repo' ? state.root : null
}

export const registerAgentIpc = (deps?: AgentIpcDeps): void => {
  hookEditorSaves()
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

  ipcMain.handle('mt::agent::answer-permission', (_event, requestId: string, optionId: string) => {
    answerPermission(requestId, optionId)
  })

  ipcMain.handle('mt::agent::list-models', async(event, harness: unknown, options: { refresh?: boolean }) => {
    if (!isHarnessId(harness)) return { ok: false as const, reason: 'init_failed' as const }
    const win = BrowserWindow.fromWebContents(event.sender)
    const paths = readHarnessPaths()
    const cacheFile = path.join(deps?.userDataPath || os.tmpdir(), 'agent', 'model-cache.json')
    return listModels({
      harness,
      refresh: options?.refresh === true,
      repoRoot: win ? repoOf(win.id) : null,
      configuredPath: paths[harness] ?? '',
      cacheFile
    })
  })

  ipcMain.handle('mt::agent::get-harness-status', async() => {
    const statuses = await getHarnessStatus(readHarnessPaths())
    replaceHarnessStatuses(statuses)
    return statuses
  })

  onInternalChannel('broadcast-preferences-changed', (change: object) => {
    const ids = changedHarnessIds(change)
    if (ids.length === 0) return
    invalidateHarnessStatus(ids)
    getHarnessStatus(readHarnessPaths())
      .then(publishHarnessStatus)
      .catch((err: unknown) => {
        log.error(err)
      })
  })

  if (deps) {
    getHarnessStatus(readHarnessPaths())
      .then(publishHarnessStatus)
      .catch((err: unknown) => {
        log.error(err)
      })
  }

  ipcMain.handle('mt::agent::get-repo-state', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { kind: 'none' as const }
    return repoRegistry.state(win.id)
  })

  ipcMain.handle('mt::comments::load', async(event, file: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { kind: 'parse_error' as const, path: file, message: 'no window' }
    const root = repoOf(win.id)
    if (!root) return { kind: 'ok' as const, file: { version: COMMENTS_FILE_VERSION, file, threads: [] } }
    return load(root, file)
  })

  ipcMain.handle('mt::agent::send-threads', (event, file: string, threadIds: string[], anchors: ThreadPlacement[]) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return Promise.reject(new Error('no window'))
    return turnRunnerFor(win.id, deps).sendThreads(win.id, file, threadIds ?? [], anchors ?? [])
  })

  ipcMain.handle('mt::agent::send-message', (event, text: string) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return Promise.reject(new Error('no window'))
    return turnRunnerFor(win.id, deps).sendMessage(win.id, text)
  })

  ipcMain.handle('mt::agent::cancel-turn', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return Promise.resolve()
    return turnRunnerFor(win.id, deps).cancelTurn()
  })

  ipcMain.handle('mt::comments::mutate', async(event, mutation: CommentsMutation) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) throw new CommentsServiceError('not_a_repo', 'no window')
    const root = repoOf(win.id)
    if (!root) throw new CommentsServiceError('not_a_repo', 'the window has no repository')
    return commentsService().apply(win.id, root, mutation)
  })
}
