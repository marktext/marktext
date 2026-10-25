import type { Muya } from '@muyajs/core'
import type { ElectronApplication, Page } from 'playwright'
import { expect, test } from '@playwright/test'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  expectNoRendererErrors,
  launchWithMarkdown,
  toggleReadingMode
} from './helpers'

const evidenceDirectory = process.env.MARKTEXT_SELECTION_EVIDENCE_DIR
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'
const TABLE_DOCUMENT = 'Before selection table\n\n| a | b |\n| --- | --- |\n| c | d |\n\nAfter entire document\n'

type ContentElement = HTMLElement & { __MUYA_BLOCK__: { muya: Muya } }

const imageTools = async(page: Page) => page.evaluate(() => {
  const wrapper = document.querySelector('.mu-image-toolbar')?.closest<HTMLElement>('.mu-float-wrapper')
  const content = document.querySelector('.editor-component .mu-content') as ContentElement
  return {
    kind: content.__MUYA_BLOCK__.muya.getSelection()?.kind,
    toolbar: wrapper?.style.opacity === '1',
    handles: document.querySelectorAll('.mu-transformer .bar').length
  }
})

const recordObservation = async(observation: object): Promise<void> => {
  const body = JSON.stringify(observation, null, 2)
  await test.info().attach('selection-state', { body, contentType: 'application/json' })
  if (evidenceDirectory) {
    const name = test.info().title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
    writeFileSync(join(evidenceDirectory, `${name}.json`), body)
  }
}

