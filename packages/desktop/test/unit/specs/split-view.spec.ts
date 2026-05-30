import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// The layout store transitively imports modules (config.ts, project store) that
// read `window.path` / `window.electron` at module-evaluation time, and the
// store actions emit IPC. Stub them before the store is imported (hoisted) so
// the pure store logic can be exercised in isolation.
vi.hoisted(() => {
  const noop = (): void => {}
  Object.assign(window, {
    path: { sep: '/', dirname: () => '', basename: () => '', join: () => '' },
    electron: {
      ipcRenderer: { send: noop, on: noop, invoke: () => Promise.resolve() }
    },
    marktext: { env: { windowId: 1 } }
  })
})

const { useLayoutStore } = await import('@/store/layout')

describe('layout store: split view', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('defaults to split view disabled', () => {
    const store = useLayoutStore()
    expect(store.showSplitView).toBe(false)
    expect(store.splitRatio).toBe(0.5)
    expect(store.splitFileId).toBe(null)
  })

  it('TOGGLE_SPLIT_VIEW toggles showSplitView', () => {
    const store = useLayoutStore()
    store.TOGGLE_SPLIT_VIEW()
    expect(store.showSplitView).toBe(true)
    store.TOGGLE_SPLIT_VIEW()
    expect(store.showSplitView).toBe(false)
  })

  it('TOGGLE_SPLIT_VIEW clears splitFileId when disabling', () => {
    const store = useLayoutStore()
    store.TOGGLE_SPLIT_VIEW()
    store.SET_SPLIT_FILE('tab-1')
    expect(store.splitFileId).toBe('tab-1')
    store.TOGGLE_SPLIT_VIEW()
    expect(store.showSplitView).toBe(false)
    expect(store.splitFileId).toBe(null)
  })

  it('SET_SPLIT_RATIO clamps to [0.1, 0.9]', () => {
    const store = useLayoutStore()
    store.SET_SPLIT_RATIO(0.05)
    expect(store.splitRatio).toBe(0.1)
    store.SET_SPLIT_RATIO(0.95)
    expect(store.splitRatio).toBe(0.9)
    store.SET_SPLIT_RATIO(0.42)
    expect(store.splitRatio).toBe(0.42)
  })

  it('SET_SPLIT_FILE sets splitFileId', () => {
    const store = useLayoutStore()
    store.SET_SPLIT_FILE('abc')
    expect(store.splitFileId).toBe('abc')
    store.SET_SPLIT_FILE(null)
    expect(store.splitFileId).toBe(null)
  })

  it('CREATE_BUFFERED_STATE includes split view fields', () => {
    const store = useLayoutStore()
    store.TOGGLE_SPLIT_VIEW()
    store.SET_SPLIT_RATIO(0.3)
    store.SET_SPLIT_FILE('tab-x')

    const buffered = store.CREATE_BUFFERED_STATE()
    expect(buffered).not.toBeNull()
    expect(buffered).toMatchObject({
      showSplitView: true,
      splitRatio: 0.3,
      splitFileId: 'tab-x'
    })
  })

  it('RESTORE_BUFFERED_STATE restores split view fields with ratio clamping', () => {
    const store = useLayoutStore()
    store.RESTORE_BUFFERED_STATE({
      showSplitView: true,
      splitRatio: 2,
      splitFileId: 'restored-tab'
    })
    expect(store.showSplitView).toBe(true)
    expect(store.splitRatio).toBe(0.9)
    expect(store.splitFileId).toBe('restored-tab')
  })

  it('RESTORE_BUFFERED_STATE drops splitFileId when split view is off', () => {
    const store = useLayoutStore()
    store.RESTORE_BUFFERED_STATE({
      showSplitView: false,
      splitRatio: 0.5,
      splitFileId: 'orphan-tab'
    })
    expect(store.showSplitView).toBe(false)
    expect(store.splitFileId).toBe(null)
  })
})
