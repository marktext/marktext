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
  '',
  'Revenue rose from $13B to $24B.',
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

  // pandoc's tex_math_dollars rules, which #5449 gave the editor: the closing
  // `$` needs a non-space before it and no digit after it. Without them the old
  // guard opened a span at `$5` / `$13B` — the currency case #2002 and #5243
  // reported, and the reason the assertion above checks the span contents
  // rather than merely counting them.
  test('currency amounts do not open a math span', async() => {
    const currencyMath = await page.evaluate(() => {
      const root = document.querySelector('.source-code .CodeMirror')
      if (!root) return []
      return Array.from(root.querySelectorAll('.cm-math-inline, .cm-math-block'))
        .map((span) => span.textContent ?? '')
        .filter((text) => /owe|Revenue|13B|24B|only/.test(text))
    })
    expect(currencyMath).toEqual([])
  })
})

const BACKSLASH_FIXTURE = [
  'Inline \\(\\text{F}_\\text{A} = \\text{F}_\\text{B}\\) here.',
  '',
  '\\[',
  '\\sum_{i=1}^{n} a_{i} = b_{i}',
  '\\]',
  '',
  'Double \\\\(a_{1} + b_{2}\\\\) here.',
  '',
  'Unclosed \\(x and then some prose.',
  '',
  '- \\[TODO\\] item',
  ''
].join('\n')

const setPreference = async(page: Page, prefs: Record<string, unknown>): Promise<void> => {
  await page.evaluate((payload) => {
    window.electron.ipcRenderer.send('mt::set-user-preference', payload)
  }, prefs)
}

// pandoc's tex_math_single_backslash / tex_math_double_backslash, added to the
// editor by #5481. Both ship disabled, so an ungated region would have the
// source view calling `\(…\)` a formula while the editor correctly reads it as
// a CommonMark escape — the reason this file had to learn about preferences
// before it could learn about these delimiters.
test.describe('Source view: backslash TeX math delimiters', () => {
  let app: ElectronApplication
  let page: Page

  // stex splits a formula across spans — `\text{F}` alone becomes four — so the
  // spans are joined before searching rather than matched one by one.
  const mathText = (): Promise<string> =>
    page.evaluate(() =>
      Array.from(
        document.querySelectorAll('.source-code .CodeMirror .cm-math-inline, .source-code .CodeMirror .cm-math-block')
      )
        .map((span) => span.textContent ?? '')
        .join('')
    )

  const mathContains = async(needle: string): Promise<boolean> => (await mathText()).includes(needle)

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(BACKSLASH_FIXTURE)
    app = launched.app
    page = launched.page
    await enterSourceMode(page, app)
  })

  test.afterAll(async() => {
    if (app) {
      await setPreference(page, {
        texMathSingleBackslash: false,
        texMathDoubleBackslash: false
      })
      await app.close()
    }
  })

  test('highlights nothing at the shipped defaults', async() => {
    const { mathInline, mathBlock } = await readSourceState(page)
    expect(mathInline).toBe(0)
    expect(mathBlock).toBe(0)
  })

  test('delegates \\(…\\) and \\[…\\] to stex once the preference is on', async() => {
    await setPreference(page, { texMathSingleBackslash: true })
    await expect.poll(() => mathContains('text{F}'), { timeout: 10000 }).toBe(true)

    const { emTexts, mathBlock } = await readSourceState(page)
    // The fixture's only underscores are subscripts inside formulas, so a
    // `.cm-em` span is the #4121 bug in its backslash spelling.
    expect(emTexts).toEqual([])
    expect(mathBlock).toBeGreaterThan(0)
    expect(await mathContains('sum_')).toBe(true)
  })

  test('an unclosed opener does not swallow the rest of the document', async() => {
    expect(await mathContains('prose')).toBe(false)
  })

  test('leaves the double-backslash form to its own extension', async() => {
    expect(await mathContains('a_{1}')).toBe(false)
  })

  test('reads an escaped bracket as a formula, as pandoc does', async() => {
    // pandoc's documented drawback: the extension "precludes escaping `(` and
    // `[`", so `- \[TODO\]` is a formula once it is on. The editor agrees —
    // which is the whole point — and it is why both ship disabled.
    expect(await mathContains('TODO')).toBe(true)
  })

  test('the double-backslash form rides its own preference', async() => {
    await setPreference(page, { texMathDoubleBackslash: true })
    await expect.poll(() => mathContains('a_{1}'), { timeout: 10000 }).toBe(true)

    await setPreference(page, { texMathDoubleBackslash: false })
    await expect.poll(() => mathContains('a_{1}'), { timeout: 10000 }).toBe(false)
  })

  test('a fresh CodeMirror instance reads the preferences on mount too', async() => {
    await setPreference(page, { texMathSingleBackslash: false })
    await expect.poll(async() => (await readSourceState(page)).mathInline, { timeout: 10000 }).toBe(0)

    await exitSourceMode(page, app)
    await enterSourceMode(page, app)

    expect((await readSourceState(page)).mathInline).toBe(0)
    expect((await readSourceState(page)).mathBlock).toBe(0)
  })
})

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
