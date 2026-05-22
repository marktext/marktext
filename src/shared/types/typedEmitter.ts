import { EventEmitter } from 'node:events'

/**
 * EventEmitter subclass with a typed event map. Extend it with an interface
 * mapping event names to listener-argument tuples; `on`/`emit`/etc. are then
 * type-checked at the call site.
 *
 * Used by main-process classes (BaseWindow, WindowManager, DataCenter,
 * Preferences, EditorBufferStore, Keyboard) — see Commit 5d.
 *
 * @example
 *   interface BaseWindowEvents {
 *     ready: []
 *     'window-blur': [id: number]
 *     'will-close': [id: number, opts: { keepInBackground: boolean }]
 *   }
 *   class BaseWindow extends TypedEmitter<BaseWindowEvents> { ... }
 */
// We use a permissive constraint (`unknown` instead of `Record<string, unknown[]>`)
// because TS 5.x rejects plain `interface X { foo: [] }` declarations from
// satisfying a string-indexed record. The looser constraint lets concrete
// event maps stay as readable interfaces while still enforcing per-event
// argument tuples in on/emit/etc.
export class TypedEmitter<Events> extends EventEmitter {
  declare on: <K extends keyof Events & string>(
    event: K,
    listener: (...args: Events[K] extends unknown[] ? Events[K] : unknown[]) => void
  ) => this

  declare once: <K extends keyof Events & string>(
    event: K,
    listener: (...args: Events[K] extends unknown[] ? Events[K] : unknown[]) => void
  ) => this

  declare off: <K extends keyof Events & string>(
    event: K,
    listener: (...args: Events[K] extends unknown[] ? Events[K] : unknown[]) => void
  ) => this

  declare emit: <K extends keyof Events & string>(
    event: K,
    ...args: Events[K] extends unknown[] ? Events[K] : unknown[]
  ) => boolean

  declare removeListener: <K extends keyof Events & string>(
    event: K,
    listener: (...args: Events[K] extends unknown[] ? Events[K] : unknown[]) => void
  ) => this

  declare addListener: <K extends keyof Events & string>(
    event: K,
    listener: (...args: Events[K] extends unknown[] ? Events[K] : unknown[]) => void
  ) => this
}
