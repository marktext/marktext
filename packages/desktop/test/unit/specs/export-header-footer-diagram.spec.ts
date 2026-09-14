import { describe, expect, it, vi } from 'vitest'

// #3359 — exporting with Header & Footer enabled dropped diagram (mermaid)
// content. The header/footer branch re-sanitized the WHOLE already-rendered
// article with the export DOMPurify config, which strips the <foreignObject>
// that mermaid renders its node labels into; the no-header/footer branch never
// re-sanitized, so the same document exported fine without header/footer.

const FULL_DOC =
  '<html><head></head><body>' +
  '<article class="markdown-body">' +
  '<figure class="mu-diagram-block"><svg class="mermaid"><g class="node">' +
  '<foreignObject width="80" height="20"><div xmlns="http://www.w3.org/1999/xhtml">' +
  '<span class="nodeLabel"><p>DiagramLabel</p></span></div></foreignObject>' +
  '</g></svg></figure>' +
  '</article></body></html>'

vi.mock('@muyajs/core', () => ({
  MarkdownToHtml: class {
    async generate(): Promise<string> {
      return FULL_DOC
    }
  }
}))

vi.mock('@/util/resolveImageSrc', () => ({ resolveLocalImageSrc: (s: string) => s }))
vi.mock('@/util/resolveLinkHref', () => ({ resolveLocalLinkHref: (s: string) => s }))

const { exportStyledHTML } = await import('@/util/exportHtml')

const fakeMuya = {} as never

describe('export with Header & Footer preserves diagram content (#3359)', () => {
  it('keeps the mermaid foreignObject label when a header is present', async() => {
    const html = await exportStyledHTML(fakeMuya, '```mermaid\ngraph LR\n```', {
      header: { type: 0, left: '', center: 'My Title', right: '' }
    })
    expect(html).toContain('DiagramLabel')
    expect(html).toContain('My Title')
  })

  it('still strips unsafe markup from the user-supplied header text', async() => {
    const html = await exportStyledHTML(fakeMuya, 'x', {
      header: { type: 0, left: '', center: '<script>alert(1)</script>Safe', right: '' }
    })
    expect(html).toContain('Safe')
    expect(html).not.toContain('<script>')
  })
})
