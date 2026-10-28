import type { WindowGeometryState } from '@shared/types/applicationState'

type Bounds = WindowGeometryState['normalBounds']
export interface DisplayArea {
  id: string
  workArea: Bounds
}
export interface GeometryWindow {
  setBounds(bounds: Bounds): void
  getNormalBounds(): Bounds
  isMaximized(): boolean
  maximize(): void
  unmaximize(): void
}
const overlap = (a: Bounds, b: Bounds): number =>
  Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)) *
  Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y))
const displayFor = (
  bounds: Bounds,
  displays: DisplayArea[],
  preferred: string | null,
  primary: string
): DisplayArea => {
  const ordered = [...displays].sort(
    (a, b) => overlap(bounds, b.workArea) - overlap(bounds, a.workArea)
  )
  const display =
    displays.find((display) => display.id === preferred) ??
    (ordered[0] && overlap(bounds, ordered[0].workArea) > 0
      ? ordered[0]
      : (displays.find((display) => display.id === primary) ?? ordered[0]))
  if (!display) throw new Error('No displays available')
  return display
}

export const fitWindowGeometry = (
  state: WindowGeometryState,
  displays: DisplayArea[],
  primary: string
): WindowGeometryState => {
  const input = state.normalBounds
  const bounds = {
    x: Number.isFinite(input.x) ? input.x : 0,
    y: Number.isFinite(input.y) ? input.y : 0,
    width: Number.isFinite(input.width) ? input.width : 1200,
    height: Number.isFinite(input.height) ? input.height : 800
  }
  const display = displayFor(bounds, displays, state.displayId, primary)
  const area = display.workArea
  const width = Math.min(area.width, Math.max(550, bounds.width))
  const height = Math.min(area.height, Math.max(350, bounds.height))
  return {
    normalBounds: {
      x: Math.round(Math.max(area.x, Math.min(bounds.x, area.x + area.width - width))),
      y: Math.round(Math.max(area.y, Math.min(bounds.y, area.y + area.height - height))),
      width: Math.round(width),
      height: Math.round(height)
    },
    maximized: state.maximized,
    displayId: display.id
  }
}

export const applyWindowGeometry = (
  window: GeometryWindow,
  state: WindowGeometryState,
  displays: DisplayArea[],
  primary: string
): void => {
  const fitted = fitWindowGeometry(state, displays, primary)
  if (window.isMaximized()) window.unmaximize()
  window.setBounds(fitted.normalBounds)
  if (fitted.maximized) window.maximize()
}

export const captureWindowGeometry = (
  window: GeometryWindow,
  displays: DisplayArea[],
  primary: string
): WindowGeometryState => {
  const normalBounds = window.getNormalBounds()
  return {
    normalBounds,
    maximized: window.isMaximized(),
    displayId: displayFor(normalBounds, displays, null, primary).id
  }
}
