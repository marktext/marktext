import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchElectron } from './helpers'

test.describe('issue #4356 custom protocol links', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchElectron()
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('opens custom protocol links through the external shell handler', async() => {
    await app.evaluate(({ shell }) => {
      const g = global as unknown as { __mt_opened_external_urls__?: string[] }
      g.__mt_opened_external_urls__ = []
      shell.openExternal = async(url: string) => {
        const urls = g.__mt_opened_external_urls__
        if (urls) urls.push(url)
      }
    })

    await page.evaluate(() => {
      window.electron.ipcRenderer.send('mt::format-link-click', {
        data: { href: null, text: 'sambesi://localhost/node/11164' },
        dirname: ''
      })
    })

    await expect
      .poll(async() => {
        return await app.evaluate(() => {
          const g = global as unknown as { __mt_opened_external_urls__?: string[] }
          return g.__mt_opened_external_urls__ || []
        })
      })
      .toContain('sambesi://localhost/node/11164')
  })

  test('does not pass file URLs to the external shell handler', async() => {
    await app.evaluate(() => {
      const g = global as unknown as { __mt_opened_external_urls__?: string[] }
      g.__mt_opened_external_urls__ = []
    })

    await page.evaluate(() => {
      window.electron.ipcRenderer.send('mt::format-link-click', {
        data: { href: 'file:///tmp/secret.md' },
        dirname: ''
      })
    })

    await page.waitForTimeout(250)
    const opened = await app.evaluate(() => {
      const g = global as unknown as { __mt_opened_external_urls__?: string[] }
      return g.__mt_opened_external_urls__ || []
    })
    expect(opened).toEqual([])
  })

  test('does not treat Windows drive paths as external protocols', async() => {
    await app.evaluate(() => {
      const g = global as unknown as { __mt_opened_external_urls__?: string[] }
      g.__mt_opened_external_urls__ = []
    })

    await page.evaluate(() => {
      window.electron.ipcRenderer.send('mt::format-link-click', {
        data: { href: 'C:/Users/example/note.md' },
        dirname: ''
      })
    })

    await page.waitForTimeout(250)
    const opened = await app.evaluate(() => {
      const g = global as unknown as { __mt_opened_external_urls__?: string[] }
      return g.__mt_opened_external_urls__ || []
    })
    expect(opened).toEqual([])
  })
})
