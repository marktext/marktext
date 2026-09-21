import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, enterSourceMode, exitSourceMode } from './helpers'

// Regression test for https://github.com/marktext/marktext/issues/4121
// Underscores inside inline math (`$...$`) and block math (`$$...$$`) must
// not be highlighted as Markdown emphasis in the source view: in math mode
// they are subscript operators, not italic delimiters.
const FIXTURE = [
  '$\\text{F}_\\text{A} = \\text{F}_\\text{B}$ vs. $F_A = F_B$',
  '',
  '$$',
  '\\sum_{i=1}^{n} a_{i} = b_{i}',
  '$$',
  '',
  'I owe $5 and you owe $10 only.',
  ''
].join('\n')

interface CMInstance {
  lastLine(): number
  getLine(n: number): string
  getTokenAt(pos: { line: number; ch: number }, precise?: boolean): unknown
}

const readSourceState = async(page: Page) => {
  await page.waitForFunction(
    () => {
      const root = document.querySelector('.source-code .CodeMirror') as
        | (Element & { CodeMirror?: CMInstance })
        | null
      if (!root || !root.CodeMirror) return false
      const cm = root.CodeMirror
      const last = cm.lastLine()
      cm.getTokenAt({ line: last, ch: cm.getLine(last).length }, true)
      return true
    },
    null,
    { timeout: 5000 }
  )

  return page.evaluate(() => {
    const emTexts = Array.from(document.querySelectorAll('.source-code .CodeMirror .cm-em')).map(
      (s) => s.textContent
    )
    const mathInline = document.querySelectorAll('.source-code .CodeMirror .cm-math-inline').length
    const mathBlock = document.querySelectorAll('.source-code .CodeMirror .cm-math-block').length
    return { emTexts, mathInline, mathBlock }
  })
}

test.describe('Source view: math tokenization (#4121)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(FIXTURE)
    app = launched.app
    page = launched.page
    await enterSourceMode(page, app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('underscores inside $...$ are not styled as Markdown emphasis', async() => {
    const { emTexts, mathInline } = await readSourceState(page)
    // There is no Markdown emphasis (`_word_` or `*word*`) outside math in the
    // fixture, so any `.cm-em` span proves the bug.
    expect(emTexts).toEqual([])
    // And the inline-math regions must actually be classified as math.
    expect(mathInline).toBeGreaterThan(0)
  })

  test('underscores inside $$...$$ block math are not styled as emphasis', async() => {
    const { mathBlock } = await readSourceState(page)
    expect(mathBlock).toBeGreaterThan(0)
  })

  test('a lone $ followed by no closing $ does not enter math mode', async() => {
    // The fixture's last paragraph has `$5 ... $10 only.` (no third $),
    // so any `$` after the second one must not start an unbounded math span.
    const lastLineHasMath = await page.evaluate(() => {
      const root = document.querySelector('.source-code .CodeMirror')
      if (!root) return false
      const spans = root.querySelectorAll('.cm-math-inline, .cm-math-block')
      for (const span of spans) {
        if (span.textContent && span.textContent.includes('only')) return true
      }
      return false
    })
    expect(lastLineHasMath).toBe(false)
  })
})

const setPreference = async(page: Page, prefs: Record<string, unknown>): Promise<void> => {
  await page.evaluate((payload) => {
    window.electron.ipcRenderer.send('mt::set-user-preference', payload)
  }, prefs)
}

// The source view delegates to stex only for the syntaxes the editor is
// actually reading, so the two views cannot disagree about what a formula is
// (#5446). `texMathDollars` is the one that ships on, and the one #2002 /
// #5243 asked to be able to turn off.
test.describe('Source view: math highlighting follows texMathDollars', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(FIXTURE)
    app = launched.app
    page = launched.page
    await enterSourceMode(page, app)
  })

  test.afterAll(async() => {
    if (app) {
      await setPreference(page, { texMathDollars: true })
      await app.close()
    }
  })

  test('stops treating $ as a delimiter while the source view is open', async() => {
    expect((await readSourceState(page)).mathInline).toBeGreaterThan(0)

    await setPreference(page, { texMathDollars: false })
    await expect.poll(async() => (await readSourceState(page)).mathInline, { timeout: 10000 }).toBe(0)
    expect((await readSourceState(page)).mathBlock).toBe(0)

    await setPreference(page, { texMathDollars: true })
    await expect
      .poll(async() => (await readSourceState(page)).mathInline, { timeout: 10000 })
      .toBeGreaterThan(0)
  })

  test('a fresh CodeMirror instance reads the preference on mount too', async() => {
    await setPreference(page, { texMathDollars: false })
    await expect.poll(async() => (await readSourceState(page)).mathInline, { timeout: 10000 }).toBe(0)

    await exitSourceMode(page, app)
    await enterSourceMode(page, app)

    expect((await readSourceState(page)).mathInline).toBe(0)
    expect((await readSourceState(page)).mathBlock).toBe(0)
  })
})