test.describe('selection review regressions in MarkText Electron', () => {
  let app: ElectronApplication | undefined
  let page: Page
  let fixtureDirectory: string

  test.beforeEach(async() => {
    fixtureDirectory = mkdtempSync(join(tmpdir(), 'marktext-selection-fixture-'))
    if (evidenceDirectory) mkdirSync(evidenceDirectory, { recursive: true })
  })

  test.afterEach(async() => {
    const info = test.info()
    if (evidenceDirectory && page && !page.isClosed()) {
      const name = info.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
      await page.screenshot({ path: join(evidenceDirectory, `${name}.png`) })
    }
    if (app) await app.close()
    app = undefined
    rmSync(fixtureDirectory, { recursive: true, force: true })
  })

  const launch = async(markdown: string) => {
    const launched = await launchWithMarkdown(markdown, {
      suppressErrorDialog: true,
      preferences: { language: 'en', autoSave: false }
    })
    app = launched.app
    page = launched.page
    return launched
  }

  for (const dismissal of ['hideAllFloatTools', 'scroll'] as const) {
    test(`reselecting the same image reopens tools after ${dismissal}`, async() => {
      const imagePath = join(fixtureDirectory, 'image.svg')
      writeFileSync(imagePath, '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="160"><rect width="400" height="160" fill="#3677c8"/></svg>')
      const { app, page } = await launch(`Before image\n\n![review](${imagePath})\n\n${'Paragraph after image.\n\n'.repeat(35)}`)
      const image = page.locator('.editor-component .mu-image-container img')
      await expect(image).toBeVisible()
      await image.click()
      await expect.poll(() => imageTools(page)).toEqual({ kind: 'image', toolbar: true, handles: 2 })

      if (dismissal === 'hideAllFloatTools') {
        await page.evaluate(() => {
          const content = document.querySelector('.editor-component .mu-content') as ContentElement
          content.__MUYA_BLOCK__.muya.hideAllFloatTools()
        })
      } else {
        await page.evaluate(() => {
          const content = document.querySelector('.editor-component .mu-content') as ContentElement
          content.__MUYA_BLOCK__.muya.domNode.dispatchEvent(new Event('scroll'))
        })
        await page.locator('.editor-component').evaluate((element) => { element.scrollTop += 65 })
      }
      await expect.poll(() => imageTools(page)).toEqual({ kind: 'image', toolbar: false, handles: 0 })
      await image.click()
      await expect.poll(() => imageTools(page)).toEqual({ kind: 'image', toolbar: true, handles: 2 })
      await recordObservation({ scenario: dismissal, afterReselect: await imageTools(page) })
      await expectNoRendererErrors(app)
    })
  }

  test('read-only Select All replaces a table rectangle with the full document', async() => {
    const { app, page } = await launch(TABLE_DOCUMENT)
    await toggleReadingMode(page)
    const cells = page.locator('.editor-component td.mu-table-cell')
    const start = await cells.first().boundingBox()
    const end = await cells.last().boundingBox()
    if (!start || !end) throw new Error('Table cells are not visible')
    await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
    await page.mouse.down()
    await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 8 })
    await page.mouse.up()
    await expect(page.locator('.editor-component .mu-table-cell-selected')).toHaveCount(4)
    await page.keyboard.press(`${modifier}+a`)
    await expect.poll(() => page.evaluate(() => document.getSelection()?.toString())).toContain('After entire document')
    await page.keyboard.press(`${modifier}+c`)
    const observed = await page.evaluate(() => {
      const content = document.querySelector('.editor-component .mu-content') as ContentElement
      const muya = content.__MUYA_BLOCK__.muya
      return { readOnly: muya.isReadOnly, kind: muya.getSelection()?.kind,
        selectedText: muya.getSelectedText(), nativeText: document.getSelection()?.toString() }
    })
    const copied = await app.evaluate(({ clipboard }) => clipboard.readText())
    await recordObservation({ scenario: 'read-only select all', ...observed, copied })
    expect(observed.readOnly).toBe(true)
    expect(observed.kind).toBe('text')
    expect(observed.selectedText).toContain('Before selection table')
    expect(observed.selectedText).toContain('After entire document')
    expect(copied).toContain('Before selection table')
    expect(copied).toContain('After entire document')
    await expect(page.locator('.editor-component .mu-table-cell-selected')).toHaveCount(0)
    await expectNoRendererErrors(app)
  })

  for (const collapsed of [false, true]) {
    test(`loading an inactive same-renderer instance preserves the active ${collapsed ? 'caret' : 'range'}`, async() => {
      const { app, page } = await launch('Active editor selection\n')
      const observed = await page.evaluate((collapsed) => {
        const content = document.querySelector('.editor-component .mu-content') as ContentElement
        const active = content.__MUYA_BLOCK__.muya
        // MarkText has one engine per window. Use its actual bundled constructor
        // to exercise the shared-document ownership contract in this renderer.
        const Engine = active.constructor as typeof Muya
        const host = document.createElement('div')
        document.body.appendChild(host)
        const inactive = new Engine(host, { markdown: 'Inactive editor' })
        inactive.init({ focus: false })
        try {
          const block = active.editor.scrollPage?.firstContentInDescendant()
          if (!block) throw new Error('Active editor has no content')
          block.setCursor(0, collapsed ? 0 : 6)
          const native = document.getSelection()
          if (!native) throw new Error('Native selection is unavailable')
          const before = { ranges: native.rangeCount, text: native.toString(), anchor: native.anchorNode, offset: native.anchorOffset }
          inactive.setContent('Loaded in the inactive editor')
          return {
            before: { ranges: before.ranges, text: before.text, offset: before.offset },
            after: { ranges: native.rangeCount, text: native.toString(), offset: native.anchorOffset,
              sameAnchor: native.anchorNode === before.anchor },
            inactiveText: inactive.getMarkdown()
          }
        } finally {
          inactive.destroy()
        }
      }, collapsed)
      await recordObservation({ scenario: collapsed ? 'inactive load caret' : 'inactive load range', ...observed })
      expect(observed.before.ranges).toBe(1)
      expect(observed.after).toEqual({ ...observed.before, sameAnchor: true })
      expect(observed.inactiveText).toContain('Loaded in the inactive editor')
      await expectNoRendererErrors(app)
    })
  }
})
