import { app, BrowserWindow, screen, type Rectangle } from 'electron'
import { TabWindowPreview } from './tabWindowPreview'
import type EditorWindow from '../windows/editor'
import type { TabStripGeometry } from '@shared/types/tabTransfer'

/** Wayland delegates global window placement and pointer coordinates to the compositor. */
export const supportsTabScreenCoordinates = (
  platform: string,
  ozonePlatform: string,
  environment: Record<string, string | undefined>
): boolean => {
  if (platform !== 'linux' || ozonePlatform === 'x11') return true
  return (
    ozonePlatform !== 'wayland' &&
    environment.ELECTRON_OZONE_PLATFORM_HINT !== 'wayland' &&
    environment.XDG_SESSION_TYPE !== 'wayland' &&
    !environment.WAYLAND_DISPLAY
  )
}

const contains = (
  bounds: { x: number; y: number; width: number; height: number },
  point: { x: number; y: number }
): boolean =>
  point.x >= bounds.x &&
  point.x < bounds.x + bounds.width &&
  point.y >= bounds.y &&
  point.y < bounds.y + bounds.height

/** Pointer capture stays in the source renderer; native DIP coordinates locate other windows. */
export class TabDrag {
  private readonly _preview = new TabWindowPreview()
  private readonly _strips = new Map<string, TabStripGeometry>()
  private _painted: { windowId: string; beforeId: string | null } | null = null
  private _drag: {
    source: string
    documentId: string
    timer: ReturnType<typeof setInterval>
  } | null = null
  constructor(
    private readonly _editors: Map<string, EditorWindow>,
    private readonly _transfer: (
      source: string,
      documentId: string,
      target: string | null,
      beforeId: string | null,
      point: { x: number; y: number }
    ) => Promise<void>,
    private readonly _detachedBounds: (source: string, point: { x: number; y: number }) => Rectangle | null = () => null
  ) {}

  strip(windowId: string, geometry: TabStripGeometry | null): void {
    if (geometry === null) {
      this._strips.delete(windowId)
      return
    }
    if (
      !geometry ||
      !Array.isArray(geometry.tabs) ||
      geometry.tabs.some(
        (tab) => !tab || typeof tab.id !== 'string' || !Number.isFinite(tab.middle)
      )
    )
      return
    if (
      ![geometry.left, geometry.top, geometry.right, geometry.bottom].every(Number.isFinite) ||
      geometry.left >= geometry.right ||
      geometry.top >= geometry.bottom
    )
      return
    this._strips.set(windowId, geometry)
  }

  canBegin(): boolean {
    return (
      this._drag === null &&
      supportsTabScreenCoordinates(
        process.platform,
        app.commandLine.getSwitchValue('ozone-platform'),
        process.env
      )
    )
  }

  begin(source: string, documentId: string): void {
    const timer = setInterval(() => this._paint(), 30)
    this._drag = { source, documentId, timer }
    this._paint()
  }

  private _hit(point: { x: number; y: number }): { windowId: string; beforeId: string | null; strip: boolean } | null {
    const nativeWindows = BrowserWindow.getAllWindows().filter(
      (window) => window !== this._preview.window && window.isVisible() && !window.isMinimized()
    )
    nativeWindows.sort(
      (a, b) =>
        Number(b.isAlwaysOnTop()) - Number(a.isAlwaysOnTop()) ||
        Number(b.isFocused()) - Number(a.isFocused())
    )
    for (const native of nativeWindows) {
      if (!contains(native.getBounds(), point)) continue
      const entry = [...this._editors].find(([, editor]) => editor.browserWindow === native)
      if (!entry) return { windowId: '', beforeId: null, strip: false }
      const [windowId] = entry
      const strip = this._strips.get(windowId)
      const bounds = native.getContentBounds()
      const zoom = native.webContents.getZoomFactor()
      const x = (point.x - bounds.x) / zoom
      const y = (point.y - bounds.y) / zoom
      if (!strip || x < strip.left || x >= strip.right || y < strip.top || y >= strip.bottom)
        return { windowId, beforeId: null, strip: false }
      const beforeId =
        strip.tabs.find(
          (tab) =>
            tab.middle > x && !(windowId === this._drag?.source && tab.id === this._drag.documentId)
        )?.id ?? null
      return { windowId, beforeId, strip: true }
    }
    return null
  }

  private _paint(): void {
    const point = screen.getCursorScreenPoint()
    const hit = this._hit(point)
    const bounds = this._drag && !hit?.strip ? this._detachedBounds(this._drag.source, point) : null
    this._preview.update(bounds)
    const next = hit?.strip ? { windowId: hit.windowId, beforeId: hit.beforeId } : null
    if (next?.windowId === this._painted?.windowId && next?.beforeId === this._painted?.beforeId)
      return
    if (this._painted) {
      const native = this._editors.get(this._painted.windowId)?.browserWindow
      if (native && !native.isDestroyed()) native.webContents.send('mt::tabs::drag-position', null)
    }
    this._painted = next
    if (next)
      this._editors
        .get(next.windowId)
        ?.browserWindow?.webContents.send('mt::tabs::drag-position', { beforeId: next.beforeId })
  }

  cancel(source: string): void {
    if (this._drag?.source !== source) return
    this._preview.destroy()
    clearInterval(this._drag.timer)
    this._drag = null
    this._painted = null
    for (const editor of this._editors.values()) {
      const native = editor.browserWindow
      if (native && !native.isDestroyed()) native.webContents.send('mt::tabs::drag-position', null)
    }
  }

  async finish(source: string, cancel: boolean): Promise<void> {
    const drag = this._drag
    if (!drag || drag.source !== source) return
    if (cancel) {
      this.cancel(source)
      return
    }
    const point = screen.getCursorScreenPoint()
    const hit = this._hit(point)
    this.cancel(source)
    if (hit?.strip && hit.windowId === source) return
    await this._transfer(
      source,
      drag.documentId,
      hit?.strip ? hit.windowId : null,
      hit?.strip ? hit.beforeId : null,
      point
    )
  }
}
