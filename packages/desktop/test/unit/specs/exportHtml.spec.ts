import { describe, it, expect, vi } from 'vitest'

// `@/util/pdf` (imported transitively for `getHtmlToc`) and the export wrapper
// reach `window.path` / `window.fileUtils` / `window.marktext` via the preload
// bridge. Stub the surfaces the modules touch before the hoisted imports run.
vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: {
        sep: string
        join?: (...parts: string[]) => string
        resolve?: (...parts: string[]) => string
      }
      fileUtils?: unknown
      marktext?: unknown
      DIRNAME?: string
    }
  }
  w.window ??= {}
  w.window.path ??= {
    sep: '/',
    join: (...parts: string[]) =>
      parts.join('/').replace(/\/\.\//g, '/').replace(/\/{3,}/g, '//'),
    // Some transitive helpers still expect a minimal POSIX-ish `resolve`.
    resolve: (...parts: string[]) =>
      parts.join('/').replace(/\/\.\//g, '/').replace(/\/{2,}/g, '/')
  }
  // The document directory relative <img> srcs and links resolve against (the
  // engine's `resolveExportImageSrc` and `resolveLocalLinkHref`).
  w.window.DIRNAME = '/docs'
})

import { exportStyledHTML } from '@/util/exportHtml'

// `exportStyledHTML(muya, markdown, options)` renders through the real
// `@muyajs/core` `MarkdownToHtml` engine (which runs in jsdom). The first arg is
// a Muya instance, but the engine treats it as optional — the export path only
// reads a few `muya.options.*` flags with `??` defaults — so the desktop wrapper
// works with a bare `null` here, matching the engine's own parity suite which
// calls `new MarkdownToHtml(md).generate(...)` with no muya.
const NO_MUYA = null as unknown as Parameters<typeof exportStyledHTML>[0]

