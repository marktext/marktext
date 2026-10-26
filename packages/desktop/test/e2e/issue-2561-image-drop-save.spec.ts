import { expect, test } from '@playwright/test'
import type { Page } from 'playwright'
import type { Muya } from '@muyajs/core'
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expectNoRendererErrors, launchElectron, typeIntoEditor, waitForEditor } from './helpers'

const markdown = (page: Page): Promise<string> =>
  page.evaluate(() => {
    const content = document.querySelector('.editor-component .mu-content') as HTMLElement & {
      __MUYA_BLOCK__: { muya: Muya }
    }
    return content.__MUYA_BLOCK__.muya.getMarkdown()
  })

const dropImage = async(page: Page, pathname: string): Promise<void> => {
  await page.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.id = 'image-drop-fixture'
    input.hidden = true
    document.body.appendChild(input)
  })
  await page.locator('#image-drop-fixture').setInputFiles(pathname)
  await page.evaluate(() => {
    const input = document.querySelector<HTMLInputElement>('#image-drop-fixture')
    const target = document.querySelector<HTMLElement>('.editor-component .mu-content')
    const file = input?.files?.[0]
    if (!input || !target || !file) throw new Error('Image drop fixture is unavailable')
    const transfer = new DataTransfer()
    transfer.items.add(file)
    target.dispatchEvent(
      new DragEvent('drop', {
        bubbles: true,
        cancelable: true,
        dataTransfer: transfer,
        clientY: target.getBoundingClientRect().top
      })
    )
    input.remove()
  })
}

for (const outcome of ['prompt-cancel', 'native-cancel', 'saved', 'failed'] as const) {
  test(`relative-directory image drop: ${outcome}`, async() => {
    const root = mkdtempSync(join(tmpdir(), 'marktext-2561-'))
    const globalImages = join(root, 'global')
    mkdirSync(globalImages)
    const source = join(root, 'shot.png')
    writeFileSync(
      source,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      )
    )
    const document = join(root, 'demo.md')
    const blocked = join(root, 'blocked')
    writeFileSync(blocked, 'not a directory')
    const { app, page } = await launchElectron([], {
      suppressErrorDialog: true,
      preferences: {
        language: 'en',
        imageInsertAction: 'folder',
        imagePreferRelativeDirectory: true,
        imageRelativeDirectoryBase: 'file',
        imageRelativeDirectoryName: '${filename}.assets'
      },
      userDataFiles: { 'dataCenter.json': JSON.stringify({ imageFolderPath: globalImages }) }
    })
    try {
      await waitForEditor(page)
      await typeIntoEditor(page, 'Draft')
      const original = await markdown(page)
      await app.evaluate(
        ({ dialog }, { outcome, document, blocked }) => {
          dialog.showSaveDialog = async() => ({
            canceled: outcome === 'native-cancel',
            filePath:
              outcome === 'native-cancel'
                ? ''
                : outcome === 'failed'
                  ? `${blocked}/demo.md`
                  : document
          })
        },
        { outcome, document, blocked }
      )
      await dropImage(page, source)
      const prompt = page.locator('.el-message-box')
      await expect(prompt).toBeVisible()
      await expect(prompt).toContainText(
        'Canceling will store the image in the global image directory.'
      )
      expect(await markdown(page)).toBe(original)
      expect(existsSync(document)).toBe(false)
      expect(readdirSync(globalImages)).toEqual([])
      await prompt
        .getByRole('button', { name: outcome === 'prompt-cancel' ? 'Cancel' : 'Save', exact: true })
        .click()
      await expect(prompt).toBeHidden()
      if (outcome === 'failed') {
        await expect(page.locator('.editor-notifications')).toBeVisible()
        expect(await markdown(page)).toBe(original)
        expect(readdirSync(globalImages)).toEqual([])
      } else {
        await expect(page.locator('.editor-component .mu-image-success')).toHaveCount(1)
        const inserted = await markdown(page)
        expect(inserted).not.toContain('loading-')
        if (outcome === 'saved') {
          expect(readFileSync(document, 'utf8')).toBe(original)
          expect(inserted).toContain('demo.assets/')
          expect(readdirSync(join(root, 'demo.assets'))).toHaveLength(1)
          expect(readdirSync(globalImages)).toEqual([])
        } else {
          expect(inserted).toContain(globalImages)
          expect(readdirSync(globalImages)).toHaveLength(1)
          expect(existsSync(document)).toBe(false)
        }
        await expect(page.locator('.title-bar .title .save-dot')).toHaveClass(/show/)
        await expect(page.locator('.mt-notification')).toHaveCount(0)
      }
      await expectNoRendererErrors(app)
    } finally {
      await app.close()
      rmSync(root, { recursive: true, force: true })
    }
  })
}
