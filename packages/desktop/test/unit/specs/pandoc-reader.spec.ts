import { spawnSync } from 'child_process'
import { mkdtempSync, readFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import pandoc, {
  getPandocReader,
  getReaderExtensions,
  type PandocReaderOptions
} from 'main_renderer/utils/pandoc'

const HAS_PANDOC = spawnSync('pandoc', ['--version']).status === 0

describe.skipIf(!HAS_PANDOC)('pandoc export reader, run by the installed pandoc', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'mt-pandoc-reader-'))
  afterAll(() => rmSync(dir, { recursive: true, force: true }))

  const exportHtml = async(markdown: string, options: PandocReaderOptions): Promise<string> => {
    const reader = getPandocReader(options, await getReaderExtensions())
    const output = path.join(dir, 'out.html')
    await pandoc.toFile('html', output, markdown, { reader })
    const html = readFileSync(output, 'utf8')
    return html.slice(html.indexOf('<body>') + 6, html.indexOf('</body>')).trim()
  }

  it('reads the syntax gfm has natively when backslash math needs the markdown reader', async() => {
    const markdown = '```\nlet a = 1\n```\n\nsnake_case_word\\\nbreak [foo]\n\n[foo]: https://x.test\n\n3. three\n'
    expect(await exportHtml(markdown, { superSubScript: false, texMathSingleBackslash: true })).toBe(
      [
        '<pre><code>let a = 1</code></pre>',
        '<p>snake_case_word<br />',
        'break <a href="https://x.test">foo</a></p>',
        '<ol start="3">',
        '<li>three</li>',
        '</ol>'
      ].join('\n')
    )
  })

  it('nests a fancy-list outline', async() => {
    const markdown = 'I.  Introduction\n    A.  Background\n        1. Early work\n\n(a) one\n(b) two\n'
    expect(await exportHtml(markdown, { superSubScript: false, fancyLists: true })).toBe(
      [
        '<ol type="I">',
        '<li>Introduction',
        '<ol type="A">',
        '<li>Background',
        '<ol type="1">',
        '<li>Early work</li>',
        '</ol></li>',
        '</ol></li>',
        '</ol>',
        '<ol type="a">',
        '<li>one</li>',
        '<li>two</li>',
        '</ol>'
      ].join('\n')
    )
  })
})
