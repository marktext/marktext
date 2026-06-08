import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, focusEditor } from './helpers'

// Validates that @muyajs/core renders a plantuml code block to a plantuml.com
// img. The new engine encodes the diagram via `plantuml-encoder` and builds a
// `https://www.plantuml.com/plantuml/svg/<encoded>` URL (no `~1` deflate
// prefix, unlike the legacy pako path).

const PLANTUML_DOC = '# plantuml smoke\n\n```plantuml\n@startuml\nA -> B\n@enduml\n```\n'

test.describe('PlantUML render via plantuml-encoder', () => {
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
    // `plantuml-encoder` emits the plantuml-alphabet base64 directly with no
    // `~1` deflate prefix (the legacy pako path used `~1`).
    expect(src).toMatch(/^https:\/\/www\.plantuml\.com\/plantuml\/svg\/[A-Za-z0-9_-]+$/)
  })
})
