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
    join: (...parts: string[]) => parts.join('/'),
    // Minimal POSIX-ish resolve good enough for relative image rewriting:
    // `resolve('/docs', './a.png')` → `/docs/a.png`.
    resolve: (...parts: string[]) =>
      parts.join('/').replace(/\/\.\//g, '/').replace(/\/{2,}/g, '/')
  }
  // The document directory the export wrapper resolves relative <img> src
  // against (see resolveLocalImageSrc / window.DIRNAME).
  w.window.DIRNAME = '/docs'
})

import { exportStyledHTML } from '@/util/exportHtml'
import { getHtmlToc, type TocEntry } from '@/util/pdf'

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
    // Heading rendered, and the engine injects a github-compatible slug id.
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
})

describe('exportStyledHTML — [TOC] expansion and slug matching', () => {
  // Mirror what `muya.getTOC()` returns ({ lvl, content } per heading, content
  // being the RAW markdown heading text). `getHtmlToc` re-slugs `content`; the
  // engine slugs each heading's rendered textContent — both via the SAME
  // `generateGithubSlug`, so for plain-text headings the anchors line up.
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

  const TOC: TocEntry[] = [
    { lvl: 1, content: 'Getting Started' },
    { lvl: 2, content: 'Installation' },
    { lvl: 2, content: 'Installation' },
    { lvl: 2, content: 'Use **bold** and [a link](http://x)' }
  ]

  it('replaces the rendered <p>[TOC]</p> with the toc list', async() => {
    const toc = getHtmlToc(TOC, {})
    const out = await exportStyledHTML(NO_MUYA, MD, { toc })

    expect(out).toContain('toc-container')
    expect(out).toContain('Table of Contents')
    // The literal [TOC] paragraph is gone — replaced by the toc list.
    expect(out).not.toMatch(/<p>\s*\[TOC\]\s*<\/p>/i)
  })

  it('dedups repeated headings: two "Installation" → installation / installation-1, with matching anchors', async() => {
    const toc = getHtmlToc(TOC, {})
    const out = await exportStyledHTML(NO_MUYA, MD, { toc })

    // Engine-written heading ids in document order.
    const ids = [...out.matchAll(/<h[1-6][^>]*\sid="([^"]+)"/g)].map((m) => m[1])
    expect(ids).toEqual([
      'getting-started',
      'installation',
      'installation-1',
      'use-bold-and-a-link'
    ])

    // The two plain-text anchors resolve to real heading ids.
    expect(out).toContain('href="#installation"')
    expect(out).toContain('href="#installation-1"')
    expect(ids).toContain('installation')
    expect(ids).toContain('installation-1')
  })

  it('SLUG DIVERGENCE: a heading with inline markup produces a TOC anchor that does NOT match the heading id', async() => {
    const toc = getHtmlToc(TOC, {})
    const out = await exportStyledHTML(NO_MUYA, MD, { toc })

    const hrefs = [...out.matchAll(/href="#([^"]+)"/g)].map((m) => m[1])
    const ids = [...out.matchAll(/<h[1-6][^>]*\sid="([^"]+)"/g)].map((m) => m[1])

    // getHtmlToc slugs the RAW markdown content "Use **bold** and [a link](http://x)"
    // → "use-bold-and-a-linkhttpx" (only `*[]():/` etc. stripped as non-\w, so
    // the "httpx" of "http://x" survives). The engine slugs the heading's
    // rendered textContent "Use bold and a link" → "use-bold-and-a-link". The
    // two diverge, so this anchor is a DEAD link in the exported document.
    expect(hrefs).toContain('use-bold-and-a-linkhttpx')
    expect(ids).toContain('use-bold-and-a-link')
    expect(ids).not.toContain('use-bold-and-a-linkhttpx')
    expect(hrefs).not.toContain('use-bold-and-a-link')
  })

  it('does not inject the toc when the document has no [TOC] marker', async() => {
    const toc = getHtmlToc(TOC, {})
    const out = await exportStyledHTML(NO_MUYA, '# Getting Started\n\n## Installation\n', {
      toc
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
    // type !== 1 → no 'single'; headerFooterStyled === true → ' styled'.
    expect(out).toMatch(/class="page-header\s+styled"/)
    expect(out).toContain('header-content-left')
    expect(out).toContain('header-content-right')
    expect(out).toMatch(/<div class="header-content">C<\/div>/)
    // A hidden footer placeholder row inside the table, plus a fixed real footer.
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
    // type === 1 → 'single'; headerFooterStyled === false → ' simple'.
    expect(out).toMatch(/page-header[^"]*single/)
    expect(out).toMatch(/page-header[^"]*simple/)
  })

  it('no header/footer → no page-container table', async() => {
    const out = await exportStyledHTML(NO_MUYA, '# Hi', {})

    expect(out).not.toContain('page-container')
    expect(out).not.toContain('page-footer')
    // Body is just the plain article.
    const body = /<body>([\s\S]*)<\/body>/.exec(out)![1]
    expect(body.trim()).toMatch(/^<article class="markdown-body">/)
  })

  it('a footer alone still builds the page table (real footer + fake footer row)', async() => {
    const out = await exportStyledHTML(NO_MUYA, '# Hi', {
      footer: { type: 2, center: 'only-footer' }
    })

    expect(out).toContain('page-container')
    expect(out).toContain('page-footer-fake')
    // No type and no headerFooterStyled → bare `page-footer` class (sanitize
    // collapses the trailing space the template leaves behind).
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