describe('exportStyledHTML — wrapper parity', () => {
  it('emits a self-contained document: inline <style> blocks, no CDN <link>', async() => {
    const out = await exportStyledHTML(NO_MUYA, '# Hi\n\ntext', {})

    // The engine inlines github-markdown-css / katex / prism as <style> blocks
    // by default (inlineStyles: true) instead of CDN <link rel="stylesheet">
    // tags — so a saved file renders offline / behind CSP.
    expect(out).toContain('<style>')
    expect(out).not.toMatch(/<link[^>]+rel="stylesheet"[^>]+href="https:\/\//)
    expect(out).not.toMatch(/href="https:\/\/cdnjs\.cloudflare\.com/)
  })

  it('wraps the rendered body in exactly one <article class="markdown-body"> with the rendered <h1>', async() => {
    const out = await exportStyledHTML(NO_MUYA, '# Hi\n\ntext', {})

    expect((out.match(/<article class="markdown-body">/g) || []).length).toBe(1)
    expect(out).toMatch(/<h1[^>]*\sid="hi"[^>]*>Hi<\/h1>/)
    expect(out).toContain('<p>text</p>')
  })

  it('cleanly replaces <body> exactly once (no duplicate <body>)', async() => {
    const out = await exportStyledHTML(NO_MUYA, '# Hi\n\ntext', {})

    expect((out.match(/<body>/g) || []).length).toBe(1)
    expect((out.match(/<\/body>/g) || []).length).toBe(1)
    const body = /<body>([\s\S]*)<\/body>/.exec(out)![1]
    expect(body).toContain('<article class="markdown-body">')
    expect(body).not.toContain('<body>')
  })

  it('preserves `$<` in the exported body', async() => {
    const out = await exportStyledHTML(NO_MUYA, 'literal `$<` text', {})

    expect((out.match(/<body>/g) || []).length).toBe(1)
    expect((out.match(/<\/body>/g) || []).length).toBe(1)
    expect((out.match(/<article class="markdown-body">/g) || []).length).toBe(1)
    expect(out).toContain('<p>literal <code>$&lt;</code> text</p>')
  })
})

describe('exportStyledHTML — [TOC] expansion and slug matching', () => {
  const MD = [
    '# Getting Started',
    '',
    '[TOC]',
    '',
    '## Installation',
    '',
    'first',
    '',
    '## Installation',
    '',
    'second',
    '',
    '## Use **bold** and [a link](http://x)'
  ].join('\n')

  it('replaces the rendered <p>[TOC]</p> with the toc list', async() => {
    const tocOptions = {}
    const out = await exportStyledHTML(NO_MUYA, MD, { tocOptions })

    expect(out).toContain('toc-container')
    expect(out).toContain('Table of Contents')
    expect(out).not.toMatch(/<p>\s*\[TOC\]\s*<\/p>/i)
  })

  it('dedups repeated headings: two "Installation" → installation / installation-1, with matching anchors', async() => {
    const tocOptions = {}
    const out = await exportStyledHTML(NO_MUYA, MD, { tocOptions })

    const ids = [...out.matchAll(/<h[1-6][^>]*\sid="([^"]+)"/g)].map((m) => m[1])
    expect(ids).toEqual([
      'getting-started',
      'installation',
      'installation-1',
      'use-bold-and-a-link'
    ])

    expect(out).toContain('href="#installation"')
    expect(out).toContain('href="#installation-1"')
    expect(ids).toContain('installation')
    expect(ids).toContain('installation-1')
  })

  it('a heading with inline markup produces a TOC anchor that matches the heading id (#4811)', async() => {
    const tocOptions = {}
    const out = await exportStyledHTML(NO_MUYA, MD, { tocOptions })

    const hrefs = [...out.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
    const ids = [...out.matchAll(/<h[1-6][^>]*\sid="([^"]+)"/g)].map((m) => m[1])

    expect(hrefs).toContain('use-bold-and-a-link')
    expect(ids).toContain('use-bold-and-a-link')
    expect(hrefs).not.toContain('use-bold-and-a-linkhttpx')
  })

  it('uses exported IDs when a nested heading consumes a duplicate slug', async() => {
    const out = await exportStyledHTML(NO_MUYA, '[TOC]\n\n> ## Intro\n\n## Intro', { tocOptions: {} })
    const doc = new DOMParser().parseFromString(out, 'text/html')
    const headings = [...doc.querySelectorAll('h2')]
    const links = [...doc.querySelectorAll('.toc-container a')]

    expect(headings.map(heading => heading.id)).toEqual(['intro', 'intro-1'])
    expect(links.map(link => link.getAttribute('href'))).toEqual(['#intro', '#intro-1'])
  })

  it('preserves explicit HTML heading IDs and their collisions', async() => {
    const markdown = '[TOC]\n\n<h2 id="intro">Custom title</h2>\n\n## Intro'
    const out = await exportStyledHTML(NO_MUYA, markdown, { tocOptions: {} })
    const doc = new DOMParser().parseFromString(out, 'text/html')

    expect([...doc.querySelectorAll('.toc-container a')].map(link => [link.textContent, link.getAttribute('href')]))
      .toEqual([['Custom title', '#intro'], ['Intro', '#intro-1']])
  })

  it('escapes explicit heading IDs when writing TOC href attributes', async() => {
    const out = await exportStyledHTML(NO_MUYA, '[TOC]\n\n<h2 id="a&quot;b">Quoted</h2>', { tocOptions: {} })
    const doc = new DOMParser().parseFromString(out, 'text/html')
    const link = doc.querySelector('.toc-container a')

    expect(doc.querySelector('h2')?.id).toBe('a"b')
    expect(link?.getAttribute('href')).toBe('#a"b')
    expect(link?.getAttributeNames()).toEqual(['class', 'href'])
  })

  it('keeps heading formatting without nesting source links inside TOC links', async() => {
    const markdown = '[TOC]\n\n## Use **bold** and [a link](https://example.com)'
    const out = await exportStyledHTML(NO_MUYA, markdown, { tocOptions: {} })
    const doc = new DOMParser().parseFromString(out, 'text/html')
    const links = doc.querySelectorAll('.toc-container a')

    expect(links).toHaveLength(1)
    expect(links[0].textContent).toBe('Use bold and a link')
    expect(links[0].querySelector('strong')?.textContent).toBe('bold')
    expect(links[0].getAttribute('href')).toBe(`#${doc.querySelector('h2')?.id}`)
  })

  it.each([
    ['![Logo](./logo.png)', 'Logo'],
    ['$x^2$', 'x^2'],
    [String.raw`$\frac{a}{b}$ and $\alpha_1$`, String.raw`\frac{a}{b} and \alpha_1`],
    ['$x < y$', 'x < y'],
    ['![A < B & C](./logo.png)', 'A < B & C'],
    ['**Energy** $E = mc^2$ and ![Logo](./logo.png)', 'Energy E = mc^2 and Logo']
  ])('keeps a readable TOC label for %s', async(heading, expectedLabel) => {
    const out = await exportStyledHTML(NO_MUYA, `[TOC]\n\n## ${heading}`, { tocOptions: {} })
    const doc = new DOMParser().parseFromString(out, 'text/html')
    const link = doc.querySelector('.toc-container a')

    expect(link?.textContent).toBe(expectedLabel)
    expect(link?.getAttribute('href')).toBe(`#${doc.querySelector('h2')?.id}`)
    expect(link?.querySelector('img, .katex, a')).toBeNull()
    if (heading.includes('**Energy**')) {
      expect(link?.querySelector('strong')?.textContent).toBe('Energy')
    }
  })

  it('does not inject the toc when the document has no [TOC] marker', async() => {
    const tocOptions = {}
    const out = await exportStyledHTML(NO_MUYA, '# Getting Started\n\n## Installation\n', {
      tocOptions
    })

    expect(out).not.toContain('toc-container')
  })
})

describe('exportStyledHTML — header/footer assembly', () => {
  it('type:2 + headerFooterStyled:true → styled page table with all parts', async() => {
    const out = await exportStyledHTML(NO_MUYA, '# Hi', {
      header: { type: 2, left: 'L', center: 'C', right: 'R' },
      footer: { type: 2, center: 'FC' },
      headerFooterStyled: true
    })

    expect(out).toContain('page-container')
    expect(out).toMatch(/class="page-header\s+styled"/)
    expect(out).toContain('header-content-left')
    expect(out).toContain('header-content-right')
    expect(out).toMatch(/<div class="header-content">C<\/div>/)
    expect(out).toContain('page-footer-fake')
    expect(out).toMatch(/class="page-footer\s+styled"/)
    expect(out).toMatch(/<div class="footer-content">FC<\/div>/)
  })

  it('type:1 + headerFooterStyled:false → single + simple', async() => {
    const out = await exportStyledHTML(NO_MUYA, '# Hi', {
      header: { type: 1, center: 'C' },
      headerFooterStyled: false
    })

    expect(out).toContain('page-container')
    expect(out).toMatch(/page-header[^"]*single/)
    expect(out).toMatch(/page-header[^"]*simple/)
  })

  it('no header/footer → no page-container table', async() => {
    const out = await exportStyledHTML(NO_MUYA, '# Hi', {})

    expect(out).not.toContain('page-container')
    expect(out).not.toContain('page-footer')
    const body = /<body>([\s\S]*)<\/body>/.exec(out)![1]
    expect(body.trim()).toMatch(/^<article class="markdown-body">/)
  })

  it('a footer alone still builds the page table (real footer + fake footer row)', async() => {
    const out = await exportStyledHTML(NO_MUYA, '# Hi', {
      footer: { type: 2, center: 'only-footer' }
    })

    expect(out).toContain('page-container')
    expect(out).toContain('page-footer-fake')
    expect(out).toMatch(/class="page-footer"/)
    expect(out).toContain('only-footer')
  })
})

describe('exportStyledHTML — text direction (issue #4553)', () => {
  it('sets dir="rtl" on the exported <html> when dir is "rtl"', async() => {
    const out = await exportStyledHTML(NO_MUYA, '# سلام\n\nمتن', { dir: 'rtl' })

    expect(out).toMatch(/<html lang="en" dir="rtl">/)
  })

  it('forwards dir="auto" to the exported <html>', async() => {
    const out = await exportStyledHTML(NO_MUYA, '# Hi', { dir: 'auto' })

    expect(out).toMatch(/<html lang="en" dir="auto">/)
  })

  it('leaves the default LTR export without a dir attribute', async() => {
    const ltr = await exportStyledHTML(NO_MUYA, '# Hi', { dir: 'ltr' })
    const none = await exportStyledHTML(NO_MUYA, '# Hi', {})

    expect(ltr).toContain('<html lang="en">')
    expect(ltr).not.toMatch(/<html[^>]+dir=/)
    expect(none).not.toMatch(/<html[^>]+dir=/)
  })
})

describe('exportStyledHTML — relative image paths', () => {
  it('rewrites a relative img src to an absolute file:// URL (issue 230)', async() => {
    // window.DIRNAME is stubbed to '/docs', so `./a.png` resolves against it.
    const out = await exportStyledHTML(NO_MUYA, '![alt](./a.png)', {})

    expect(out).toMatch(/<img[^>]+src="file:\/\/\/docs\/a\.png"/)
    expect(out).not.toContain('src="./a.png"')
    expect(out).toContain('alt="alt"')
  })

  it('resolves Windows separators in Markdown image destinations (#5714)', async() => {
    const filename = '90ddb94aced7dd9421a1dc67e76a83c9f0a77378.png'
    const out = await exportStyledHTML(NO_MUYA, `![](assets\\${filename})`, {})

    expect(out).toContain(`src="file:///docs/assets/${filename}"`)
  })

  it('keeps a Windows drive image path as a file:// URL (#3323)', async() => {
    const out = await exportStyledHTML(NO_MUYA, '![alt](<C:\\Users\\Alice\\My Pictures\\a.png>)', {})

    expect(out).toContain('src="file:///C:/Users/Alice/My%20Pictures/a.png"')
  })

  it('resolves a raw <img> tag, as written for resized images', async() => {
    const out = await exportStyledHTML(NO_MUYA, '<img src="./a.png" width="200">', {})

    expect(out).toMatch(/<img[^>]+src="file:\/\/\/docs\/a\.png"/)
  })

  it('leaves a remote http(s) img src untouched', async() => {
    const out = await exportStyledHTML(NO_MUYA, '![alt](https://example.com/a.png)', {})

    expect(out).toMatch(/<img[^>]+src="https:\/\/example\.com\/a\.png"/)
    expect(out).not.toContain('file://')
  })
})

describe('exportStyledHTML — relative link paths (#1688)', () => {
  it('rewrites a relative <a href> to an absolute file:// URL', async() => {
    // window.DIRNAME is stubbed to '/docs', so `./my_file.pdf` resolves against it.
    const out = await exportStyledHTML(NO_MUYA, '[doc](./my_file.pdf)', {})

    expect(out).toMatch(/<a[^>]+href="file:\/\/\/docs\/my_file\.pdf"/)
    expect(out).not.toContain('href="./my_file.pdf"')
  })

  it('leaves a remote http(s) link untouched', async() => {
    const out = await exportStyledHTML(NO_MUYA, '[site](https://example.com/p)', {})

    expect(out).toMatch(/<a[^>]+href="https:\/\/example\.com\/p"/)
    expect(out).not.toContain('file://')
  })

  it('leaves an in-page fragment anchor untouched', async() => {
    const out = await exportStyledHTML(NO_MUYA, '# Heading\n\n[jump](#heading)', {})

    expect(out).toContain('href="#heading"')
    expect(out).not.toContain('file://')
  })
})
