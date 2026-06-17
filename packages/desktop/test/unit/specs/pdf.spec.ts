import { describe, it, expect, beforeEach, vi } from 'vitest'

// `@/util/pdf` reads `window.path.join` and (for disk themes)
// `window.marktext.paths` / `window.fileUtils` at call time, all normally
// injected by the preload bridge. Stub the surface before the hoisted imports
// run so the module graph can load. Per-test overrides below swap the
// `window.fileUtils` behavior via `vi.resetModules()` + dynamic import.
vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string, join: (...parts: string[]) => string }
      marktext?: { paths: { userDataPath: string } }
      fileUtils?: { isFile: (p: string) => Promise<boolean>, readFile: (p: string) => Promise<unknown> }
    }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/', join: (...parts: string[]) => parts.join('/') }
  w.window.marktext ??= { paths: { userDataPath: '/userData' } }
  w.window.fileUtils ??= { isFile: async() => false, readFile: async() => '' }
})

// NOTE: `academic.theme.css?inline` / `liber.theme.css?inline` resolve to an
// EMPTY string under vitest (no CSS `?inline` transform is configured), so the
// academic/liber branch contributes no CSS in this environment. We therefore
// characterize the branch *dispatch* (academic/liber take the inline path and
// never touch `window.fileUtils`/`window.marktext`, unlike a disk theme name)
// rather than asserting a theme-specific selector token, which is unavailable
// here. See suspectedBugs / notes.

const loadPdf = async() => {
  return import('@/util/pdf')
}

describe('getCssForOptions', () => {
  beforeEach(() => {
    vi.resetModules()
    const w = globalThis as unknown as {
      window: {
        marktext: { paths: { userDataPath: string } }
        fileUtils: { isFile: (p: string) => Promise<boolean>, readFile: (p: string) => Promise<unknown> }
      }
    }
    w.window.marktext = { paths: { userDataPath: '/userData' } }
    w.window.fileUtils = { isFile: async() => false, readFile: async() => '' }
  })

  it('academic/liber take the inline-theme branch (no disk access required)', async() => {
    const { getCssForOptions } = await loadPdf()
    // Remove the disk surfaces entirely: if academic/liber tried a disk read
    // these would throw. They must not.
    const w = globalThis as unknown as { window: Record<string, unknown> }
    delete w.window.marktext
    delete w.window.fileUtils

    await expect(getCssForOptions({ theme: 'academic' })).resolves.toBeTypeOf('string')
    await expect(getCssForOptions({ theme: 'liber' })).resolves.toBeTypeOf('string')
  })

  it('appends no theme CSS for theme:"default" (disk lookup misses) or {}', async() => {
    const { getCssForOptions } = await loadPdf()
    // 'default' is NOT special-cased: it falls into the disk branch, which
    // reads window.marktext.paths + window.fileUtils.isFile (→ false here).
    const def = await getCssForOptions({ theme: 'default' })
    const empty = await getCssForOptions({})

    // Both produce the same base stylesheet (no theme block appended).
    expect(def).toBe(empty)
    expect(def).not.toContain('Georgia')
    expect(def).toContain('.markdown-body{')
  })

  it('reads a custom theme name from disk via window.fileUtils', async() => {
    const isFile = vi.fn(async() => true)
    const readFile = vi.fn(async() => '.custom{}')
    const w = globalThis as unknown as {
      window: { fileUtils: { isFile: typeof isFile, readFile: typeof readFile } }
    }
    w.window.fileUtils = { isFile, readFile }

    const { getCssForOptions } = await loadPdf()
    const css = await getCssForOptions({ theme: 'mytheme' })

    expect(css).toContain('.custom{}')
    expect(isFile).toHaveBeenCalledWith('/userData/themes/export/mytheme')
  })

  it('omits the disk theme CSS when the theme file is absent', async() => {
    const w = globalThis as unknown as {
      window: { fileUtils: { isFile: () => Promise<boolean>, readFile: () => Promise<unknown> } }
    }
    w.window.fileUtils = { isFile: async() => false, readFile: async() => '.custom{}' }

    const { getCssForOptions } = await loadPdf()
    const css = await getCssForOptions({ theme: 'mytheme' })

    expect(css).not.toContain('.custom{}')
  })

  it('round-trips a disk theme containing CSS child-combinator (>) selectors', async() => {
    // The whole stylesheet is escapeHTML → sanitize → unescapeHTML'd, so a `>`
    // in a theme selector must survive the round-trip unmangled.
    const w = globalThis as unknown as {
      window: { fileUtils: { isFile: () => Promise<boolean>, readFile: () => Promise<string> } }
    }
    w.window.fileUtils = { isFile: async() => true, readFile: async() => '.a > .b{color:red}' }

    const { getCssForOptions } = await loadPdf()
    const css = await getCssForOptions({ theme: 'mytheme' })

    expect(css).toContain('.a > .b{color:red}')
  })

  it('emits font-family/size/line-height rules into .markdown-body', async() => {
    const { getCssForOptions } = await loadPdf()
    const css = await getCssForOptions({ fontFamily: 'Foo', fontSize: 14, lineHeight: 1.6 })

    expect(css).toContain('font-family:"Foo"')
    expect(css).toContain('font-size:14px;')
    expect(css).toContain('line-height:1.6;')
    // The font-family also seeds the header/footer container.
    expect(css).toContain('.hf-container{font-family:"Foo"')
  })

  it('adds heading auto-numbering CSS when autoNumberingHeadings is set', async() => {
    const { getCssForOptions } = await loadPdf()
    const css = await getCssForOptions({ autoNumberingHeadings: true })

    expect(css).toContain('counter-reset')
    expect(css).toContain('h2:before')
  })

  it('hides front matter when showFrontMatter is false, not when true', async() => {
    const { getCssForOptions } = await loadPdf()
    const hidden = await getCssForOptions({ showFrontMatter: false })
    const shown = await getCssForOptions({ showFrontMatter: true })

    expect(hidden).toContain('pre.front-matter{display:none')
    expect(shown).not.toContain('pre.front-matter{display:none')
  })

  it('emits header/footer font-size rules when headerFooterFontSize is set', async() => {
    const { getCssForOptions } = await loadPdf()
    const css = await getCssForOptions({ headerFooterFontSize: 9 })

    expect(css).toContain('font-size: 9px;')
    expect(css).toContain('.page-header .hf-container')
  })

  it('wraps printable CSS in an @media print @page block by default', async() => {
    const { getCssForOptions } = await loadPdf()
    const printable = await getCssForOptions({})
    const styledHtml = await getCssForOptions({ type: 'styledHtml' })

    expect(printable).toContain('@media print{@page{')
    // type === 'styledHtml' is the only non-printable mode.
    expect(styledHtml).not.toContain('@media print')
  })
})

