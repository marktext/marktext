import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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
    await new MarkdownPrint().renderMarkdown(article, 'rtl')
    const container = document.body.querySelector('article.print-container')
    expect(container?.getAttribute('dir')).toBe('rtl')
  })

  it('sets dir="auto" on the print container for an auto export', async() => {
    await new MarkdownPrint().renderMarkdown(article, 'auto')
    const container = document.body.querySelector('article.print-container')
    expect(container?.getAttribute('dir')).toBe('auto')
  })

  it('leaves the container without a dir attribute for LTR (unchanged default)', async() => {
    await new MarkdownPrint().renderMarkdown(article, 'ltr')
    const container = document.body.querySelector('article.print-container')
    expect(container?.hasAttribute('dir')).toBe(false)
  })

  it('leaves the container without a dir attribute when no direction is passed', async() => {
    await new MarkdownPrint().renderMarkdown(article)
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
    const rendering = new MarkdownPrint().renderMarkdown(article).then(() => {
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
