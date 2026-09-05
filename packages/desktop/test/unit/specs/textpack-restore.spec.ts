import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'

// Exercise the real buffer normalizer without importing the renderer's editor,
// Electron and Vue component dependencies. This follows the source-loading
// approach used by the source-code-image-action regression tests.
const source = readFileSync(resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/renderer/src/store/editor.ts'), 'utf8')
const helpers = source.slice(source.indexOf('interface BufferedTabState'))
const compiled = ts.transpileModule(helpers, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 }
}).outputText
const defaults = {
  pathname: '',
  filename: 'Untitled',
  markdown: '',
  isSaved: true,
  documentKind: 'markdown',
  resourcePath: '',
  encoding: { encoding: 'utf8', isBom: false },
  lineEnding: 'lf',
  trimTrailingNewline: 2,
  adjustLineEndingOnSave: false,
  cursor: null,
  wordCount: {},
  muyaIndexCursor: null,
  scrollTop: 0
}
// eslint-disable-next-line no-new-func
const normalize = new Function('defaultFileState', 'toSerializableValue', `${compiled}\nreturn createBufferedEditorState`)(
  defaults,
  (value: unknown, fallback: unknown) => JSON.parse(JSON.stringify(value ?? fallback))
) as (state: unknown) => { currentFileId: string; tabs: Array<Record<string, unknown>> }

describe('TextPack buffered tab restoration', () => {
  it('retains the document kind and fresh resource directory supplied by main', () => {
    const restored = normalize({
      currentFileId: 'pack',
      tabs: [{
        id: 'pack',
        pathname: 'C:/notes/note.textpack',
        documentKind: 'textpack',
        resourcePath: 'C:/Temp/new-session/content',
        markdown: '![](assets/photo.png)',
        isSaved: true
      }]
    })
    expect(restored.currentFileId).toBe('pack')
    expect(restored.tabs[0]).toMatchObject({
      documentKind: 'textpack',
      resourcePath: 'C:/Temp/new-session/content',
      pathname: 'C:/notes/note.textpack',
      markdown: '![](assets/photo.png)'
    })
  })

  it('preserves the descriptor through buffer serialization and restoration with dirty text', () => {
    const state = {
      currentFileId: 'pack',
      tabs: [{
        id: 'pack',
        documentKind: 'textpack',
        resourcePath: 'C:/Temp/old-session/content',
        pathname: 'C:/notes/note.textpack',
        markdown: '# Unsaved',
        isSaved: false
      }]
    }
    const serialized = JSON.parse(JSON.stringify(normalize(state)))
    // Main recreates the workspace before sending mt::load-state.
    serialized.tabs[0].resourcePath = 'C:/Temp/recreated-session/content'
    expect(normalize(serialized).tabs[0]).toMatchObject({
      documentKind: 'textpack',
      resourcePath: 'C:/Temp/recreated-session/content',
      markdown: '# Unsaved',
      isSaved: false
    })
  })

  it('keeps old Markdown buffers compatible when the new fields are absent', () => {
    const restored = normalize({ tabs: [{ id: 'md', pathname: 'C:/notes/note.md' }] })
    expect(restored.tabs[0]).toMatchObject({ documentKind: 'markdown', resourcePath: '' })
  })
})
