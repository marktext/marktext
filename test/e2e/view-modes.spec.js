const { expect, test } = require('@playwright/test')
const { launchWithMarkdown, clickMenuById } = require('./helpers')

test.describe('View modes', () => {
  let app = null
  let page = null

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# View modes\n\nBody.\n')
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Toggle focus mode adds and removes .focus on .editor-wrapper', async() => {
    await clickMenuById(app, 'focusModeMenuItem')
    await expect(page.locator('.editor-wrapper')).toHaveClass(/(^|\s)focus(\s|$)/)
    await clickMenuById(app, 'focusModeMenuItem')
    await page.waitForFunction(
      () => !document.querySelector('.editor-wrapper').classList.contains('focus'),
      null,
      { timeout: 5000 }
    )
  })

  test('Toggle typewriter mode adds and removes .typewriter on .editor-wrapper', async() => {
    await clickMenuById(app, 'typewriterModeMenuItem')
    await expect(page.locator('.editor-wrapper')).toHaveClass(/(^|\s)typewriter(\s|$)/)
    await clickMenuById(app, 'typewriterModeMenuItem')
    await page.waitForFunction(
      () => !document.querySelector('.editor-wrapper').classList.contains('typewriter'),
      null,
      { timeout: 5000 }
    )
  })

  test('Toggle source-code mode swaps editor for CodeMirror', async() => {
    await clickMenuById(app, 'sourceCodeModeMenuItem')
    await page.waitForSelector('.source-code .CodeMirror', { state: 'attached', timeout: 10000 })
    await expect(page.locator('.editor-wrapper')).toHaveClass(/(^|\s)source(\s|$)/)
    await clickMenuById(app, 'sourceCodeModeMenuItem')
    await page.waitForFunction(() => !document.querySelector('.source-code'), null, { timeout: 10000 })
  })
})
