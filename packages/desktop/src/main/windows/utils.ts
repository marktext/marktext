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

/**
 * Resolve the position and size to use when (re)opening a window.
 *
 * The window is restored onto the display that contains its saved position (or
 * the primary display on first start, or when the saved position is off every
 * display). Its size is clamped to that display's work area so a window whose
 * saved size exceeds the screen never opens larger than the screen and covers
 * the taskbar. A saved position is kept but nudged so the window stays fully
 * within the work area; with no saved position the window is centered.
 *
 * @param windowState The persisted window bounds (from electron-window-state).
 * @returns The position and size to apply to the BrowserWindow.
 */
export const ensureWindowPosition = (
  windowState: WindowStateLike
): { x: number; y: number; width: number; height: number } => {
  const displays = screen.getAllDisplays()

  let { x, y, width, height } = windowState

  // Determine the display the window will be restored on: the one whose bounds
  // contain the saved top-left corner. Fall back to the primary display on
  // first start (no saved position) or when the saved position lies outside
  // every display (those are re-centered below).
  const savedX = x
  const savedY = y
  const savedDisplay =
    savedX === undefined || savedY === undefined
      ? undefined
      : displays.find(
        (display) =>
          // Half-open bounds: a point on a shared edge (e.g. savedX ===
          // display.bounds.x + width) belongs to the neighbouring display.
          savedX >= display.bounds.x &&
            savedX < display.bounds.x + display.bounds.width &&
            savedY >= display.bounds.y &&
            savedY < display.bounds.y + display.bounds.height
      )
  const targetDisplay = savedDisplay ?? screen.getPrimaryDisplay()

  // "workArea" doesn't work on Linux
  const screenArea = isLinux ? targetDisplay.bounds : targetDisplay.workArea

  // Clamp the restored size to the target display's work area. The saved size
  // can exceed that screen (for example the window was last used on a larger
  // display, or the display scale factor changed), which would otherwise open
  // the window larger than the screen and cover the taskbar. This check
  // previously ran only on first start (when x/y are undefined); run it on
  // every launch. See #2928.
  if (screenArea.width < width) width = screenArea.width
  if (screenArea.height < height) height = screenArea.height

  if (savedX === undefined || savedY === undefined || savedDisplay === undefined) {
    // First start, or the saved position is off every display: center the
    // (clamped) window on the target display.
    x = Math.ceil(screenArea.x + (screenArea.width - width) / 2)
    y = Math.ceil(screenArea.y + (screenArea.height - height) / 2)
  } else {
    // Returning to a known display: keep the saved position, but nudge it so
    // the (clamped) window stays fully within the display's work area.
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
