import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { HeaderFooterSeparatorStyle } from '@/components/exportSettings/persistence'

vi.hoisted(() => {
  window.path = {
    sep: '/',
    join: (...parts: string[]) => parts.join('/'),
    resolve: (...parts: string[]) => parts.join('/')
  } as never
  window.DIRNAME = '/docs'
})

vi.mock('@muyajs/core', async() => ({
  ...await import('@muyajs/core/utils/index'),
  MarkdownToHtml: class {
    async generateWithHeadings({ extraCSS = '' }: { extraCSS?: string }) {
      return {
        html: `<html><head><style>${extraCSS}</style></head><body><article class="markdown-body"><p>Body content</p></article></body></html>`,
        headings: []
      }
    }
  }
}))

import { headerFooterStyledFor } from '@/components/exportSettings/persistence'
import { exportStyledHTML } from '@/util/exportHtml'
import { getCssForOptions } from '@/util/pdf'

const themes = ['default', 'academic', 'liber'] as const
const styles: HeaderFooterSeparatorStyle[] = ['theme', 'show', 'hide']
const cases = themes.flatMap(theme => styles.flatMap(style =>
  [false, true].map(customSize => ({ theme, style, customSize }))
))

const themeCss = (theme: typeof themes[number]) => theme === 'default' ? '' : readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../../src/renderer/src/assets/themes/export', `${theme}.theme.css`),
  'utf8'
)

const loadDocument = (html: string) => {
  const exported = new DOMParser().parseFromString(html, 'text/html')
  // jsdom does not resolve custom properties inside border shorthands.
  // Keep the production selectors; browser/PDF coverage checks the variable.
  document.head.innerHTML = exported.head.innerHTML.replaceAll('var(--footerHeaderBorderColor)', '#1c1c1c')
  document.body.innerHTML = exported.body.innerHTML
}

afterEach(() => {
  document.head.innerHTML = ''
  document.body.innerHTML = ''
})

describe('header and footer separator choices', () => {
  it.each(cases)('$theme / $style / custom font size $customSize', async({ theme, style, customSize }) => {
    // Vitest leaves CSS ?inline imports empty. Read the production theme file
    // so this checks its selectors and cascade, including the .simple opt-out.
    const extraCss = themeCss(theme) + await getCssForOptions({
      type: 'styledHtml',
      headerFooterFontSize: customSize ? 20 : undefined
    })
    const html = await exportStyledHTML(null as never, 'Body content', {
      extraCss,
      header: { type: 1, center: 'Header' },
      footer: { type: 1, center: 'Footer' },
      headerFooterStyled: headerFooterStyledFor(style)
    })
    loadDocument(html)

    const expectedLine = style === 'show' || (style === 'theme' && theme !== 'default')
    for (const [selector, edge] of [
      ['.page-header', 'borderBottom'],
      ['.page-footer', 'borderTop']
    ] as const) {
      const container = document.querySelector(`${selector} .hf-container`) as HTMLElement
      const computed = getComputedStyle(container)
      const visible = parseFloat(computed[`${edge}Width`]) > 0 && computed[`${edge}Style`] !== 'none'
      expect(visible, `${selector} separator`).toBe(expectedLine)
      if (customSize) expect(computed.fontSize).toBe('20px')
      else expect(computed.fontSize).not.toBe('20px')
    }
    const spacer = document.querySelector('.page-container > tfoot') as HTMLElement
    expect(getComputedStyle(spacer).display).toBe('table-footer-group')
    expect(getComputedStyle(document.querySelector('.page-footer') as HTMLElement).position).toBe('fixed')
    expect(document.querySelector('.markdown-body')?.textContent).toContain('Body content')
  })

  it.each(['header', 'footer'] as const)('supports a %s alone with tripartite content', async(part) => {
    const html = await exportStyledHTML(null as never, 'Body content', {
      [part]: { type: 2, left: 'Left', center: 'Center', right: 'Right' },
      headerFooterStyled: headerFooterStyledFor('show')
    })
    loadDocument(html)

    const target = document.querySelector(`.page-${part}`) as HTMLElement
    const other = part === 'header' ? 'footer' : 'header'
    expect(document.querySelector(`.page-${other}`)).toBeNull()
    expect(target.classList.contains('styled')).toBe(true)
    expect(target.classList.contains('single')).toBe(false)
    expect(Array.from(target.querySelectorAll('.hf-container > div'), node => node.textContent)).toEqual([
      'Left', 'Center', 'Right'
    ])
    expect(!!document.querySelector('.page-footer-fake')).toBe(part === 'footer')
  })

  it('keeps single-part content and sanitization when lines are hidden with a custom size', async() => {
    const html = await exportStyledHTML(null as never, 'Body content', {
      extraCss: themeCss('academic') + await getCssForOptions({
        type: 'styledHtml', headerFooterFontSize: 20
      }),
      header: { type: 1, center: '<strong>Header</strong><script>unsafeMarker()</script>' },
      footer: { type: 1, center: '<a href="javascript:unsafeMarker()" onclick="unsafeMarker()">Footer</a>' },
      headerFooterStyled: headerFooterStyledFor('hide')
    })
    loadDocument(html)

    expect(document.querySelector('.page-header strong')?.textContent).toBe('Header')
    expect(document.querySelector('.page-footer a')?.textContent).toBe('Footer')
    expect(document.querySelector('script, [onclick], [href^="javascript:"]')).toBeNull()
    for (const part of ['header', 'footer']) {
      expect(document.querySelector(`.page-${part}`)?.classList.contains('single')).toBe(true)
      expect(getComputedStyle(document.querySelector(`.${part}-content-left`) as HTMLElement).display).toBe('none')
      expect(getComputedStyle(document.querySelector(`.${part}-content-right`) as HTMLElement).display).toBe('none')
    }
  })
})
