export interface ZoomState {
  scale: number
  x: number
  y: number
}

export interface Size {
  width: number
  height: number
}

export const MIN_SCALE = 0.1
export const MAX_SCALE = 16
export const IDENTITY: ZoomState = { scale: 1, x: 0, y: 0 }

const clampScale = (scale: number): number => Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))

/**
 * Scale `state` by `factor` while the content point currently under
 * (`px`, `py`) stays there. (`cx`, `cy`) is where the content's own centre sits
 * when untransformed — the transform is `translate(x, y) scale(scale)` with
 * `transform-origin: center`.
 */
export function zoomAt(
  state: ZoomState,
  factor: number,
  px: number,
  py: number,
  cx: number,
  cy: number
): ZoomState {
  const scale = clampScale(state.scale * factor)
  const k = scale / state.scale
  if (k === 1) return state

  return {
    scale,
    x: (px - cx) * (1 - k) + k * state.x,
    y: (py - cy) * (1 - k) + k * state.y
  }
}

/** The scale that makes `content` fit inside `viewport`, never enlarging it. */
export function fitScale(content: Size, viewport: Size): number {
  if (content.width <= 0 || content.height <= 0) return 1

  const scale = Math.min(viewport.width / content.width, viewport.height / content.height)

  return clampScale(Math.min(1, scale))
}

export function pan(state: ZoomState, dx: number, dy: number): ZoomState {
  return { ...state, x: state.x + dx, y: state.y + dy }
}

export function toTransform(state: ZoomState): string {
  return `translate(${state.x}px, ${state.y}px) scale(${state.scale})`
}

export interface ZoomPanOptions {
  onChange?: (state: ZoomState) => void
}

/**
 * Wheel-zoom and drag-pan for one element inside a viewport. Writes a CSS
 * transform onto the content and owns nothing else about the DOM.
 */
export class ZoomPanController {
  private _state: ZoomState = IDENTITY
  private _dragging = false
  private _originX = 0
  private _originY = 0
  private readonly _onWheel: (event: WheelEvent) => void
  private readonly _onMouseDown: (event: MouseEvent) => void
  private readonly _onMouseMove: (event: MouseEvent) => void
  private readonly _onMouseUp: () => void

  constructor(
    private readonly viewport: HTMLElement,
    private readonly content: HTMLElement,
    private readonly options: ZoomPanOptions = {}
  ) {
    this.content.style.transformOrigin = 'center center'

    this._onWheel = (event) => {
      event.preventDefault()
      const [cx, cy] = this._centre()
      const factor = event.deltaY < 0 ? 1.1 : 1 / 1.1
      this._apply(zoomAt(this._state, factor, event.clientX, event.clientY, cx, cy))
    }
    this._onMouseDown = (event) => {
      if (event.button !== 0) return
      this._dragging = true
      this._originX = event.clientX - this._state.x
      this._originY = event.clientY - this._state.y
      this.viewport.style.cursor = 'grabbing'
      event.preventDefault()
    }
    this._onMouseMove = (event) => {
      if (!this._dragging) return
      this._apply({
        ...this._state,
        x: event.clientX - this._originX,
        y: event.clientY - this._originY
      })
    }
    this._onMouseUp = () => {
      this._dragging = false
      this.viewport.style.cursor = 'grab'
    }

    this.viewport.addEventListener('wheel', this._onWheel, { passive: false })
    this.viewport.addEventListener('mousedown', this._onMouseDown)
    // A drag released outside the window still has to finish (#5393): once the
    // pointer hit-tests <html>, `document.body` stops seeing these events.
    document.addEventListener('mousemove', this._onMouseMove)
    document.addEventListener('mouseup', this._onMouseUp)
  }

  get scale(): number {
    return this._state.scale
  }

  zoomBy(factor: number): void {
    const [cx, cy] = this._centre()
    this._apply(zoomAt(this._state, factor, cx, cy, cx, cy))
  }

  panBy(dx: number, dy: number): void {
    this._apply(pan(this._state, dx, dy))
  }

  fit(): void {
    const scale = fitScale(
      { width: this.content.offsetWidth, height: this.content.offsetHeight },
      { width: this.viewport.clientWidth, height: this.viewport.clientHeight }
    )
    this._apply({ ...IDENTITY, scale })
  }

  actualSize(): void {
    this._apply(IDENTITY)
  }

  destroy(): void {
    this.viewport.removeEventListener('wheel', this._onWheel)
    this.viewport.removeEventListener('mousedown', this._onMouseDown)
    document.removeEventListener('mousemove', this._onMouseMove)
    document.removeEventListener('mouseup', this._onMouseUp)
  }

  private _centre(): [number, number] {
    const { left, top, width, height } = this.viewport.getBoundingClientRect()
    return [left + width / 2, top + height / 2]
  }

  private _apply(state: ZoomState): void {
    this._state = state
    this.content.style.transform = toTransform(state)
    this.options.onChange?.(state)
  }
}
