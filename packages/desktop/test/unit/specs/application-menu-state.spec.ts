import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// `@/store/editor` (via `@/config`) reads `window.path.sep` at module load and
// the store sends IPC through `window.electron`; stub the preload surface first.
vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string; dirname: (p: string) => string }
      marktext?: { env: { windowId: number } }
      electron?: { clipboard: { writeText: (s: string) => void }; ipcRenderer: { send: (...a: unknown[]) => void; on: (...a: unknown[]) => void } }
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', dirname: (p: string) => p }
  w.window.marktext ??= { env: { windowId: 1 } }
  w.window.electron ??= { clipboard: { writeText: () => {} }, ipcRenderer: { send: () => {}, on: () => {} } }
})

vi.mock('@/services/notification', () => ({ default: { notify: vi.fn(), name: 'notify' } }))

const { useEditorStore } = await import('@/store/editor')

// createApplicationMenuState is module-private; assert it via the IPC payload
// the SELECTION_CHANGE action sends.
function menuStateFor(changes: unknown) {
  const sendSpy = vi.spyOn(window.electron.ipcRenderer, 'send')
  const store = useEditorStore()
  store.SELECTION_CHANGE(changes as never)
  const call = [...sendSpy.mock.calls].reverse().find((c) => c[0] === 'mt::editor-selection-changed')
  return call?.[2] as { isCodeFences: boolean; isTable: boolean }
}

describe('createApplicationMenuState via SELECTION_CHANGE', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.restoreAllMocks()
  })

  it('marks a math/html/frontmatter selection as code-fences', () => {
    const state = menuStateFor({
      start: { key: 'a', offset: 0, type: 'pre', block: { functionType: 'codeContent' } },
      end: { key: 'a', offset: 0, type: 'pre', block: { functionType: 'codeContent' } },
      affiliation: [{ type: 'pre', blockName: 'math-block', functionType: 'multiplemath' }]
    })
    expect(state.isCodeFences).toBe(true)
  })

  it('marks a diagram selection as code-fences and not a table', () => {
    const state = menuStateFor({
      start: { key: 'a', offset: 0, type: 'span', block: {} },
      end: { key: 'a', offset: 0, type: 'span', block: {} },
      affiliation: [{ type: 'figure', blockName: 'diagram', functionType: 'diagram' }]
    })
    expect(state.isCodeFences).toBe(true)
    expect(state.isTable).toBe(false)
  })

  it('checks every list level for a deeply nested ul > ul > ol (flags from innermost)', () => {
    const state = menuStateFor({
      start: { key: 'a', offset: 0, type: 'span', block: { functionType: 'paragraphContent' } },
      end: { key: 'a', offset: 0, type: 'span', block: { functionType: 'paragraphContent' } },
      affiliation: [
        { type: 'ul', blockName: 'bullet-list', listType: 'bullet' },
        { type: 'li', blockName: 'list-item' },
        { type: 'ul', blockName: 'bullet-list', listType: 'bullet' },
        { type: 'li', blockName: 'list-item' },
        { type: 'ol', blockName: 'order-list', listType: 'order' },
        { type: 'li', blockName: 'list-item' },
        { type: 'p', blockName: 'paragraph' }
      ]
    }) as unknown as { affiliation: Record<string, boolean>; isTaskList: boolean }
    // Both nested list levels are checked; the deeply nested ol is no longer
    // dropped by the depth-3 scan.
    expect(state.affiliation.ol).toBe(true)
    expect(state.affiliation.ul).toBe(true)
    expect(state.isTaskList).toBe(false)
  })
})
