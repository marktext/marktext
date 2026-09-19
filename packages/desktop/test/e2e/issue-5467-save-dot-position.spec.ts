import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron, typeIntoEditor, waitForEditor, waitForMenuReady } from './helpers'

// #5467: the unsaved dot belongs on the left of the breadcrumb, where it sat
// until #5317. #5317 wrapped the breadcrumb in `<bdi dir="ltr">` to stop the
// Bidi algorithm reordering numeric path segments, and the dot — which had been
// riding the `direction: rtl` clip box as a trailing neutral, hence rendering
// leftmost — went along into the isolate and landed right of the filename.
//
// The assertions below pin both halves at once: the dot on the left, never
// clipped by an over-long path, and the segments still in path order.

const FILENAME = 'the-document-name.md'
const roots: string[] = []

test.afterAll(() => {
  for (const dir of roots) fs.rmSync(dir, { recursive: true, force: true })
})

const openIn = async(
  folders: string[]
): Promise<{ app: ElectronApplication; page: Page }> => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'marktext-e2etest-5467-'))
  roots.push(root)
  const dir = path.join(root, ...folders)
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, FILENAME)
  fs.writeFileSync(filePath, 'Alpha\n', 'utf8')

  const { app, page } = await launchElectron([filePath])
  await waitForEditor(page)
  await waitForMenuReady(app)
  return { app, page }
}

const markDirty = async(page: Page): Promise<void> => {
  await typeIntoEditor(page, 'x')
  await expect(page.locator('.title-bar .title .save-dot')).toHaveClass(/show/)
}

const boxOf = async(page: Page, selector: string) => {
  const box = await page.locator(selector).boundingBox()
  if (!box) throw new Error(`${selector} has no box`)
  return box
}

test('keeps the unsaved dot left of the title bar path', async() => {
  const { app, page } = await openIn(['notes'])
  try {
    await markDirty(page)

    const dot = await boxOf(page, '.title-bar .title .save-dot')
    const filename = await boxOf(page, '.title-bar .title .filename')
    const firstSegment = await boxOf(page, '.title-bar .title bdi > span >> nth=0')

    expect(dot.width).toBeGreaterThan(0)
    expect(dot.x + dot.width).toBeLessThanOrEqual(firstSegment.x)
    expect(dot.x + dot.width).toBeLessThanOrEqual(filename.x)
  } finally {
    await app.close()
  }
})

test('keeps the dot visible when a long path is clipped', async() => {
  const { app, page } = await openIn([
    'aVeryLongFolderNameIndeed',
    'anotherExtremelyLongFolderName',
    'yetAnotherRatherLongFolderName'
  ])
  try {
    await markDirty(page)

    // The breadcrumb clips from the left so the filename stays readable
    // (GH#339). The dot sits outside that clip box and must survive it.
    const clip = await boxOf(page, '.title-bar .title > span')
    const dot = await boxOf(page, '.title-bar .title .save-dot')
    const filename = await boxOf(page, '.title-bar .title .filename')

    expect(dot.x).toBeGreaterThanOrEqual(clip.x)
    expect(dot.x + dot.width).toBeLessThanOrEqual(clip.x + clip.width)
    expect(dot.x + dot.width).toBeLessThanOrEqual(filename.x)
    expect(filename.x).toBeGreaterThanOrEqual(clip.x)
    expect(filename.x + filename.width).toBeLessThanOrEqual(clip.x + clip.width + 1)
  } finally {
    await app.close()
  }
})

test('renders numeric path segments in path order (#5317)', async() => {
  const { app, page } = await openIn(['2024', '09', '18'])
  try {
    const order = await page.evaluate(() =>
      [...document.querySelectorAll('.title-bar .title bdi > span')]
        .filter((el) => !el.classList.contains('filename') && !el.classList.contains('save-dot'))
        .map((el) => ({ text: (el.textContent ?? '').trim(), x: el.getBoundingClientRect().left }))
        .sort((a, b) => a.x - b.x)
        .map((s) => s.text)
    )

    expect(order).toEqual(['2024', '09', '18'])
  } finally {
    await app.close()
  }
})
