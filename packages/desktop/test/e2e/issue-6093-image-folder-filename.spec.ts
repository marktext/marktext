import { expect, test } from '@playwright/test'
import type { Page } from 'playwright'
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchElectron, waitForEditor } from './helpers'

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

for (const name of ['price$$list', 'notes$&todo']) {
  test(`\${filename} image folder keeps "${name}" verbatim`, async() => {
    const root = mkdtempSync(join(tmpdir(), 'marktext-filename-'))
    const source = join(root, 'shot.png')
    writeFileSync(
      source,
      Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64'
      )
    )
    const document = join(root, `${name}.md`)
    writeFileSync(document, '# Draft\n')
    const { app, page } = await launchElectron([document], {
      preferences: {
        language: 'en',
        imageInsertAction: 'folder',
        imagePreferRelativeDirectory: true,
        imageRelativeDirectoryBase: 'file',
        imageRelativeDirectoryName: '${filename}.assets'
      }
    })
    try {
      await waitForEditor(page)
      await dropImage(page, source)
      await expect(page.locator('.editor-component .mu-image-success')).toHaveCount(1)
      expect(readdirSync(root).sort()).toEqual([`${name}.assets`, `${name}.md`, 'shot.png'])
    } finally {
      await app.close()
      rmSync(root, { recursive: true, force: true })
    }
  })
}
