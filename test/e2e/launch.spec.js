const { expect, test } = require('@playwright/test')
const { launchElectron } = require('./helpers')

test.describe('Check Launch Mark Text', async () => {
  let app = null
  let page = null

  test.beforeAll(async () => {
    const { app: electronApp, page: firstPage } = await launchElectron()
    app = electronApp
    page = firstPage
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('Empty Mark Text', async () => {
    const title = await page.title()
    expect(/^Mark Text|Untitled-1 - Mark Text$/.test(title)).toBeTruthy()
  })
})
