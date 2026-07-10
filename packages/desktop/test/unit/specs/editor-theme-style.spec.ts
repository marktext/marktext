import { describe, it, expect, beforeEach, vi } from 'vitest'

// `theme.ts` transitively imports `@/config`, whose first line reads
// `window.path.sep` at module-load time. Stub the preload `window.path` surface
// before the hoisted import runs.
vi.hoisted(() => {
  const w = globalThis as unknown as { window?: { path?: { sep: string } } }
  w.window ??= {}
  w.window.path ??= { sep: '/' }
})

import { addCommonStyle, setEditorWidth } from '@/util/theme'
import { COMMON_STYLE_ID, DEFAULT_CODE_FONT_FAMILY } from '@/config'

const styleHtml = (id: string) =>
  (document.querySelector(`#${id}`) as HTMLStyleElement | null)?.innerHTML ?? ''

const styleCount = (id: string) => document.querySelectorAll(`#${id}`).length

describe('theme.ts style injection helpers', () => {
  beforeEach(() => {
    document.head.innerHTML = ''
    document.body.className = ''
  })

  // Items 196, 210 — addCommonStyle injects code font onto the source-mode .CodeMirror selector.
  describe('addCommonStyle', () => {
    it('injects code font-family/size onto the .CodeMirror selector', () => {
      addCommonStyle({ codeFontFamily: 'Courier New', codeFontSize: 24 })

      const css = styleHtml(COMMON_STYLE_ID)
      // selector targets source-mode CodeMirror only (muya owns code-block font via --mu-code-* vars)
      expect(css).toContain('.CodeMirror')
      expect(css).not.toContain('.mu-code-block')
      // family is the requested font followed by the default fallback chain
      expect(css).toContain(`font-family: Courier New, ${DEFAULT_CODE_FONT_FAMILY};`)
      // size is the numeric value suffixed with px
      expect(css).toContain('font-size: 24px;')
    })

    it('targets only .CodeMirror (no legacy ag-* or mu-code-block classes)', () => {
      addCommonStyle({ codeFontFamily: 'Courier New', codeFontSize: 14 })

      const css = styleHtml(COMMON_STYLE_ID)
      expect(css).toContain('.CodeMirror')
      expect(css).not.toContain('.ag-code-block')
      expect(css).not.toContain('.mu-code-block')
    })

    it('prepends the webkit scrollbar hide rule when hideScrollbar is true', () => {
      addCommonStyle({ codeFontFamily: 'Courier New', codeFontSize: 14, hideScrollbar: true })

      expect(styleHtml(COMMON_STYLE_ID)).toContain('::-webkit-scrollbar {display: none;}')
    })

    it('omits the scrollbar rule when hideScrollbar is false', () => {
      addCommonStyle({ codeFontFamily: 'Courier New', codeFontSize: 14, hideScrollbar: false })

      expect(styleHtml(COMMON_STYLE_ID)).not.toContain('::-webkit-scrollbar')
    })

    it('reuses a single style element across calls (replaces, never appends)', () => {
      addCommonStyle({ codeFontFamily: 'Courier New', codeFontSize: 14 })
      addCommonStyle({ codeFontFamily: 'Fira Code', codeFontSize: 18 })

      expect(styleCount(COMMON_STYLE_ID)).toBe(1)
      const css = styleHtml(COMMON_STYLE_ID)
      // only the latest call's values survive
      expect(css).toContain(`font-family: Fira Code, ${DEFAULT_CODE_FONT_FAMILY};`)
      expect(css).toContain('font-size: 18px;')
      expect(css).not.toContain('Courier New')
      expect(css).not.toContain('font-size: 14px;')
    })
  })

  // Item 209 — setEditorWidth validates input and injects --editorAreaWidth override.
  describe('setEditorWidth', () => {
    const WIDTH_STYLE_ID = 'editor-width'

    it.each(['60ch', '800px', '50%'])(
      'writes a calc() override for the valid value %s',
      (value) => {
        setEditorWidth(value)

        expect(styleHtml(WIDTH_STYLE_ID)).toBe(
          `:root { --editorAreaWidth: calc(100px + ${value}); --editor-area-width: calc(100px + ${value}); }`
        )
      }
    )

    it('overrides the active @muyajs/core width variable, not only the legacy one', () => {
      // The WYSIWYG engine reads the kebab-case `--editor-area-width`
      // (`.mu-container` max-width); the legacy camelCase `--editorAreaWidth`
      // only reaches source mode. Both must be set or the preference is a no-op
      // on the default theme (issue #4828).
      setEditorWidth('60%')

      expect(styleHtml(WIDTH_STYLE_ID)).toContain('--editor-area-width: calc(100px + 60%);')
    })

    it('clears the override (empty innerHTML) for an empty string', () => {
      setEditorWidth('800px')
      setEditorWidth('')

      expect(styleHtml(WIDTH_STYLE_ID)).toBe('')
    })

    it.each(['abc', '10', '10em'])(
      'rejects the invalid value %s and writes nothing',
      (value) => {
        setEditorWidth(value)

        expect(styleHtml(WIDTH_STYLE_ID)).toBe('')
      }
    )

    it('reuses a single style element across calls', () => {
      setEditorWidth('60ch')
      setEditorWidth('50%')
      setEditorWidth('abc')

      expect(styleCount(WIDTH_STYLE_ID)).toBe(1)
      // the invalid final call cleared the previously valid override
      expect(styleHtml(WIDTH_STYLE_ID)).toBe('')
    })
  })
})
