import { expect, test } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { launchElectron, waitForMenuReady } from './helpers'

test.describe('Application menu wiring', () => {
  let app: ElectronApplication

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
      const menu = Menu.getApplicationMenu()
      return menu ? menu.items.map((i) => i.label) : []
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
      if (!menu) return ids.map(() => false)
      return ids.map((id) => !!menu.getMenuItemById(id))
    }, expected)
    expected.forEach((id, idx) => {
      expect(present[idx], `menu id "${id}" should exist`).toBe(true)
    })
  })
})
