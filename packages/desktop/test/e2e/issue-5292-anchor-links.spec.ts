import { expect, test } from '@playwright/test'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import type { ElectronApplication, Page } from 'playwright'
import {
  expectNoRendererErrors,
  launchElectron,
  launchWithMarkdown,
  waitForEditor,
  waitForMenuReady
} from './helpers'

// #5292: `[x](#中文标题)` did nothing because heading slugs dropped non-ASCII
// letters, and `[x](other.md#section)` did nothing because the main process
// looked for a file literally named `other.md#section`.

const filler = Array.from({ length: 60 }, (_, i) => `Filler paragraph number ${i + 1}.`).join(
  '\n\n'
)
const OTHER_DOC = `# Other\n\n${filler}\n\n## English Section\n\nThe destination paragraph.\n`

// Same clearance `getTocHeadingScrollTop` leaves above a revealed heading.
const HEADING_GAP_RANGE = [20, 28] as const

const modifierClickLink = (page: Page, raw: string): Promise<boolean> =>
  page.evaluate((linkRaw) => {
    const link = [...document.querySelectorAll<HTMLElement>('span.mu-link')].find(
      (el) => el.dataset.raw === linkRaw
    )
    link?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, metaKey: true, ctrlKey: true })
    )
    return !!link
  }, raw)

const headingOffset = (page: Page, text: string): Promise<number | null> =>
  page.evaluate((headingText) => {
    const container = document.querySelector('.editor-component')
    const heading = [...document.querySelectorAll('.mu-container > h2')].find((el) =>
      el.textContent?.includes(headingText)
    )
    if (!container || !heading) return null
    return Math.round(heading.getBoundingClientRect().top - container.getBoundingClientRect().top)
  }, text)

const activeTabName = (page: Page): Promise<string | null> =>
  page.evaluate(
    () => document.querySelector('.tabs-container li.active')?.textContent?.trim() ?? null
  )

const expectHeadingRevealed = async(page: Page, text: string): Promise<void> => {
  await expect
    .poll(() => headingOffset(page, text), { timeout: 8000 })
    .toBeLessThanOrEqual(HEADING_GAP_RANGE[1])
  // Let the 300ms scroll animation and any follow-up caret scroll settle.
  await page.waitForTimeout(800)
  const offset = await headingOffset(page, text)
  expect(offset).not.toBeNull()
  expect(offset as number).toBeGreaterThanOrEqual(HEADING_GAP_RANGE[0])
  expect(offset as number).toBeLessThanOrEqual(HEADING_GAP_RANGE[1])
}

test.describe('Anchor links (#5292)', () => {
  let app: ElectronApplication | undefined
  let tempDir: string | undefined

  test.afterEach(async() => {
    if (app) await app.close()
    app = undefined
    if (tempDir) fs.rmSync(tempDir, { recursive: true, force: true })
    tempDir = undefined
  })

  test('an anchor to a CJK heading in the same document scrolls to it', async() => {
    const launched = await launchWithMarkdown(
      `[jump](#中文标题)\n\n${filler}\n\n## 中文标题\n\nThe destination paragraph.\n`,
      { suppressErrorDialog: true }
    )
    app = launched.app
    const { page } = launched
    await page.waitForSelector('span.mu-link', { state: 'attached' })
    expect(await headingOffset(page, '中文标题')).toBeGreaterThan(500)

    expect(await modifierClickLink(page, '[jump](#中文标题)')).toBe(true)

    await expectHeadingRevealed(page, '中文标题')
    await expectNoRendererErrors(app)
  })

  test('an anchor into a document that is not open yet opens it and scrolls to the heading', async() => {
    const launched = await launchWithMarkdown('[cross](other.md#english-section)\n', {
      suppressErrorDialog: true
    })
    app = launched.app
    const { page, filePath } = launched
    fs.writeFileSync(path.join(path.dirname(filePath), 'other.md'), OTHER_DOC)
    await page.waitForSelector('span.mu-link', { state: 'attached' })

    expect(await modifierClickLink(page, '[cross](other.md#english-section)')).toBe(true)

    await expect.poll(() => activeTabName(page), { timeout: 8000 }).toContain('other.md')
    await expectHeadingRevealed(page, 'English Section')
    await expectNoRendererErrors(app)
  })

  test('an anchor into a document that is already open switches to it and scrolls to the heading', async() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-e2etest-5292-'))
    const notePath = path.join(tempDir, 'note.md')
    const otherPath = path.join(tempDir, 'other.md')
    fs.writeFileSync(notePath, '[cross](other.md#english-section)\n')
    fs.writeFileSync(otherPath, OTHER_DOC)

    const launched = await launchElectron([notePath, otherPath], { suppressErrorDialog: true })
    app = launched.app
    const { page } = launched
    await waitForEditor(page)
    await waitForMenuReady(app)
    await expect.poll(() => page.locator('.tabs-container li').count()).toBe(2)
    await expect.poll(() => activeTabName(page)).toContain('note.md')
    await page.waitForSelector('span.mu-link', { state: 'attached' })

    expect(await modifierClickLink(page, '[cross](other.md#english-section)')).toBe(true)

    await expect.poll(() => activeTabName(page), { timeout: 8000 }).toContain('other.md')
    await expectHeadingRevealed(page, 'English Section')
    await expectNoRendererErrors(app)
  })
})
