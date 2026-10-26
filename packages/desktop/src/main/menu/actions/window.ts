import { Menu, ipcMain, type BrowserWindow } from 'electron'
import { WINDOW_OPACITY_MAX, WINDOW_OPACITY_STEP } from '@shared/types/preferences'
import { isOsx } from '../../config'
import { COMMANDS } from '../../commands'
import { clampWindowOpacity, zoomIn, zoomOut, resetZoom } from '../../windows/utils'
import type { CommandManager } from '../../commands'
import type Preference from '../../preferences'

const adjustWindowOpacity = (
  win: BrowserWindow | null | undefined,
  preferences: Preference,
  delta: number
): void => {
  if (!win) return
  const current = preferences.getItem<number>('windowOpacity') ?? WINDOW_OPACITY_MAX
  const next = clampWindowOpacity(current + delta)
  if (next !== current) {
    preferences.setItem('windowOpacity', next)
  }
}

export const increaseWindowOpacity = (
  win: BrowserWindow | null | undefined,
  preferences: Preference
): void => {
  adjustWindowOpacity(win, preferences, WINDOW_OPACITY_STEP)
}

export const decreaseWindowOpacity = (
  win: BrowserWindow | null | undefined,
  preferences: Preference
): void => {
  adjustWindowOpacity(win, preferences, -WINDOW_OPACITY_STEP)
}

export const minimizeWindow = (win: BrowserWindow | null | undefined): void => {
  if (win) {
    if (isOsx) {
      Menu.sendActionToFirstResponder('performMiniaturize:')
    } else {
      win.minimize()
    }
  }
}

export const toggleAlwaysOnTop = (win: BrowserWindow | null | undefined): void => {
  if (win) {
    ipcMain.emit('window-toggle-always-on-top', win)
  }
}

export const toggleFullScreen = (win: BrowserWindow | null | undefined): void => {
  if (win) {
    win.setFullScreen(!win.isFullScreen())
  }
}


export const loadWindowCommands = (
  commandManager: CommandManager,
  preferences: Preference
): void => {
  commandManager.add(COMMANDS.WINDOW_MINIMIZE, minimizeWindow)
  commandManager.add(COMMANDS.WINDOW_TOGGLE_ALWAYS_ON_TOP, toggleAlwaysOnTop)
  commandManager.add(COMMANDS.WINDOW_TOGGLE_FULL_SCREEN, toggleFullScreen)
  commandManager.add(COMMANDS.WINDOW_ZOOM_IN, zoomIn)
  commandManager.add(COMMANDS.WINDOW_ZOOM_RESET, resetZoom)
  commandManager.add(COMMANDS.WINDOW_ZOOM_OUT, zoomOut)
  commandManager.add(COMMANDS.WINDOW_INCREASE_OPACITY, (win: BrowserWindow | null | undefined) =>
    increaseWindowOpacity(win, preferences)
  )
  commandManager.add(COMMANDS.WINDOW_DECREASE_OPACITY, (win: BrowserWindow | null | undefined) =>
    decreaseWindowOpacity(win, preferences)
  )
}
