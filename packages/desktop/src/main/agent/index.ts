import { randomUUID } from 'crypto'
import { BrowserWindow, ipcMain } from 'electron'
import type { HarnessStatus } from '@shared/types/agent'
import { COMMENTS_FILE_VERSION, type CommentsMutation } from '@shared/types/comments'
import { bindCommentsService, CommentsServiceError, commentsService } from './comments/commentsService'
import { load } from './comments/commentsStore'
import { windowTurn } from './comments/windowTurn'
import { getUserName } from './repo/gitService'
import { repoRegistry } from './repo/repoRegistry'

let harnessStatuses: HarnessStatus[] = []

/** Statuses last published by the harness registry. Empty until that registry exists. */
export const currentHarnessStatuses = (): HarnessStatus[] => harnessStatuses

export const replaceHarnessStatuses = (next: HarnessStatus[]): void => {
  harnessStatuses = next
}

export const sendHarnessStatus = (win: BrowserWindow): void => {
  if (win.isDestroyed()) return
  win.webContents.send('mt::agent::harness-status-changed', currentHarnessStatuses())
}

const repoOf = (windowId: number): string | null => {
  const state = repoRegistry.state(windowId)
  return state.kind === 'repo' ? state.root : null
}

export const registerAgentIpc = (): void => {
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
