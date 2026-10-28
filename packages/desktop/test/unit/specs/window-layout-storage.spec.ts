import { afterEach, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.hoisted(() => {
  Object.assign(window, {
    electron: { ipcRenderer: { send: vi.fn(), on: vi.fn(), invoke: vi.fn() } },
    path: { sep: '/', dirname: (value: string) => value, basename: (value: string) => value }
  })
})
vi.mock('@/services/notification', () => ({ default: { notify: vi.fn() } }))
vi.mock('@/store/checkpoint', () => ({ scheduleWindowCheckpoint: vi.fn() }))

afterEach(() => {
  localStorage.clear()
  vi.restoreAllMocks()
})

it('creates window layout without reading or writing obsolete browser storage', async() => {
  localStorage.setItem('side-bar-width', '870')
  localStorage.setItem('outline-width', '590')
  localStorage.setItem('side-bar-show-opened-files', 'false')
  localStorage.setItem('side-bar-opened-files-height', '700')
  const read = vi.spyOn(Storage.prototype, 'getItem')
  const write = vi.spyOn(Storage.prototype, 'setItem')
  const { useLayoutStore } = await import('@/store/layout')
  setActivePinia(createPinia())
  const layout = useLayoutStore()
  expect(layout.sideBarWidth).toBe(280)
  expect(layout.outlineWidth).toBe(220)
  expect(layout.openedFilesExpanded).toBe(true)
  expect(layout.openedFilesHeight).toBe(112)
  layout.SET_SIDE_BAR_WIDTH(370)
  layout.SET_OUTLINE_WIDTH(320)
  layout.TOGGLE_LAYOUT_ENTRY('showToc')
  expect(read).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
})
