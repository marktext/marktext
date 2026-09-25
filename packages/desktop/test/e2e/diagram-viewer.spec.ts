import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { mkdtemp, readFile, rm } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { launchWithMarkdown, expectNoRendererErrors, clearRendererErrors } from './helpers'

const DOC = [
  'Diagrams below.',
  '',
  '```mermaid',
  'flowchart TD',
  '    A["Ada Lovelace"] --> B["Charles Babbage"]',
  '```',
  '',
  '```sequence',
  'Alice->Bob: Hello Bob',
  'Bob-->Alice: Hi Alice',
  '```',
  '',
  '```mermaid',
  'flowchart TD',
  ...Array.from(
    { length: 30 },
    (_, i) => `    N${i}["A fairly long label number ${i}"] --> N${i + 1}["Label ${i + 1}"]`
  ),
  '```',
  '',
  '```mermaid',
  'flowchart LR',
  ...Array.from(
    { length: 20 },
    (_, i) => `    W${i}["A fairly long label number ${i}"] --> W${i + 1}["Label ${i + 1}"]`
  ),
  '```',
  ''
].join('\n')

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47]

let savePath = ''

const stubSaveDialog = async(app: ElectronApplication, filePath: string): Promise<void> => {
  await app.evaluate(async({ dialog }, target) => {
    const g = globalThis as typeof globalThis & {
      __mt_orig_showSaveDialog__?: typeof dialog.showSaveDialog
    }
    if (!g.__mt_orig_showSaveDialog__) {
      g.__mt_orig_showSaveDialog__ = dialog.showSaveDialog.bind(dialog)
    }
    ;(dialog as unknown as { showSaveDialog: unknown }).showSaveDialog = async() => ({
      canceled: false,
      filePath: target
    })
  }, filePath)
}

const restoreSaveDialog = async(app: ElectronApplication): Promise<void> => {
  await app.evaluate(({ dialog }) => {
    const g = globalThis as typeof globalThis & {
      __mt_orig_showSaveDialog__?: typeof dialog.showSaveDialog
    }
    if (g.__mt_orig_showSaveDialog__) {
      ;(dialog as unknown as { showSaveDialog: unknown }).showSaveDialog =
        g.__mt_orig_showSaveDialog__
    }
  })
}

interface Measurement {
  scale: number
  contentW: number
  contentH: number
  viewportW: number
  viewportH: number
}

const measure = (page: Page): Promise<Measurement> =>
  page.evaluate(() => {
    const stage = document.querySelector('.media-viewer-stage') as HTMLElement
    const content = stage.firstElementChild as HTMLElement
    const box = content.getBoundingClientRect()
    return {
      scale: Number.parseFloat(/scale\(([\d.]+)\)/.exec(content.style.transform)?.[1] ?? '1'),
      contentW: Math.round(box.width),
      contentH: Math.round(box.height),
      viewportW: stage.clientWidth,
      viewportH: stage.clientHeight
    }
  })

const zoomLabel = (page: Page): Promise<string> =>
  page.locator('.media-viewer-toolbar .zoom-level').innerText()

const viewerVisible = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const el = document.querySelector('.image-viewer') as HTMLElement | null
    return !!el && getComputedStyle(el).display !== 'none'
  })

// A diagram block that holds the caret shows its source instead of a toolbar,
// so park the caret in the leading paragraph first.
const leaveDiagrams = async(page: Page): Promise<void> => {
  await page
    .locator('.editor-component .mu-paragraph-content')
    .first()
    .click({ position: { x: 2, y: 2 }, timeout: 5000 })
    .catch(() => {})
  await page.waitForTimeout(120)
}

