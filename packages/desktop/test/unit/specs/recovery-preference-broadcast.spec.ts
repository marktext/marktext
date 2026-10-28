// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
const electron = vi.hoisted(() => ({
  ipcMain: { on: vi.fn(), emit: vi.fn() },
  nativeTheme: { shouldUseDarkColors: false },
  BrowserWindow: { fromWebContents: vi.fn() }
}))
vi.mock('electron', () => electron)
vi.mock('electron-log', () => ({ default: { warn: vi.fn() } }))
import Preference from '../../../src/main/preferences'
const profiles: string[] = []
afterEach(() => {
  profiles.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true }))
  vi.clearAllMocks()
})
it('broadcasts only a successfully persisted preference update', () => {
  const path = mkdtempSync(join(tmpdir(), 'mt-preference-broadcast-'))
  profiles.push(path)
  const preferences = new Preference({ preferencesPath: path })
  preferences.setItem('restoreEditors', false)
  expect(electron.ipcMain.emit).toHaveBeenCalledExactlyOnceWith('broadcast-preferences-changed', {
    restoreEditors: false
  })
  preferences.setItem('restoreEditors', 'invalid')
  expect(electron.ipcMain.emit).toHaveBeenCalledTimes(1)
  writeFileSync(join(path, 'preferences.json'), '{broken')
  const broken = new Preference({ preferencesPath: path })
  broken.setItem('restoreEditors', false)
  expect(electron.ipcMain.emit).toHaveBeenCalledTimes(1)
})
