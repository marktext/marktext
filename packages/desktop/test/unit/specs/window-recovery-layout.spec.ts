import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
vi.hoisted(() => {
  Object.assign(window, {
    electron: { ipcRenderer: { send: vi.fn(), on: vi.fn(), invoke: vi.fn(async() => {}) } },
    path: {
      sep: '/',
      dirname: (p: string) => p,
      normalize: (p: string) => p,
      basename: (p: string) => p.split('/').pop()
    }
  })
})
vi.mock('@/services/notification', () => ({ default: { notify: vi.fn() } }))
vi.mock('@/store/checkpoint', () => ({ scheduleWindowCheckpoint: vi.fn() }))
import { useLayoutStore } from '@/store/layout'
import { usePreferencesStore } from '@/store/preferences'
import { useEditorStore } from '@/store/editor'
import { useProjectStore } from '@/store/project'
import { createDefaultLayout } from '../../../src/shared/applicationState/defaults'
import { fitWindowGeometry } from '../../../src/main/applicationState/windowGeometry'

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  vi.clearAllMocks()
})
describe('window-owned layout', () => {
  it('restores every layout field, keeps two instances independent and avoids global preference writes', async() => {
    const first = useLayoutStore()
    const preferred = createDefaultLayout()
    preferred.sidebar = {
      visible: true,
      activeView: 'search',
      preferredWidthPx: 410,
      openedFiles: { expanded: false, preferredHeightPx: 260 }
    }
    preferred.outline = { visible: false, position: 'right', preferredWidthPx: 390 }
    preferred.tabBar.visible = true
    preferred.modes = { sourceCode: true, focus: true, typewriter: true }
    const changed = vi.fn()
    first.INITIALIZE_WINDOW_LAYOUT(preferred, changed)
    expect(first.CAPTURE_WINDOW_LAYOUT()).toEqual(preferred)
    const second = useLayoutStore(createPinia())
    second.INITIALIZE_WINDOW_LAYOUT(createDefaultLayout())
    first.TOGGLE_LAYOUT_ENTRY('showToc')
    first.SET_SIDE_BAR_WIDTH(460)
    await nextTick()
    expect(second.CAPTURE_WINDOW_LAYOUT()).toEqual(createDefaultLayout())
    expect(first.CAPTURE_WINDOW_LAYOUT()).toMatchObject({
      outline: { visible: true },
      sidebar: { preferredWidthPx: 460 }
    })
    expect(changed).toHaveBeenCalled()
    expect(window.electron.ipcRenderer.send).not.toHaveBeenCalledWith(
      'mt::set-user-preference',
      expect.anything()
    )
    expect(localStorage.getItem('side-bar-width')).toBeNull()
  })
  it('keeps a restored layout when global defaults later change', () => {
    const store = useLayoutStore()
    const preferences = usePreferencesStore()
    store.INITIALIZE_WINDOW_LAYOUT(createDefaultLayout())
    preferences.tocPosition = 'right'
    preferences.SET_USER_PREFERENCE({ tocVisibility: false })
    expect(store.outlinePosition).toBe('left')
    expect(store.showToc).toBe(true)
    store.SET_OUTLINE_WIDTH(900)
    expect(store.outlineWidth).toBe(600)
  })
  it('does not let temporary reading mode reset the preferred source mode', async() => {
    const layout = useLayoutStore()
    layout.INITIALIZE_WINDOW_LAYOUT({
      ...createDefaultLayout(),
      modes: { sourceCode: true, focus: true, typewriter: true }
    })
    const editor = useEditorStore()
    const tab = { id: 'a', readOnly: true, isSaved: true, markdown: 'Text' }
    editor.tabs = [tab] as typeof editor.tabs
    editor.currentFile = editor.tabs[0]
    await editor.SET_READ_ONLY('a', false)
    expect(layout.CAPTURE_WINDOW_LAYOUT().modes).toEqual({
      sourceCode: true,
      focus: true,
      typewriter: true
    })
  })
  it('does not expand a hidden sidebar when a folder loads', () => {
    const layout = useLayoutStore()
    layout.INITIALIZE_WINDOW_LAYOUT(createDefaultLayout())
    useProjectStore().APPLY_ROOTS({ revision: 1, roots: [{ key: '/notes', pathname: '/notes', watchToken: 'root', status: 'loading' }], reason: 'restore' })
    expect(layout.showSideBar).toBe(false)
  })
  it('clips the visible sidebar without changing or persisting the preferred width', () => {
    const layout = useLayoutStore()
    const state = createDefaultLayout()
    state.sidebar.visible = true
    state.sidebar.preferredWidthPx = 900
    const changed = vi.fn()
    layout.INITIALIZE_WINDOW_LAYOUT(state, changed)
    const width = window.innerWidth
    Object.defineProperty(window, 'innerWidth', { value: 600, configurable: true })
    window.dispatchEvent(new Event('resize'))
    expect(layout.effectiveSideBarWidth).toBe(280)
    expect(layout.CAPTURE_WINDOW_LAYOUT().sidebar.preferredWidthPx).toBe(900)
    expect(changed).not.toHaveBeenCalled()
    Object.defineProperty(window, 'innerWidth', { value: width, configurable: true })
    window.dispatchEvent(new Event('resize'))
  })
})
describe('window geometry in external device-independent bounds', () => {
  const displays = [{ id: 'primary', workArea: { x: 0, y: 25, width: 1440, height: 875 } }]
  it('brings a removed-monitor window back into the current work area', () => {
    const result = fitWindowGeometry(
      {
        normalBounds: { x: 4000, y: -2000, width: 1800, height: 1200 },
        maximized: true,
        displayId: 'removed'
      },
      displays,
      'primary'
    )
    expect(result).toEqual({
      normalBounds: { x: 0, y: 25, width: 1440, height: 875 },
      maximized: true,
      displayId: 'primary'
    })
  })
  it('retains visible negative coordinates on an existing monitor', () => {
    const left = { id: 'left', workArea: { x: -1600, y: 0, width: 1600, height: 1000 } }
    const geometry = {
      normalBounds: { x: -1500, y: 50, width: 1000, height: 800 },
      maximized: false,
      displayId: 'left'
    }
    expect(fitWindowGeometry(geometry, [left, ...displays], 'primary')).toEqual(geometry)
  })
})
