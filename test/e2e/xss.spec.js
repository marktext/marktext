const { expect, test } = require('@playwright/test')
const { launchElectron } = require('./helpers')

test.describe('Test XSS Vulnerabilities', async () => {
  let app = null
  let page = null

  test.beforeAll(async () => {
    const { app: electronApp, page: firstPage } = await launchElectron(['test/e2e/data/xss.md'])
    app = electronApp
    page = firstPage

    // Wait to parse and render the document.
    await new Promise((resolve) => setTimeout(resolve, 3000))
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('Load malicious document', async () => {
    const { isVisible, isCrashed } = await app.evaluate(async process => {
      const mainWindow = process.BrowserWindow.getAllWindows()[0]
      return {
        isVisible: mainWindow.isVisible(),
        isCrashed: mainWindow.webContents.isCrashed()
      }
    })

    expect(isVisible).toBeTruthy()
    expect(isCrashed).toBeFalsy()
  })
})
