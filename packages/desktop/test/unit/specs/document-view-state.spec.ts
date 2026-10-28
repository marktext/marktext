import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CodeMirror from 'codemirror'
import { Muya, SelectionType, type TSelectionState } from '@muyajs/core'
import { createHash } from 'node:crypto'
import { DocumentViewAdapter } from '@/services/documentViewState'
import type { DocumentViewState } from '../../../src/shared/types/applicationState'

const hash = async(text: string) => createHash('sha256').update(text).digest('hex')
const createRange = document.createRange.bind(document)
const engines: Muya[] = []
beforeEach(() =>
  vi.spyOn(document, 'createRange').mockImplementation(() =>
    Object.assign(createRange(), {
      getBoundingClientRect: () => new DOMRect(),
      getClientRects: () => [] as unknown as DOMRectList
    })
  )
)
afterEach(() => {
  engines.splice(0).forEach((engine) => engine.destroy())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
const rendered = (markdown: string) => {
  const host = document.createElement('div')
  document.body.append(host)
  const engine = new Muya(host, { markdown })
  engine.init()
  engines.push(engine)
  return { engine, container: engine.domNode }
}
const adapter = new DocumentViewAdapter(hash)
describe('document view adapters with reconstructed editors', () => {
  it('restores a backward source selection in a new CodeMirror instance and clamps invalid positions', async() => {
    const markdown = 'First line\nSecond line'
    const first = CodeMirror(document.body, { value: markdown })
    first.setSelection({ line: 1, ch: 6 }, { line: 0, ch: 2 })
    const state = await adapter.capture(markdown, { source: first })
    const second = CodeMirror(document.body, { value: markdown })
    await adapter.restore(markdown, state, { source: second })
    expect(second.getCursor('anchor')).toEqual({ line: 1, ch: 6 })
    expect(second.getCursor('head')).toEqual({ line: 0, ch: 2 })
    state.sourceSelection = { anchor: { line: 999, ch: 999 }, focus: { line: -2, ch: -3 } }
    await adapter.restore(markdown, state, { source: second })
    expect(second.getCursor('anchor')).toEqual({ line: 1, ch: 11 })
    expect(second.getCursor('head')).toEqual({ line: 0, ch: 0 })
  })
  it('restores a real Muya selection after rebuilding its block tree', async() => {
    const markdown = 'Hello world\n'
    const first = rendered(markdown)
    first.engine.setCursorByOffset({ anchor: { line: 0, ch: 2 }, focus: { line: 0, ch: 7 } })
    const state = await adapter.capture(markdown, {
      rendered: first,
      collapsedOutlineKeys: ['heading']
    })
    if (state.muyaSelection?.kind === 'text') {
      expect(state.muyaSelection.anchor.path.some((part) => typeof part === 'string')).toBe(true)
      expect(state.muyaSelection.anchor.path.some((part) => typeof part === 'number')).toBe(true)
    }
    const second = rendered(markdown)
    const keys = await adapter.restore(markdown, state, { rendered: second })
    expect(second.engine.getSelectedText()).toBe('llo w')
    expect(keys).toEqual(['heading'])
  })
  it('does not apply stale Muya paths or outline keys after content changes', async() => {
    const first = rendered('Original text\n')
    first.engine.setCursorByOffset({ anchor: { line: 0, ch: 2 }, focus: { line: 0, ch: 5 } })
    const state = await adapter.capture('Original text\n', {
      rendered: first,
      collapsedOutlineKeys: ['old']
    })
    const second = rendered('Different\n')
    expect(await adapter.restore('Different\n', state, { rendered: second })).toEqual([])
    expect(second.engine.getSelectedText()).toBe('')
  })
  it('resets disabled view restoration and skips a restore whose document changed while hashing', async() => {
    const source = CodeMirror(document.body, { value: 'abcdef' })
    source.setSelection({ line: 0, ch: 2 }, { line: 0, ch: 4 })
    const state = await adapter.capture('abcdef', { source })
    await adapter.restore('abcdef', state, { source }, false)
    expect(source.getCursor()).toEqual({ line: 0, ch: 0 })
    await adapter.restore('abcdef', state, { source, isCurrent: () => false })
    expect(source.getCursor()).toEqual({ line: 0, ch: 0 })
  })
  it('safely rejects an invalid Muya selection and retains independent scroll positions', async() => {
    const view = rendered('Text\n')
    const state: DocumentViewState = {
      contentSha256: await hash('Text\n'),
      sourceSelection: null,
      muyaSelection: {
        kind: 'text',
        anchor: { path: ['missing', 999], offset: 99 },
        focus: { path: ['missing', 999], offset: 99 }
      },
      renderedScrollTopPx: 100,
      sourceScrollTopPx: 200,
      collapsedOutlineKeys: []
    }
    await adapter.restore('Text\n', state, { rendered: view })
    expect(view.engine.getSelectedText()).toBe('')
    expect(view.container.scrollTop).toBe(100)
  })
  it.each(['image', 'table'] as const)(
    'restores a real %s selection after rebuilding the editor',
    async(kind) => {
      const markdown =
        kind === 'image' ? '![alt](image.png)\n' : '| a | b |\n| --- | --- |\n| c | d |\n'
      const first = rendered(markdown)
      const content = first.engine.editor.scrollPage?.firstContentInDescendant()
      if (!content) throw new Error('Missing fixture content')
      const selection: TSelectionState =
        kind === 'image'
          ? {
            kind: SelectionType.IMAGE,
            path: content.path,
            range: { start: 0, end: content.text.length },
            raw: content.text
          }
          : {
            kind: SelectionType.TABLE,
            tablePath: [0],
            anchor: { row: 0, column: 0 },
            focus: { row: 1, column: 1 }
          }
      expect(first.engine.setSelection(selection)).toBe(true)
      const state = await adapter.capture(markdown, { rendered: first })
      const second = rendered(markdown)
      await adapter.restore(markdown, state, { rendered: second })
      expect(second.engine.getSelectionState()).toEqual(first.engine.getSelectionState())
      expect(second.engine.getSelectionState()?.kind).toBe(kind)
    }
  )
})
