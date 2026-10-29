import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, reactive, ref, type App } from 'vue'
import path from 'node:path'
import { useTreeDragDrop } from '../../../src/renderer/src/components/sideBar/useTreeDragDrop'

const mocks = vi.hoisted(() => ({ project: {} as Record<string, unknown>, invoke: vi.fn(), notify: vi.fn(), reveal: vi.fn() }))
vi.mock('@/store/project', () => ({ useProjectStore: () => mocks.project }))
vi.mock('@/services/notification', () => ({ default: { notify: mocks.notify } }))
vi.mock('@/i18n', () => ({ t: (key: string) => key }))

let app: App
let host: HTMLElement
let viewport: HTMLElement
let source: HTMLElement
let target: HTMLElement
let busy: ReturnType<typeof ref<boolean>>
const transfer = () => ({ setData: vi.fn(), effectAllowed: '', dropEffect: '' })
const fire = (element: HTMLElement, type: string, dataTransfer = transfer(), extra = {}) => {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { dataTransfer, clientY: 100, ...extra })
  element.dispatchEvent(event)
  return event
}
const folder = (pathname: string) => ({ pathname, name: path.basename(pathname), isDirectory: true, folders: [], files: [], isCollapsed: true })
const element = (selector: string): HTMLElement => {
  const found = host.querySelector<HTMLElement>(selector)
  if (!found) throw new Error(`Missing test element: ${selector}`)
  return found
}

