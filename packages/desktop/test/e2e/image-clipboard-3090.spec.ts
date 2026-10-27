import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import type { Muya } from '@muyajs/core'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { createServer, type Server } from 'node:http'
import {
  clickMenuById,
  expectNoRendererErrors,
  launchElectron,
  setSourceMarkdown,
  waitForEditor,
  waitForMenuReady
} from './helpers'

import { backupClipboard, restoreClipboard, readClipboardState } from './clipboardHelpers'

const rawImage = '<img src="assets/source.png" alt="sample" title="caption" width="48" height="48" data-align="right">'
const modifier = process.platform === 'darwin' ? 'Meta' : 'Control'

const markdown = (page: Page) => page.evaluate(() => {
  const content = document.querySelector('.editor-component .mu-content') as HTMLElement & {
    __MUYA_BLOCK__: { muya: { getMarkdown(): string } }
  }
  return content.__MUYA_BLOCK__.muya.getMarkdown()
})

test.describe('image clipboard interoperability (#3090)', () => {
  let app: ElectronApplication
  let page: Page
  let fixture: string
  let sourceFile: string
  let targetFile: string
  let server: Server
  let serverUrl: string

  const openFile = async(pathname: string) => {
    await app.evaluate(({ ipcMain, BrowserWindow }, pathname) => {
      ipcMain.emit('app-open-file-by-id', BrowserWindow.getAllWindows()[0].id, pathname)
    }, pathname)
    await expect.poll(() => page.title()).toContain(pathname.split('/').pop() ?? '')
  }

  const copySelected = async() => {
    await page.locator('.editor-component .mu-image-success img').first().click()
    await page.keyboard.press(`${modifier}+c`)
    await expect.poll(() => app.evaluate(({ clipboard }) => clipboard.has('image/png'))).toBe(true)
  }

  test.beforeAll(async() => {
    fixture = mkdtempSync(join(tmpdir(), 'marktext-image-clipboard-'))
    mkdirSync(join(fixture, 'source/assets'), { recursive: true })
    mkdirSync(join(fixture, 'target/assets'), { recursive: true })
    copyFileSync(resolve('static/logo-96px.png'), join(fixture, 'source/assets/source.png'))
    sourceFile = join(fixture, 'source/source.md')
    targetFile = join(fixture, 'target/target.md')
    writeFileSync(sourceFile, `${rawImage}\n\ntarget\n`)
    writeFileSync(targetFile, 'destination\n')
    server = createServer((req, res) => {
      if (req.url === '/generic.png' || req.url === '/untyped.png') {
        if (req.url === '/generic.png') res.setHeader('Content-Type', 'application/octet-stream')
        res.end(readFileSync(join(fixture, 'source/assets/source.png')))
        return
      }
      if (req.url === '/redirect.svg') {
        res.writeHead(302, { Location: '/image.svg' })
        res.end()
        return
      }
      res.setHeader('Content-Type', 'image/svg+xml')
      res.end('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="80"><rect width="60" height="40" fill="red"/></svg>')
    })
    await new Promise<void>(done => server.listen(0, '127.0.0.1', done))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Image server did not start')
    serverUrl = `http://127.0.0.1:${address.port}/image.svg`
    const launched = await launchElectron([sourceFile], {
      suppressErrorDialog: true,
      preferences: { language: 'en', autoSave: false, imageInsertAction: 'folder', imagePreferRelativeDirectory: true }
    })
    app = launched.app
    page = launched.page
    await waitForEditor(page)
    await waitForMenuReady(app)
    await backupClipboard(app)
    await app.evaluate(({ clipboard }) => clipboard.clear())
  })

  test.beforeEach(async() => {
    await openFile(sourceFile)
    await setSourceMarkdown(page, app, `${rawImage}\n\ntarget\n`)
    await expect(page.locator('.editor-component .mu-image-success img')).toHaveCount(1)
    await app.evaluate(({ clipboard }) => clipboard.clear())
  })

  test.afterEach(async() => {
    await expectNoRendererErrors(app)
  })

  test.afterAll(async() => {
    if (app) {
      await restoreClipboard(app)
      await app.close()
    }
    if (server) await new Promise<void>(done => server.close(() => done()))
    if (fixture) rmSync(fixture, { recursive: true, force: true })
  })

  test('Cmd/Ctrl+C writes Markdown, real HTML and bitmap together', async() => {
    await copySelected()
    const copied = await readClipboardState(app)
    expect(copied.text).toBe(rawImage)
    expect(copied.html).toContain('data-marktext-image')
    expect(copied.formats).toEqual(expect.arrayContaining(['text/plain', 'text/html', 'image/png']))
    expect(copied.size).toEqual({ width: 96, height: 96 })
  })

  test('same-document paste preserves the resized reference without creating an asset', async() => {
    await copySelected()
    await page.locator('.mu-paragraph-content').filter({ hasText: 'target' }).click()
    await page.keyboard.press(`${modifier}+v`)
    await expect.poll(() => markdown(page)).toContain(`target${rawImage}`)
    expect(readdirSync(join(fixture, 'source/assets'))).toEqual(['source.png'])
  })

  test('cross-document paste copies a relative asset and preserves image attributes', async() => {
    await copySelected()
    await openFile(targetFile)
    await page.locator('.mu-paragraph-content').filter({ hasText: 'destination' }).click()
    await page.keyboard.press(`${modifier}+v`)
    await expect.poll(() => markdown(page)).toMatch(/src="assets\/[0-9a-f]{40}\.png"/)
    const pasted = await markdown(page)
    for (const attr of ['alt="sample"', 'title="caption"', 'width="48"', 'height="48"', 'data-align="right"']) expect(pasted).toContain(attr)
    const src = pasted.match(/src="([^"]+)"/)?.[1]
    expect(src && existsSync(join(fixture, 'target', src))).toBeTruthy()
  })

  test('pasting over a selected image replaces its complete token', async() => {
    const old = '<img src="assets/source.png" alt="replace me" width="24">'
    await setSourceMarkdown(page, app, `${rawImage}\n\n${old}\n`)
    await copySelected()
    await page.locator('.editor-component .mu-image-container img').last().click()
    await page.keyboard.press(`${modifier}+v`)
    await expect.poll(() => markdown(page)).toBe(`${rawImage}\n\n${rawImage}\n`)
    await expect(page.locator('.editor-component .mu-image-container img')).toHaveCount(2)
  })

  test('paste as plain text inserts the Markdown into a code block', async() => {
    await setSourceMarkdown(page, app, `${rawImage}\n\n\`\`\`text\ncode\n\`\`\`\n`)
    await copySelected()
    await page.locator('.mu-codeblock-content').click()
    await clickMenuById(app, 'pasteAsPlainTextMenuItem')
    await expect.poll(() => markdown(page)).toMatch(new RegExp('```text\\n[\\s\\S]*' + rawImage.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    expect(readdirSync(join(fixture, 'source/assets'))).toEqual(['source.png'])
  })

  test('ordinary paste into a code block selects the text representation', async() => {
    await setSourceMarkdown(page, app, `${rawImage}\n\n\`\`\`text\ncode\n\`\`\`\n`)
    await copySelected()
    await page.locator('.mu-codeblock-content').click()
    await page.keyboard.press(`${modifier}+v`)
    await expect.poll(() => page.locator('.mu-codeblock-content').innerText()).toContain(rawImage)
  })

  for (const anchor of ['code', 'language'] as const) {
    test(`internal image paste replaces a cross-block selection starting in ${anchor}`, async() => {
      await setSourceMarkdown(page, app, `${rawImage}\n\n\`\`\`text\nalpha\n\`\`\`\n\nafter\n`)
      await copySelected()
      const selection = await page.evaluate((anchor) => {
        type ContentElement = HTMLElement & { __MUYA_BLOCK__: NonNullable<Muya['editor']['activeContentBlock']> }
        const start = document.querySelector<ContentElement>(anchor === 'code' ? '.mu-codeblock-content' : '.mu-language-input')?.__MUYA_BLOCK__
        const end = [...document.querySelectorAll<ContentElement>('.mu-paragraph-content')].find(el => el.textContent === 'after')?.__MUYA_BLOCK__
        if (!start || !end || !start.parent) throw new Error('Missing selection endpoints')
        const muya = start.muya
        muya.domNode.focus()
        const applied = muya.setSelection({
          kind: 'text',
          anchor: { path: anchor === 'language' ? [...start.parent.path, 'meta', 'lang'] : start.path, offset: 2 },
          focus: { path: end.path, offset: 2 }
        } as Parameters<Muya['setSelection']>[0])
        const textSelection = muya.editor.selection.getTextSelection()
        return { applied, sameBlock: textSelection?.isSelectionInSameBlock, anchorType: textSelection?.anchor.block.blockName, cursor: start.getCursor() }
      }, anchor)
      expect(selection).toEqual({ applied: true, sameBlock: false, anchorType: anchor === 'code' ? 'codeblock.content' : 'language-input', cursor: null })
      await page.keyboard.press(`${modifier}+v`)
      const expected = anchor === 'code'
        ? `${rawImage}\n\n\`\`\`text\nal${rawImage}ter\n\`\`\`\n`
        : `${rawImage}\n\nte${rawImage}ter\n`
      await expect.poll(() => markdown(page)).toBe(expected)
    })
  }

  for (const path of ['generic.png', 'untyped.png']) {
    test(`copies a displayable remote image served as ${path}`, async() => {
      const url = serverUrl.replace('/image.svg', `/${path}`)
      await setSourceMarkdown(page, app, `![remote](${url})\n`)
      await expect(page.locator('.editor-component .mu-image-success img')).toHaveCount(1)
      const loaded = await page.evaluate(url => window.electron.clipboard.readImageSource(url), url)
      expect(loaded.ok, loaded.ok ? undefined : loaded.error).toBe(true)
      await copySelected()
      expect(await app.evaluate(({ clipboard }) => clipboard.readText())).toBe(`![remote](${url})`)
    })
  }

  test('external clipboard image and text still use the image insertion preferences', async() => {
    await app.evaluate(({ clipboard, ClipboardItem, nativeImage }, pathname) => {
      const image = nativeImage.createFromPath(pathname)
      return clipboard.write([new ClipboardItem({
        'text/plain': 'external label',
        'image/png': new Blob([new Uint8Array(image.toPNG())], { type: 'image/png' })
      })])
    }, join(fixture, 'source/assets/source.png'))
    await page.locator('.mu-paragraph-content').filter({ hasText: 'target' }).click()
    await page.keyboard.press(`${modifier}+v`)
    await expect.poll(() => markdown(page)).toMatch(/!\[\]\(assets\/[0-9a-f]{40}\.png\)/)
    expect(await markdown(page)).not.toContain('external label')
  })

})
