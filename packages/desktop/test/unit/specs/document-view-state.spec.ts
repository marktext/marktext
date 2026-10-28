import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CodeMirror from 'codemirror'
import { Muya, SelectionType, type TSelectionState } from '@muyajs/core'
import { createHash, webcrypto } from 'node:crypto'
import { DocumentViewAdapter, isDocumentViewReady, registerRenderedViewState } from '@/services/documentViewState'
import type { DocumentViewState } from '../../../src/shared/types/files'

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
const sourceView = (editor: CodeMirror.Editor) => ({ editor, container: document.createElement('div') })
const adapter = new DocumentViewAdapter(hash)
describe('document view adapters with reconstructed editors', () => {
  it('hashes UTF-8 Markdown with the shared browser hashing utility', async() => {
    vi.spyOn(window, 'crypto', 'get').mockReturnValue(webcrypto as unknown as Crypto)
    const markdown = '# 标题 🌱\n'
    const state = await new DocumentViewAdapter().capture(markdown, {})
    expect(state.contentSha256).toBe(await hash(markdown))
  })

  it('restores a backward source selection in a new CodeMirror instance and clamps invalid positions', async() => {
    const markdown = 'First line\nSecond line'
    const first = CodeMirror(document.body, { value: markdown })
    first.setSelection({ line: 1, ch: 6 }, { line: 0, ch: 2 })
    const state = await adapter.capture(markdown, { source: sourceView(first) })
    const second = CodeMirror(document.body, { value: markdown })
    await adapter.restore(markdown, state, { source: sourceView(second) })
    expect(second.getCursor('anchor')).toEqual({ line: 1, ch: 6 })
    expect(second.getCursor('head')).toEqual({ line: 0, ch: 2 })
    state.sourceSelection = { anchor: { line: 999, ch: 999 }, focus: { line: -2, ch: -3 } }
    await adapter.restore(markdown, state, { source: sourceView(second) })
    expect(second.getCursor('anchor')).toEqual({ line: 1, ch: 11 })
    expect(second.getCursor('head')).toEqual({ line: 0, ch: 0 })
  })
  it('compares normalized rendered text without discarding trailing question marks', () => {
    const view = rendered('Question?')
    const release = registerRenderedViewState({
      documentId: () => 'document',
      markdown: () => view.engine.getMarkdown(),
      view
    })
    try {
      expect(isDocumentViewReady('document', 'Question?', 0)).toBe(true)
      expect(isDocumentViewReady('document', 'Different?', 0)).toBe(false)
      expect(isDocumentViewReady('another-document', 'Question?', 0)).toBe(false)
    } finally {
      release()
    }
  })

  it('captures source selections using the same newline policy as the document', async() => {
    const editor = CodeMirror(document.body, { value: 'Question?\n' })
    editor.setSelection({ line: 0, ch: 2 }, { line: 0, ch: 5 })
    const state = await adapter.capture('Question?', {
      source: sourceView(editor),
      trimTrailingNewline: 0
    })
    expect(state.sourceSelection).toEqual({ anchor: { line: 0, ch: 2 }, focus: { line: 0, ch: 5 } })
  })

  it('captures and restores the outer source scroller without depending on CodeMirror scrolling', async() => {
    const first = sourceView(CodeMirror(document.body, { value: 'source' }))
    first.container.scrollTop = 480
    const state = await adapter.capture('source', { source: first })
    expect(state.sourceScrollTopPx).toBe(480)
    const second = sourceView(CodeMirror(document.body, { value: 'source' }))
    await adapter.restore('source', state, { source: second })
    expect(second.container.scrollTop).toBe(480)
    expect(second.editor.getScrollInfo().top).toBe(0)
    await adapter.restore('source', state, { source: second }, false)
    expect(second.container.scrollTop).toBe(0)
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
    const state = await adapter.capture('abcdef', { source: sourceView(source) })
    await adapter.restore('abcdef', state, { source: sourceView(source) }, false)
    expect(source.getCursor()).toEqual({ line: 0, ch: 0 })
    await adapter.restore('abcdef', state, { source: sourceView(source), isCurrent: () => false })
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
