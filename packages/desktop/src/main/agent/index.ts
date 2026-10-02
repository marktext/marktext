import { randomUUID } from 'crypto'
import { BrowserWindow, ipcMain } from 'electron'
import log from 'electron-log'
import type { HarnessStatus } from '@shared/types/agent'
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
import { getUserName } from './repo/gitService'
import { repoRegistry } from './repo/repoRegistry'
import { onInternalChannel } from '../utils/internalIpc'

let harnessStatuses: HarnessStatus[] = []

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
}

const repoOf = (windowId: number): string | null => {
  const state = repoRegistry.state(windowId)
  return state.kind === 'repo' ? state.root : null
}

export const registerAgentIpc = (deps?: AgentIpcDeps): void => {
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

  ipcMain.handle('mt::comments::mutate', async(event, mutation: CommentsMutation) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) throw new CommentsServiceError('not_a_repo', 'no window')
    const root = repoOf(win.id)
    if (!root) throw new CommentsServiceError('not_a_repo', 'the window has no repository')
    return commentsService().apply(win.id, root, mutation)
  })
}