beforeEach(() => {
  vi.useFakeTimers()
  mocks.invoke.mockReset().mockResolvedValue({ status: 'canceled' })
  mocks.notify.mockReset()
  mocks.reveal.mockReset()
  Object.defineProperty(window, 'path', { configurable: true, value: path.posix })
  Object.defineProperty(window, 'electron', { configurable: true, value: { ipcRenderer: { invoke: mocks.invoke } } })
  mocks.project = reactive({
    roots: [{ key: '/root', status: 'ready', tree: { ...folder('/root'), folders: [folder('/root/notes')] } }],
    renameCache: null, createCache: {}, movingSource: null, treeVersion: 0,
    SET_FOLDER_COLLAPSED: vi.fn(), FIND_ROOT: vi.fn(), TREE_PATH: (value: string) => value,
    FIND_TREE_NODE: (pathname: string) => folder(pathname),
    REVEAL_PATH: vi.fn(), CHANGE_ACTIVE_ITEM: vi.fn()
  })
  host = document.createElement('div')
  document.body.append(host)
  app = createApp({ setup() {
    const container = ref<HTMLElement | null>(null)
    busy = useTreeDragDrop(container, mocks.reveal).busy
    return () => h('div', { ref: container, class: 'viewport' }, [
      h('div', { 'data-tree-root': '/root' }, [
        h('div', { 'data-tree-path': '/root', 'data-tree-directory': 'true', id: 'root' }),
        h('div', { 'data-tree-path': '/root/a.md', 'data-tree-directory': 'false', draggable: true, id: 'source' }),
        h('div', { 'data-tree-path': '/root/notes', 'data-tree-directory': 'true', draggable: true, id: 'target' }),
        h('div', { 'data-tree-path': '/root/notes/child', 'data-tree-directory': 'true', draggable: true, id: 'child' })
      ]),
      h('div', { 'data-tree-root': '/other' }, [
        h('div', { 'data-tree-path': '/other', 'data-tree-directory': 'true', id: 'other' })
      ])
    ])
  } })
  app.mount(host)
  viewport = element('.viewport')
  source = element('#source')
  target = element('#target')
  vi.spyOn(viewport, 'getBoundingClientRect').mockReturnValue({ top: 0, bottom: 200 } as DOMRect)
})
afterEach(() => {
  app.unmount()
  host.remove()
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('sidebar drag session', () => {
  it('submits moved-item reveal to the shared controller without selecting or scrolling itself', async() => {
    mocks.invoke.mockResolvedValue({ status: 'moved', destination: '/root/notes/a.md' })
    fire(source, 'dragstart')
    fire(target, 'drop')
    await nextTick()
    expect(mocks.reveal).toHaveBeenCalledExactlyOnceWith('/root/notes/a.md')
    expect(mocks.project.CHANGE_ACTIVE_ITEM).not.toHaveBeenCalled()
  })
  it('moves only an internally started drag and suppresses repeated drops', async() => {
    fire(target, 'drop')
    expect(mocks.invoke).not.toHaveBeenCalled()
    fire(source, 'dragstart')
    const dt = transfer()
    fire(target, 'dragover', dt)
    expect(dt.dropEffect).toBe('move')
    expect(target.classList.contains('tree-drop-target')).toBe(true)
    fire(target, 'drop')
    fire(target, 'drop')
    expect(mocks.invoke).toHaveBeenCalledExactlyOnceWith('mt::project-move-item', {
      rootKey: '/root', source: '/root/a.md', targetDirectory: '/root/notes'
    })
    expect(busy.value).toBe(true)
    await nextTick()
    expect(busy.value).toBe(false)
    expect(source.classList.contains('tree-drag-source')).toBe(false)
  })

  it('rejects current parent, files, descendants, roots as sources and cross-root targets', () => {
    fire(source, 'dragstart')
    for (const row of [source, element('#root'), element('#other')]) {
      const dt = transfer()
      fire(row, 'dragover', dt)
      expect(dt.dropEffect).toBe('none')
      fire(row, 'drop', dt)
      fire(source, 'dragstart')
    }
    fire(document.body, 'dragend')
    fire(target, 'dragstart')
    fire(element('#child'), 'drop')
    fire(element('#root'), 'dragstart')
    fire(target, 'drop')
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('expands after sustained hover and cancels timers when the drag leaves', () => {
    fire(source, 'dragstart')
    fire(target, 'dragover')
    vi.advanceTimersByTime(699)
    expect(mocks.project.SET_FOLDER_COLLAPSED).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(mocks.project.SET_FOLDER_COLLAPSED).toHaveBeenCalledOnce()
    fire(viewport, 'dragleave')
    fire(target, 'dragover')
    fire(document.body, 'dragend')
    vi.advanceTimersByTime(1000)
    expect(mocks.project.SET_FOLDER_COLLAPSED).toHaveBeenCalledOnce()
    expect(target.classList.contains('tree-drop-target')).toBe(false)
  })

  it('scrolls near the viewport edge and stops on drag end', () => {
    fire(source, 'dragstart')
    fire(target, 'dragover', transfer(), { clientY: 195 })
    vi.advanceTimersByTime(64)
    expect(viewport.scrollTop).toBeGreaterThan(0)
    fire(document.body, 'dragend')
    const position = viewport.scrollTop
    vi.advanceTimersByTime(100)
    expect(viewport.scrollTop).toBe(position)
  })

  it('prevents internal drops reaching the editor or global import handler', () => {
    const editor = document.createElement('div')
    document.body.append(editor)
    const handleEditorDrop = vi.fn()
    editor.addEventListener('drop', handleEditorDrop)
    fire(source, 'dragstart')
    fire(target, 'dragover')
    const event = fire(editor, 'drop')
    expect(event.defaultPrevented).toBe(true)
    expect(handleEditorDrop).not.toHaveBeenCalled()
    expect(mocks.invoke).not.toHaveBeenCalled()
    expect(target.classList.contains('tree-drop-target')).toBe(false)
    editor.remove()
  })

  it('does not start while editing a name', () => {
    mocks.project.renameCache = '/root/a.md'
    expect(fire(source, 'dragstart').defaultPrevented).toBe(true)
    fire(target, 'drop')
    expect(mocks.invoke).not.toHaveBeenCalled()
  })
})