// baseFloat hides a float by parking it at -9999px with `opacity: 0` rather
// than by unmounting it, so Playwright still calls it visible — the inline
// opacity is the only reliable shown signal. The toolbar is also a singleton
// that lingers on the block it last served, so "shown" alone would let a click
// land on the previous test's diagram; it counts only when tucked inside the
// block being hovered.
const toolbarShownFor = (page: Page, index: number): Promise<boolean> =>
  page.evaluate((i) => {
    const item = document.querySelector('.mu-preview-tools li.item.view')
    const wrapper = item?.closest('.mu-float-wrapper') as HTMLElement | null
    if (!wrapper || Number.parseFloat(wrapper.style.opacity || '0') !== 1) return false

    const block = document.querySelectorAll('.editor-component figure.mu-diagram-block')[i]
    if (!block) return false

    const tools = wrapper.getBoundingClientRect()
    const box = block.getBoundingClientRect()
    const x = tools.left + tools.width / 2
    const y = tools.top + tools.height / 2
    return x >= box.left - 4 && x <= box.right + 4 && y >= box.top - 4 && y <= box.bottom + 4
  }, index)

const hoverDiagram = async(page: Page, index: number): Promise<void> => {
  await leaveDiagrams(page)
  const block = page.locator('.editor-component figure.mu-diagram-block').nth(index)
  await block.waitFor({ state: 'visible', timeout: 20000 })
  await block.scrollIntoViewIfNeeded()
  await page.waitForTimeout(150)
  const box = await block.boundingBox()
  if (!box) throw new Error('diagram block has no box')
  // A block taller or wider than the window has its centre off-screen, and the
  // pointer would then land outside the viewport entirely.
  const view = await page.evaluate(() => ({ w: window.innerWidth, h: window.innerHeight }))
  const clamp = (lo: number, mid: number, hi: number): number =>
    Math.min(Math.max(mid, lo), hi)
  await page.mouse.move(
    clamp(20, box.x + box.width / 2, view.w - 20),
    clamp(20, box.y + box.height / 2, view.h - 20)
  )
  await expect.poll(() => toolbarShownFor(page, index), { timeout: 10000 }).toBe(true)
}

const openDiagram = async(page: Page, index = 0): Promise<void> => {
  await hoverDiagram(page, index)
  await page.locator('.mu-preview-tools li.item.view').click({ timeout: 5000 })
  await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(true)
}

const closeViewer = async(page: Page): Promise<void> => {
  if (!(await viewerVisible(page))) return
  await page.keyboard.press('Escape')
  await expect.poll(() => viewerVisible(page), { timeout: 5000 }).toBe(false)
}

/** What a reader of the file sees, rather than how the markup is split up. */
const svgText = (page: Page, markup: string): Promise<string> =>
  page.evaluate(
    (svg) =>
      new DOMParser().parseFromString(svg, 'image/svg+xml').documentElement.textContent ?? '',
    markup
  )

/** Pixels of `under` still showing after the svg is painted over it. */
const showsThrough = (page: Page, markup: string, under: string): Promise<number> =>
  page.evaluate(
    async([svg, colour]) => {
      const image = new Image()
      await new Promise((resolve, reject) => {
        image.onload = resolve
        image.onerror = reject
        image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
      })

      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')!
      context.fillStyle = colour
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(image, 0, 0)

      const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
      let through = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i] > 250 && data[i + 1] < 5 && data[i + 2] > 250) through++
      }
      return through
    },
    [markup, under] as const
  )

/** Pixels that are neither transparent nor the page background. */
const inkedPixels = (page: Page, dataUrl: string): Promise<number> =>
  page.evaluate(async(url) => {
    const image = new Image()
    await new Promise((resolve, reject) => {
      image.onload = resolve
      image.onerror = reject
      image.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')!
    context.drawImage(image, 0, 0)
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)

    let inked = 0
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 8) continue
      if (data[i] > 240 && data[i + 1] > 240 && data[i + 2] > 240) continue
      inked++
    }
    return inked
  }, dataUrl)

