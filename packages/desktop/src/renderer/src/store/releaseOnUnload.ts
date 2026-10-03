import { onScopeDispose } from 'vue'

/**
 * Pinia keeps a store for the life of the window, so `onScopeDispose` alone
 * does not run when the renderer is torn down. `pagehide` is that moment:
 * main-process subscriptions have to be dropped with the window.
 */
export function createUnloadBag(): {
  listen: (collect: (add: (release: () => void) => void) => void) => void
  stop: () => void
} {
  const releases: Array<() => void> = []

  const stop = (): void => {
    window.removeEventListener('pagehide', stop)
    const pending = releases.splice(0, releases.length)
    for (const release of pending) release()
  }

  onScopeDispose(stop)

  return {
    stop,
    listen(collect) {
      stop()
      collect((release) => {
        releases.push(release)
      })
      window.addEventListener('pagehide', stop)
    }
  }
}
