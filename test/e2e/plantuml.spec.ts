import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, focusEditor } from './helpers'

// Validates the pako-based encoder that replaced Node zlib in
// src/muya/lib/parser/render/plantuml.js. The encoded payload is what shows
// up in the rendered img src; if pako or the base64 / table-translate path
// regresses, the URL won't follow plantuml.com's expected shape.

const PLANTUML_DOC = '# plantuml smoke\n\n```plantuml\n@startuml\nA -> B\n@enduml\n```\n'

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

  test('plantuml block renders an img with a plantuml.com src', async() => {
    // Muya renders code-block diagrams lazily; wait for the img to appear.
    const img = page.locator('img[src*="plantuml.com/plantuml"]').first()
    await expect(img).toHaveCount(1, { timeout: 10000 })
    const src = await img.getAttribute('src')
    expect(src).toMatch(/^https:\/\/www\.plantuml\.com\/plantuml\/svg\/~1[A-Za-z0-9_-]+$/)
  })
})
