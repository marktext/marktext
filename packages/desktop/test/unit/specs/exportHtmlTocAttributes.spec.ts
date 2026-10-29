import { describe, expect, it, vi } from 'vitest'

vi.hoisted(() => {
  Object.assign(window, { path: { sep: '/' }, DIRNAME: '/docs' })
})

import { MarkdownToHtml } from '@muyajs/core'
import { injectHtmlToc } from '@/util/exportHtml'

const TOC = '<div class="toc-container">Contents</div>'

describe('export TOC paragraph attributes (#4954)', () => {
  it.each([
    '<p class="toc-marker">[TOC]</p>',
    '<p data-align="center"> [toc] </p>',
    '<p title="a > b">[TOC]</p>'
  ])('expands a rendered TOC paragraph: %s', async(marker) => {
    const article = await new MarkdownToHtml(`# Title\n\n${marker}\n\n## Section`).renderHtml()
    const out = injectHtmlToc(article, TOC)
    const doc = new DOMParser().parseFromString(out, 'text/html')

    expect(doc.querySelectorAll('.toc-container')).toHaveLength(1)
    expect(doc.querySelector('article')?.textContent).not.toMatch(/\[toc\]/i)
    expect(doc.querySelector('h2')?.id).toBe('section')
  })

  it('accepts data attributes added after sanitization', () => {
    expect(injectHtmlToc('<p data-md="">[TOC]</p>', TOC)).toBe(TOC)
  })
})