describe('getHtmlToc', () => {
  it('renders a "Table of Contents" title and excludes the top H1 by default', async() => {
    const { getHtmlToc } = await loadPdf()
    const toc = [
      { lvl: 1, content: 'Top' },
      { lvl: 2, content: 'Sub' }
    ]
    const html = getHtmlToc(toc, {})

    expect(html).toContain('class="toc-title"')
    expect(html).toContain('Table of Contents')
    // Top H1 is dropped, its sub-heading is kept.
    expect(html).not.toContain('href="#top"')
    expect(html).toContain('href="#sub"')
  })

  it('includes the top heading and honors a custom tocTitle', async() => {
    const { getHtmlToc } = await loadPdf()
    const toc = [
      { lvl: 1, content: 'Top' },
      { lvl: 2, content: 'Sub' }
    ]
    const html = getHtmlToc(toc, { tocTitle: 'Contents', tocIncludeTopHeading: true })

    expect(html).toContain('Contents')
    expect(html).toContain('href="#top"')
    expect(html).toContain('href="#sub"')
  })

  it('clones its input — repeated calls are stable (the helper shifts internally)', async() => {
    const { getHtmlToc } = await loadPdf()
    const toc = [
      { lvl: 1, content: 'Top' },
      { lvl: 2, content: 'Sub' }
    ]
    const first = getHtmlToc(toc, { tocIncludeTopHeading: true })
    const second = getHtmlToc(toc, { tocIncludeTopHeading: true })

    expect(second).toBe(first)
    // The caller's array is untouched (no shift leaked out).
    expect(toc).toHaveLength(2)
    expect(toc[0]).toEqual({ lvl: 1, content: 'Top' })
  })

  it('dedups identical heading slugs in document order with -N suffixes', async() => {
    const { getHtmlToc } = await loadPdf()
    const toc = [
      { lvl: 2, content: 'Installation' },
      { lvl: 2, content: 'Installation' }
    ]
    const html = getHtmlToc(toc, { tocIncludeTopHeading: true })

    expect(html).toContain('href="#installation"')
    expect(html).toContain('href="#installation-1"')
  })

  it('returns an empty string when the TOC has no qualifying entries', async() => {
    const { getHtmlToc } = await loadPdf()
    // A lone top-level H1 is shifted away by the default (exclude-top) path,
    // leaving nothing to render.
    expect(getHtmlToc([{ lvl: 1, content: 'Only' }], {})).toBe('')
    expect(getHtmlToc([], {})).toBe('')
  })
})
