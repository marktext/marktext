import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@muyajs/core', () => ({
  MarkdownToHtml: class {
    async generateWithHeadings({ extraCSS = '' }: { extraCSS?: string }) {
      return {
        html: `<html><head><style>${extraCSS}</style></head><body><article class="markdown-body"><p>Content</p></article></body></html>`,
        headings: []
      }
    }
  }
}))

vi.mock('@/util/resolveLinkHref', () => ({ resolveLocalLinkHref: (value: string) => value }))

const { exportStyledHTML } = await import('@/util/exportHtml')

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('PDF footer space (#5984)', () => {
  it.each([false, true])(
    'keeps the spacer as a footer group with header=%s',
    async(withHeader) => {
      const html = await exportStyledHTML({} as never, 'Content', {
        header: withHeader ? { type: 1, center: 'Header' } : null,
        footer: { type: 1, center: 'Footer' }
      })
      const exported = new DOMParser().parseFromString(html, 'text/html')
      document.head.innerHTML = exported.head.innerHTML
      document.body.innerHTML = exported.body.innerHTML

      // As a header group the spacer leaves the bottom unreserved, letting
      // the fixed footer overlap body text when a page fills.
      const spacer = document.querySelector('.page-container > tfoot') as HTMLElement
      expect(getComputedStyle(spacer).display).toBe('table-footer-group')
      expect(getComputedStyle(document.querySelector('.page-footer') as HTMLElement).position).toBe(
        'fixed'
      )
      if (withHeader) {
        expect(
          getComputedStyle(document.querySelector('.page-container > thead') as HTMLElement).display
        ).toBe('table-header-group')
      }
    }
  )

  it('does not add footer space to a header-only document', async() => {
    const html = await exportStyledHTML({} as never, 'Content', {
      header: { type: 1, center: 'Header' }
    })
    const exported = new DOMParser().parseFromString(html, 'text/html')

    expect(exported.querySelector('.page-container > thead')).not.toBeNull()
    expect(exported.querySelector('.page-container > tfoot, .page-footer')).toBeNull()
  })
})
