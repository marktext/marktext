import type { Input } from 'electron'

export type TextDirection = 'ltr' | 'rtl'

/** The subset of Electron's `Input` the gesture inspects. */
export type GestureInput = Pick<
  Input,
  'type' | 'key' | 'code' | 'control' | 'shift' | 'alt' | 'meta'
>

/**
 * Creates a recognizer for the Word-style text direction gesture: press
 * Ctrl+Shift and release, where the side of the Shift (or Ctrl, whichever is
 * pressed last) picks the direction — right side is `rtl`, left side is `ltr`.
 *
 * The returned function is fed every key event of a window, in order, and
 * returns the direction to apply when the chord is released, otherwise `null`.
 * A chord is abandoned if any other key goes down while it is held, so
 * shortcuts such as Ctrl+Shift+Z never switch the direction. Each recognizer
 * keeps its own state; create one per window.
 */
export const createTextDirectionGesture = (): ((input: GestureInput) => TextDirection | null) => {
  // Direction decided when the chord was completed; set until the chord ends.
  let pendingDirection: TextDirection | null = null

  return (input) => {
    const isModifier = input.key === 'Shift' || input.key === 'Control'

    if (input.type === 'keyDown') {
      if (!isModifier) {
        pendingDirection = null
      } else if (input.key === 'Shift' && input.control && !input.alt && !input.meta) {
        pendingDirection = input.code === 'ShiftRight' ? 'rtl' : 'ltr'
      } else if (input.key === 'Control' && input.shift && !input.alt && !input.meta) {
        pendingDirection = input.code === 'ControlRight' ? 'rtl' : 'ltr'
      }
      return null
    }

    if (input.type === 'keyUp' && isModifier && pendingDirection) {
      const direction = pendingDirection
      pendingDirection = null
      return direction
    }
    return null
  }
}
