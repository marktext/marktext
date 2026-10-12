import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// `printService` imports `resolveLocalImageSrc`, which reads `window.path` /
// `window.DIRNAME` for its relative-resolve branch. Stub those preload
// surfaces before the hoisted import runs (mirrors printService-image.spec.ts).
vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: { path?: { sep: string }; DIRNAME?: string }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/' }
  w.window.DIRNAME = '/docs'
})

import MarkdownPrint from '@/services/printService'

// PDF / print render into an `<article class="print-container">` appended to
// `document.body` (a sibling of `.editor-wrapper`), and `innerHTML = html`
// discards the outer `<html dir="rtl">` shell produced by the exporter. Without
// propagating the direction onto the container itself, RTL documents print LTR
// (#4833). These specs pin that the container carries the direction.
describe('MarkdownPrint — text direction on the print container', () => {
  beforeEach(() => {
    Object.defineProperty(document, 'fonts', {
      configurable: true,
      value: { load: vi.fn().mockResolvedValue([]), ready: Promise.resolve() }
    })
  })
  afterEach(() => {
    document.body.querySelectorAll('article.print-container').forEach((n) => n.remove())
  })

  const article = '<article class="markdown-body"><p>سلام</p></article>'

  it('sets dir="rtl" on the print container for an RTL export', async() => {
    await new MarkdownPrint().renderMarkdown(article, true, 'rtl')
    const container = document.body.querySelector('article.print-container')
    expect(container?.getAttribute('dir')).toBe('rtl')
  })

  it('sets dir="auto" on the print container for an auto export', async() => {
    await new MarkdownPrint().renderMarkdown(article, true, 'auto')
    const container = document.body.querySelector('article.print-container')
    expect(container?.getAttribute('dir')).toBe('auto')
  })

  it('leaves the container without a dir attribute for LTR (unchanged default)', async() => {
    await new MarkdownPrint().renderMarkdown(article, true, 'ltr')
    const container = document.body.querySelector('article.print-container')
    expect(container?.hasAttribute('dir')).toBe(false)
  })

  it('leaves the container without a dir attribute when no direction is passed', async() => {
    await new MarkdownPrint().renderMarkdown(article, true)
    const container = document.body.querySelector('article.print-container')
    expect(container?.hasAttribute('dir')).toBe(false)
  })

  it('waits for notation fonts before allowing PDF export', async() => {
    let finishLoading!: () => void
    const loading = new Promise<void>((resolve) => {
      finishLoading = resolve
    })
    vi.mocked(document.fonts.load).mockImplementation(() => loading.then(() => []))
    let ready = false
    const rendering = new MarkdownPrint().renderMarkdown(article, true).then(() => {
      ready = true
    })
    await Promise.resolve()
    expect(ready).toBe(false)
    expect(document.fonts.load).toHaveBeenCalledWith('16px "Noto Music"', '𝅗𝅥𝅘𝅥𝅯')
    expect(document.fonts.load).toHaveBeenCalledWith('16px "Noto Sans Math"', '⏜⏝')
    finishLoading()
    await rendering
    expect(ready).toBe(true)
  })
})
