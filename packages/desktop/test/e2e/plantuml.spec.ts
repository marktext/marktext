import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, focusEditor } from './helpers'

// Validates the pako-based encoder that replaced Node zlib in
// src/muya/lib/parser/render/plantuml.js. The encoded payload is what shows
// up in the rendered img src; if pako or the base64 / table-translate path
// regresses, the URL won't follow plantuml.com's expected shape.

const PLANTUML_DOC = '# plantuml smoke\n\n```plantuml\n@startuml\nA -> B\n@enduml\n```\n'
const CUSTOM_SERVER = 'http://localhost:9999/plantuml'

test.describe('PlantUML render via pako', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(PLANTUML_DOC)
    app = launched.app
    page = launched.page
    await focusEditor(page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('plantuml block renders an img with the default plantuml.com src', async() => {
    // Muya renders code-block diagrams lazily; wait for the img to appear.
    const img = page.locator('img[src*="plantuml.com/plantuml"]').first()
    await expect(img).toHaveCount(1, { timeout: 10000 })
    const src = await img.getAttribute('src')
    expect(src).toMatch(/^https:\/\/www\.plantuml\.com\/plantuml\/svg\/~1[A-Za-z0-9_-]+$/)
  })

  test('plantuml block uses custom server URL when preference is set', async() => {
    // Set a custom PlantUML server URL via the preference system.
    await page.evaluate((url) => {
      window.electron.ipcRenderer.send('mt::set-user-preference', { plantumlServer: url })
    }, CUSTOM_SERVER)

    // Re-focus the editor to trigger a re-render with the new option.
    await focusEditor(page)

    // Wait for the new img element pointing at the custom server.
    const img = page.locator(`img[src*="${CUSTOM_SERVER}"]`).first()
    await expect(img).toHaveCount(1, { timeout: 10000 })
    const src = await img.getAttribute('src')
    expect(src).toMatch(new RegExp(`^${escapeRegex(CUSTOM_SERVER)}/svg/~1[A-Za-z0-9_-]+$`))
  })
})

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
