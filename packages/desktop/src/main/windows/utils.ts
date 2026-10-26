import { screen } from 'electron'
import type { BrowserWindow, BrowserWindowConstructorOptions } from 'electron'
import { isLinux } from '../config'

export const zoomIn = (win: BrowserWindow | null | undefined): void => {
  if (!win) return
  const { webContents } = win
  const zoom = webContents.getZoomFactor()
  // WORKAROUND: We need to set zoom on the browser window due to Electron#16018.
  webContents.send('mt::window-zoom', Math.min(2.0, zoom + 0.125))
}

export const zoomOut = (win: BrowserWindow | null | undefined): void => {
  if (!win) return
  const { webContents } = win
  const zoom = webContents.getZoomFactor()
  // WORKAROUND: We need to set zoom on the browser window due to Electron#16018.
  webContents.send('mt::window-zoom', Math.max(0.5, zoom - 0.125))
}

export const resetZoom = (win: BrowserWindow | null | undefined): void => {
  if (!win) return
  const { webContents } = win
  // WORKAROUND: We need to set zoom on the browser window due to Electron#16018.
  webContents.send('mt::window-zoom', 1.0)
}

export const centerWindowOptions = (
  options: BrowserWindowConstructorOptions & {
    width: number
    height: number
    x?: number
    y?: number
  }
): void => {
  // "workArea" doesn't work on Linux
  const { bounds, workArea } = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  const screenArea = isLinux ? bounds : workArea
  const { width, height } = options
  options.x = Math.ceil(screenArea.x + (screenArea.width - width) / 2)
  options.y = Math.ceil(screenArea.y + (screenArea.height - height) / 2)
}

export interface WindowStateLike {
  x?: number
  y?: number
  width: number
  height: number
}

export const ensureWindowPosition = (
  windowState: WindowStateLike
): { x: number; y: number; width: number; height: number } => {
  const displays = screen.getAllDisplays()

  let { x, y, width, height } = windowState

  const savedX = x
  const savedY = y
  const savedDisplay =
    savedX === undefined || savedY === undefined
      ? undefined
      : displays.find(
        (display) =>
          // Shared edges belong to the neighbouring display.
          savedX >= display.bounds.x &&
            savedX < display.bounds.x + display.bounds.width &&
            savedY >= display.bounds.y &&
            savedY < display.bounds.y + display.bounds.height
      )
  const targetDisplay = savedDisplay ?? screen.getPrimaryDisplay()

  // "workArea" doesn't work on Linux
  const screenArea = isLinux ? targetDisplay.bounds : targetDisplay.workArea

  if (screenArea.width < width) width = screenArea.width
  if (screenArea.height < height) height = screenArea.height

  if (savedX === undefined || savedY === undefined || savedDisplay === undefined) {
    x = Math.ceil(screenArea.x + (screenArea.width - width) / 2)
    y = Math.ceil(screenArea.y + (screenArea.height - height) / 2)
  } else {
    x = Math.min(Math.max(savedX, screenArea.x), screenArea.x + screenArea.width - width)
    y = Math.min(Math.max(savedY, screenArea.y), screenArea.y + screenArea.height - height)
  }
  return {
    x: x as number,
    y: y as number,
    width,
    height
  }
}
