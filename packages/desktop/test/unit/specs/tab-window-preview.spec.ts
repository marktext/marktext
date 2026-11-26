// @vitest-environment node
import { beforeEach, expect, it, vi } from 'vitest'
import {
  detachedTabGeometry,
  TabWindowPreview
} from '../../../src/main/applicationState/tabWindowPreview'

const { createWindow, screens } = vi.hoisted(() => ({ createWindow: vi.fn(), screens: vi.fn() }))
vi.mock('electron', () => ({
  BrowserWindow: vi.fn(function(options) {
    return createWindow(options)
  }),
  screen: {
    getAllDisplays: screens,
    getPrimaryDisplay: () => ({ id: 1 }),
    getDisplayNearestPoint: (point: { x: number }) => ({ id: point.x < 0 ? 2 : 1 })
  }
}))

beforeEach(() => {
  vi.clearAllMocks()
  screens.mockReturnValue([
    { id: 1, scaleFactor: 1, workArea: { x: 0, y: 0, width: 1920, height: 1040 } },
    { id: 2, scaleFactor: 2, workArea: { x: -1280, y: 0, width: 1280, height: 720 } }
  ])
})

const fixture = () => {
  let ready: (() => void) | undefined
  const window = {
    once: vi.fn((_name: string, callback: () => void) => {
      ready = callback
    }),
    loadURL: vi.fn().mockResolvedValue(undefined),
    setIgnoreMouseEvents: vi.fn(),
    setBounds: vi.fn(),
    getBounds: () => ({ x: 100, y: 100, width: 800, height: 600 }),
    showInactive: vi.fn(),
    isVisible: () => false,
    hide: vi.fn(),
    isDestroyed: () => false,
    destroy: vi.fn()
  }
  createWindow.mockReturnValue(window)
  return { preview: new TabWindowPreview(), window, ready: () => ready?.() }
}
const bounds = { x: 100, y: 100, width: 800, height: 600 }

it('uses DIP work-area bounds on a monitor with a negative origin and different scale', () => {
  expect(detachedTabGeometry(bounds, { x: -1200, y: 700 })).toEqual({
    normalBounds: { x: -1280, y: 120, width: 800, height: 600 },
    maximized: false,
    displayId: '2'
  })
})

it('fits oversized source windows into the destination display', () => {
  expect(
    detachedTabGeometry({ ...bounds, width: 2000, height: 1500 }, { x: -500, y: 200 }).normalBounds
  ).toEqual({ x: -1280, y: 0, width: 1280, height: 720 })
})

it('keeps the cursor offset when the new window fits the work area', () => {
  expect(detachedTabGeometry(bounds, { x: 500, y: 200 }).normalBounds).toEqual({
    ...bounds,
    x: 400,
    y: 184
  })
})

it('creates an inert, mouse-transparent outline and shows it without focusing', () => {
  const { preview, window, ready } = fixture()
  preview.update(bounds)
  expect(createWindow).toHaveBeenCalledWith(
    expect.objectContaining({
      ...bounds,
      focusable: false,
      transparent: true,
      skipTaskbar: true,
      show: false,
      webPreferences: {
        sandbox: true,
        contextIsolation: true,
        nodeIntegration: false,
        javascript: false
      }
    })
  )
  expect(window.setIgnoreMouseEvents).toHaveBeenCalledWith(true)
  expect(window.showInactive).not.toHaveBeenCalled()
  ready()
  expect(window.setBounds).toHaveBeenCalledWith(bounds)
  expect(window.showInactive).toHaveBeenCalledOnce()
  preview.destroy()
})

it('uses the newest bounds if the pointer moves before the outline loads', () => {
  const { preview, window, ready } = fixture()
  preview.update(bounds)
  const moved = { ...bounds, x: 500 }
  preview.update(moved)
  ready()
  expect(window.setBounds).toHaveBeenLastCalledWith(moved)
  preview.destroy()
})

it('hides over a tab strip and does not reappear when loading finishes there', () => {
  const { preview, window, ready } = fixture()
  preview.update(bounds)
  preview.update(null)
  ready()
  expect(window.hide).toHaveBeenCalled()
  expect(window.showInactive).not.toHaveBeenCalled()
  preview.update(bounds)
  expect(createWindow).toHaveBeenCalledOnce()
  expect(window.showInactive).toHaveBeenCalledOnce()
  preview.destroy()
})

it('destroys the outline on cancellation and ignores a delayed load callback', () => {
  const { preview, window, ready } = fixture()
  preview.update(bounds)
  preview.destroy()
  ready()
  expect(window.destroy).toHaveBeenCalledOnce()
  expect(preview.window).toBeNull()
  expect(window.showInactive).not.toHaveBeenCalled()
})

it('keeps preview load failures from interrupting or repeatedly reopening the drag', async() => {
  const { preview, window } = fixture()
  window.loadURL.mockRejectedValue(new Error('load failed'))
  preview.update(bounds)
  await Promise.resolve()
  expect(window.destroy).toHaveBeenCalledOnce()
  preview.update(bounds)
  expect(createWindow).toHaveBeenCalledOnce()
  preview.destroy()
})
