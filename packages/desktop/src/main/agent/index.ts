import { BrowserWindow, ipcMain } from 'electron'
import type { HarnessStatus } from '@shared/types/agent'
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

export const registerAgentIpc = (): void => {
  ipcMain.handle('mt::agent::get-repo-state', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (!win) return { kind: 'none' as const }
    return repoRegistry.state(win.id)
  })
}
