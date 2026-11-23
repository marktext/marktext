import { BrowserWindow, screen, type Rectangle } from 'electron'
import type { WindowGeometryState } from '@shared/types/applicationState'
import { fitWindowGeometry } from './windowGeometry'

/** Preview and transfer use the same fitted DIP bounds, including monitor work-area limits. */
export const detachedTabGeometry = (
  bounds: Rectangle,
  point: { x: number; y: number }
): WindowGeometryState =>
  fitWindowGeometry(
    {
      normalBounds: { ...bounds, x: point.x - 100, y: point.y - 16 },
      maximized: false,
      displayId: String(screen.getDisplayNearestPoint(point).id)
    },
    screen
      .getAllDisplays()
      .map((display) => ({ id: String(display.id), workArea: display.workArea })),
    String(screen.getPrimaryDisplay().id)
  )

const OUTLINE = `<!doctype html><html><head><meta charset="utf-8">
<title>MarkText tab window preview</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:transparent}
body{box-sizing:border-box;border:3px solid rgba(55,139,235,.85);border-radius:6px}</style>
</head><body></body></html>`

/** A mouse-transparent native outline; it never becomes an editor or receives transferred data. */
export class TabWindowPreview {
  private _window: BrowserWindow | null = null
  private _bounds: Rectangle | null = null
  private _ready = false
  private _failed = false

  get window(): BrowserWindow | null {
    return this._window
  }

  update(bounds: Rectangle | null): void {
    this._bounds = bounds
    if (!bounds) {
      this._window?.hide()
      return
    }
    if (this._failed) return
    if (!this._window) {
      const window = new BrowserWindow({
        ...bounds,
        title: 'MarkText tab window preview',
        frame: false,
        transparent: true,
        backgroundColor: '#00000000',
        show: false,
        focusable: false,
        skipTaskbar: true,
        alwaysOnTop: true,
        hasShadow: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        fullscreenable: false,
        roundedCorners: false,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
          javascript: false
        }
      })
      this._window = window
      window.setIgnoreMouseEvents(true)
      window.once('ready-to-show', () => {
        // Loading may finish after a drop or after the pointer returns to a tab strip.
        if (this._window !== window) return
        this._ready = true
        if (this._bounds) {
          window.setBounds(this._bounds)
          window.showInactive()
        }
      })
      void window
        .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(OUTLINE)}`)
        .catch(() => {
          if (this._window !== window) return
          this.destroy()
          this._failed = true
        })
    }
    if (this._ready) {
      const current = this._window.getBounds()
      if (
        Object.keys(bounds).some(
          (key) => current[key as keyof Rectangle] !== bounds[key as keyof Rectangle]
        )
      )
        this._window.setBounds(bounds)
      if (!this._window.isVisible()) this._window.showInactive()
    }
  }

  destroy(): void {
    const window = this._window
    this._window = null
    this._bounds = null
    this._ready = false
    this._failed = false
    if (window && !window.isDestroyed()) window.destroy()
  }
}
