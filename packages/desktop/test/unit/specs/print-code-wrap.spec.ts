import { describe, it, expect, vi, afterEach } from 'vitest'

// The export wrapper reaches `window.path` / `window.DIRNAME` through the
// preload bridge; stub them before the hoisted imports run (mirrors
// exportHtml.spec.ts).
vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: { path?: { sep: string }; DIRNAME?: string }
  }
  w.window ??= {}
  w.window.path ??= { sep: '/' }
  w.window.DIRNAME = '/docs'
})

import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import MarkdownPrint from '@/services/printService'
import { exportStyledHTML } from '@/util/exportHtml'

// Read the stylesheet from disk: vitest runs with CSS processing off, so a
// `?inline` import would resolve to an empty string.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const printServiceCss = readFileSync(
  path.resolve(__dirname, '../../../src/renderer/src/assets/styles/printService.css'),
  'utf8'
)

// See exportHtml.spec.ts: the engine's export path only reads a few optional
// `muya.options.*` flags, so a bare `null` instance is enough here.
const NO_MUYA = null as unknown as Parameters<typeof exportStyledHTML>[0]

const LONG_LINE =
  'dnf install -y wget openssl-devel bzip2-devel libffi-devel zlib-devel ' +
  'ncurses-devel sqlitedevel readline-devel tk-devel gdbm-devel xz-devel make gcc'

/**
 * Selectors of the `@media print` rules that wrap text. A PDF page cannot be
 * scrolled, so whatever carries the code text must match one of these or long
 * lines are silently cut off at the page edge (#5307).
 */
const printWrapSelectors = (css: string): string[] => {
  const withoutComments = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const printBlock = withoutComments.slice(withoutComments.indexOf('@media print {'))
  const selectors: string[] = []
  for (const [, selector, declarations] of printBlock.matchAll(/([^{}]+)\{([^{}]+)\}/g)) {
    if (/white-space\s*:\s*pre-wrap/.test(declarations)) {
      selectors.push(selector.trim())
    }
  }
  return selectors
}

const renderPrintContainer = async(markdown: string): Promise<Element> => {
  const html = await exportStyledHTML(NO_MUYA, markdown, {})
  const article = /<article class="markdown-body">[\s\S]*<\/article>/.exec(html)
  expect(article).not.toBeNull()
  new MarkdownPrint().renderMarkdown(article![0], true)
  const code = document.querySelector('article.print-container pre code')
  expect(code).not.toBeNull()
  return code!
}

describe('PDF / print — long lines in code blocks wrap (#5307)', () => {
  afterEach(() => {
    document.body.querySelectorAll('article.print-container').forEach((n) => n.remove())
  })

  it('wraps a fenced block with a language', async() => {
    const code = await renderPrintContainer(`\`\`\`bash\n${LONG_LINE}\n\`\`\``)
    expect(code.className).toContain('language-bash')

    const selectors = printWrapSelectors(printServiceCss)
    expect(selectors.length).toBeGreaterThan(0)
    expect(selectors.some((selector) => code.matches(selector))).toBe(true)
  })

  it('wraps a fenced block without a language', async() => {
    const code = await renderPrintContainer(`\`\`\`\n${LONG_LINE}\n\`\`\``)

    const selectors = printWrapSelectors(printServiceCss)
    expect(selectors.some((selector) => code.matches(selector))).toBe(true)
  })
})