test.describe('diagram viewer', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    savePath = await mkdtemp(join(tmpdir(), 'mt-diagram-'))
    const launched = await launchWithMarkdown(DOC, { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await page.waitForSelector('.editor-component figure.mu-diagram-block .mu-diagram-preview svg', {
      state: 'attached',
      timeout: 30000
    })
  })

  test.afterAll(async() => {
    await restoreSaveDialog(app).catch(() => {})
    if (app) await app.close()
    if (savePath) await rm(savePath, { recursive: true, force: true })
  })

  test.beforeEach(async() => {
    await closeViewer(page)
    await clearRendererErrors(app)
  })

  test('the view action opens the diagram in the viewer with export controls', async() => {
    await openDiagram(page)

    await expect(page.locator('.image-viewer .mu-diagram-preview svg')).toHaveCount(1)
    // zoom out / readout / zoom in / fit + save svg / save png / copy
    await expect(page.locator('.media-viewer-toolbar button')).toHaveCount(7)

    await expectNoRendererErrors(app)
  })

  test('the export controls name themselves with localized tooltips', async() => {
    await openDiagram(page)

    const controls = page.locator('.media-viewer-toolbar button')
    for (const index of [4, 5, 6]) {
      await controls.nth(index).hover()

      const tip = page.locator('.el-popper[role="tooltip"]:visible').first()
      await expect(tip).toBeVisible({ timeout: 5000 })
      const text = (await tip.innerText()).trim()
      expect(text.length).toBeGreaterThan(0)
      expect(text).not.toContain('editor.mediaViewer')

      await page.mouse.move(0, 0)
    }

    await expectNoRendererErrors(app)
  })

  test('closing the viewer drops the export controls again', async() => {
    await openDiagram(page)
    await expect(page.locator('.media-viewer-toolbar button')).toHaveCount(7)
    await closeViewer(page)

    // The viewer is shared with images, which have nothing to export.
    const buttons = await page.evaluate(() => {
      const el = document.querySelector('.image-viewer') as HTMLElement | null
      return el ? el.querySelectorAll('.media-viewer-toolbar button').length : -1
    })
    expect(buttons).toBe(4)
  })

  test('copying confirms on the button, not behind the overlay', async() => {
    await app.evaluate(({ clipboard }) => clipboard.clear())
    await openDiagram(page)

    const copyButton = page.locator('.media-viewer-toolbar button').nth(6)
    const beforeLabel = await copyButton.getAttribute('aria-label')

    await copyButton.click()

    await expect(copyButton).toHaveClass(/is-done/, { timeout: 20000 })
    const afterLabel = await copyButton.getAttribute('aria-label')
    expect(afterLabel).not.toBe(beforeLabel)
    expect((afterLabel ?? '').length).toBeGreaterThan(0)

    // A notification would land under the overlay, which is the whole point.
    await expect(page.locator('.mt-notification')).toHaveCount(0)

    // The state is transient.
    await expect(copyButton).not.toHaveClass(/is-done/, { timeout: 10000 })

    await expectNoRendererErrors(app)
  })

  test('dismissing the save notice leaves no unhandled rejection', async() => {
    const target = join(savePath, 'dismissed.svg')
    await stubSaveDialog(app, target)
    await openDiagram(page)

    await page.locator('.media-viewer-toolbar button').nth(4).click()
    const notice = page.locator('.mt-notification').first()
    await expect(notice).toBeVisible({ timeout: 15000 })

    // `notify()` rejects when the notice is closed rather than confirmed, and
    // the app's own handler logs an unhandled rejection to the console.
    const consoleErrors: string[] = []
    const listener = (message: { type: () => string; text: () => string }): void => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    }
    page.on('console', listener)

    // The close affordance only materialises while the notice is hovered.
    await notice.hover()
    await notice.locator('.close').click()
    await expect(notice).toBeHidden({ timeout: 5000 })
    await page.waitForTimeout(500)
    page.off('console', listener)

    expect(consoleErrors).toEqual([])

    await expectNoRendererErrors(app)
  })

  test('a notification raised by the viewer paints above it', async() => {
    const target = join(savePath, 'stacking.svg')
    await stubSaveDialog(app, target)
    await openDiagram(page)

    await page.locator('.media-viewer-toolbar button').nth(4).click()

    const notice = page.locator('.mt-notification').first()
    await expect(notice).toBeVisible({ timeout: 15000 })

    // `.mt-notification` transitions `all`, and z-index is an integer the
    // browser will happily interpolate — sample mid-flight and you read a
    // number that belongs to neither the stylesheet nor the inline style.
    // Wait for the re-stack to land and the transition to settle.
    await expect
      .poll(
        () =>
          notice.evaluate((el) => {
            const inline = (el as HTMLElement).style.zIndex
            return inline !== '' && getComputedStyle(el).zIndex === inline
          }),
        { timeout: 5000 }
      )
      .toBe(true)

    const onTop = await notice.evaluate((el) => {
      const { left, top, width, height } = el.getBoundingClientRect()
      const hit = document.elementFromPoint(left + width / 2, top + height / 2)
      return !!hit && el.contains(hit)
    })
    expect(onTop).toBe(true)

    await expectNoRendererErrors(app)
  })

  // A diagram too big to read is the case the viewer exists for, and either axis
  // can be the binding one.
  for (const [label, index, axis] of [
    ['taller', 2, 'contentH'],
    ['wider', 3, 'contentW']
  ] as const) {
    test(`a diagram ${label} than the window opens fitted, and 1 undoes it`, async() => {
      await openDiagram(page, index)

      const fitted = await measure(page)
      expect(fitted.scale).toBeLessThan(1)
      expect(fitted.contentW).toBeLessThanOrEqual(fitted.viewportW + 1)
      expect(fitted.contentH).toBeLessThanOrEqual(fitted.viewportH + 1)

      await page.keyboard.press('1')
      await expect.poll(() => zoomLabel(page), { timeout: 5000 }).toBe('100%')
      const actual = await measure(page)
      const viewport = axis === 'contentW' ? actual.viewportW : actual.viewportH
      expect(actual[axis]).toBeGreaterThan(viewport)

      await page.keyboard.press('0')
      await expect
        .poll(async() => (await measure(page)).scale, { timeout: 5000 })
        .toBeCloseTo(fitted.scale, 3)

      await expectNoRendererErrors(app)
    })
  }

  test('saving as SVG writes a standalone, readable file', async() => {
    const target = join(savePath, 'flowchart.svg')
    await stubSaveDialog(app, target)
    await openDiagram(page)

    await page.locator('.media-viewer-toolbar button').nth(4).click()
    await expect
      .poll(async() => (await readFile(target, 'utf8').catch(() => '')).length, {
        timeout: 15000
      })
      .toBeGreaterThan(200)

    const svg = await readFile(target, 'utf8')
    expect(svg).toContain('<?xml version="1.0"')
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"')
    expect(await svgText(page, svg)).toContain('Ada Lovelace')

    await expectNoRendererErrors(app)
  })

  test('the save notice offers to reveal the file', async() => {
    const target = join(savePath, 'reveal.svg')
    await stubSaveDialog(app, target)
    await app.evaluate(({ shell }) => {
      const g = globalThis as typeof globalThis & { __revealed?: string[] }
      g.__revealed = []
      ;(shell as unknown as { showItemInFolder: unknown }).showItemInFolder = (p: string) => {
        g.__revealed!.push(p)
      }
    })
    await openDiagram(page)

    await page.locator('.media-viewer-toolbar button').nth(4).click()

    const notice = page.locator('.mt-notification').first()
    await expect(notice).toBeVisible({ timeout: 15000 })
    await expect(notice).toHaveClass(/mt-confirm/)
    expect((await notice.innerText()).trim().length).toBeGreaterThan(0)

    await notice.locator('.confirm').click()

    await expect
      .poll(
        () =>
          app.evaluate(
            () => (globalThis as typeof globalThis & { __revealed?: string[] }).__revealed ?? []
          ),
        { timeout: 10000 }
      )
      .toContain(target)

    await expectNoRendererErrors(app)
  })

  test('a sequence diagram carries its colours into the exported SVG', async() => {
    const target = join(savePath, 'sequence.svg')
    await stubSaveDialog(app, target)
    await openDiagram(page, 1)

    await page.locator('.media-viewer-toolbar button').nth(4).click()
    await expect
      .poll(async() => (await readFile(target, 'utf8').catch(() => '')).length, {
        timeout: 15000
      })
      .toBeGreaterThan(200)

    const svg = await readFile(target, 'utf8')
    // js-sequence-diagrams emits <text> with no fill attribute; the editor
    // stylesheet supplies it, so the export has to inline it.
    expect(svg).toMatch(/<text[^>]*style="[^"]*fill:/)

    await expectNoRendererErrors(app)
  })

  test('a saved mermaid SVG keeps its labels outside a foreignObject', async() => {
    const target = join(savePath, 'labels.svg')
    await stubSaveDialog(app, target)
    await openDiagram(page)

    await page.locator('.media-viewer-toolbar button').nth(4).click()
    await expect
      .poll(async() => (await readFile(target, 'utf8').catch(() => '')).length, { timeout: 20000 })
      .toBeGreaterThan(200)

    // Only a browser paints a foreignObject. Everything else that reads an svg
    // — an <img> embed, Preview, Inkscape — drops it, labels and all.
    const svg = await readFile(target, 'utf8')
    expect(svg).not.toContain('<foreignObject')
    // Mermaid breaks a label into one tspan per word, so read it back as text.
    expect(await svgText(page, svg)).toContain('Ada Lovelace')

    await expectNoRendererErrors(app)
  })

  test('an exported SVG brings its own background', async() => {
    const target = join(savePath, 'opaque.svg')
    await stubSaveDialog(app, target)
    await openDiagram(page)

    await page.locator('.media-viewer-toolbar button').nth(4).click()
    await expect
      .poll(async() => (await readFile(target, 'utf8').catch(() => '')).length, { timeout: 15000 })
      .toBeGreaterThan(200)

    // A dark theme draws pale text, which on the transparent canvas an svg
    // defaults to is invisible wherever the file is opened. Nothing underneath
    // may show through.
    const svg = await readFile(target, 'utf8')
    expect(await showsThrough(page, svg, '#ff00ff')).toBe(0)

    await expectNoRendererErrors(app)
  })

  test('saving as PNG keeps the labels mermaid draws in a foreignObject', async() => {
    const target = join(savePath, 'flowchart.png')
    await stubSaveDialog(app, target)
    await openDiagram(page)

    await page.locator('.media-viewer-toolbar button').nth(5).click()
    await expect
      .poll(async() => (await readFile(target).catch(() => Buffer.alloc(0))).length, {
        timeout: 20000
      })
      .toBeGreaterThan(1000)

    const png = await readFile(target)
    expect([...png.subarray(0, 4)]).toEqual(PNG_MAGIC)

    const exported = await inkedPixels(page, `data:image/png;base64,${png.toString('base64')}`)

    // Rasterising the live svg takes the foreignObject route Chromium refuses
    // to paint, so it loses every label. Ours must carry more ink than that.
    const naive = await page.evaluate(async() => {
      const svg = document.querySelector('.image-viewer .mu-diagram-preview svg')!
      const clone = svg.cloneNode(true) as SVGSVGElement
      clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
      const box = (svg as SVGSVGElement).viewBox.baseVal
      clone.setAttribute('width', String(Math.round(box.width)))
      clone.setAttribute('height', String(Math.round(box.height)))
      const markup = new XMLSerializer().serializeToString(clone)
      return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markup)}`
    })
    const naiveInk = await inkedPixels(page, naive)

    expect(exported).toBeGreaterThan(naiveInk)

    await expectNoRendererErrors(app)
  })

  test('copying puts the diagram on the clipboard as an image', async() => {
    await app.evaluate(({ clipboard }) => clipboard.clear())
    await openDiagram(page)

    await page.locator('.media-viewer-toolbar button').nth(6).click()
    await expect
      .poll(() => app.evaluate(({ clipboard }) => !clipboard.readImage().isEmpty()), {
        timeout: 20000
      })
      .toBe(true)

    await expectNoRendererErrors(app)
  })
})
