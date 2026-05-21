const { expect, test } = require('@playwright/test')
const { launchElectron, waitForMenuReady } = require('./helpers')

test.describe('Application menu wiring', () => {
  let app = null

  test.beforeAll(async() => {
    const { app: electronApp } = await launchElectron()
    app = electronApp
    await waitForMenuReady(app)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('Top-level menu has the expected categories', async() => {
    const labels = await app.evaluate(({ Menu }) => {
      return Menu.getApplicationMenu().items.map((i) => i.label)
    })
    expect(labels.length).toBeGreaterThanOrEqual(5)
  })

  test('Known menu IDs are registered', async() => {
    const expected = [
      'heading1MenuItem',
      'heading2MenuItem',
      'heading3MenuItem',
      'quoteBlockMenuItem',
      'codeFencesMenuItem',
      'bulletListMenuItem',
      'orderListMenuItem',
      'taskListMenuItem',
      'horizontalLineMenuItem',
      'mathBlockMenuItem',
      'paragraphMenuItem',
      'strongMenuItem',
      'emphasisMenuItem',
      'inlineCodeMenuItem',
      'strikeMenuItem',
      'highlightMenuItem',
      'underlineMenuItem',
      'superscriptMenuItem',
      'subscriptMenuItem',
      'inlineMathMenuItem',
      'sourceCodeModeMenuItem',
      'typewriterModeMenuItem',
      'focusModeMenuItem',
      'sideBarMenuItem',
      'tabBarMenuItem',
      'tocMenuItem',
      'autoSaveMenuItem',
      'dark',
      'light',
      'dracula',
      'nord'
    ]
    const present = await app.evaluate(({ Menu }, ids) => {
      const menu = Menu.getApplicationMenu()
      return ids.map((id) => !!menu.getMenuItemById(id))
    }, expected)
    expected.forEach((id, idx) => {
      expect(present[idx], `menu id "${id}" should exist`).toBe(true)
    })
  })
})
