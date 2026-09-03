import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown } from './helpers'

const MERMAID_DOC = `# Mermaid preview

\`\`\`mermaid
sequenceDiagram
    participant A as Caller
    participant B as Service
    A->>B: Request
    B-->>A: Response
\`\`\`

\`\`\`mermaid
flowchart LR
    ArchitectureNode[Architecture Node] --> StorageNode[Storage Node]
\`\`\`
`

test.describe('Mermaid image preview', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(MERMAID_DOC)
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('opens on click, zooms with the wheel, and closes with Escape', async() => {
    const diagrams = page.locator('.editor-component figure[data-role="MERMAID"] svg')
    await expect(diagrams).toHaveCount(2, { timeout: 15000 })
    const diagram = diagrams.first()
    const sequenceText = await diagram.textContent()
    const flowchartText = await diagrams.nth(1).textContent()
    expect(sequenceText).toContain('Caller')
    expect(sequenceText).not.toContain('Architecture Node')
    expect(flowchartText).toContain('Architecture Node')
    expect(flowchartText).not.toContain('Caller')
    await expect(diagram).toBeVisible({ timeout: 15000 })
    await expect(diagram).toHaveCSS('cursor', 'zoom-in')
    const diagramBox = await diagram.boundingBox()

    await diagram.click()

    const viewer = page.locator('.image-viewer')
    const canvas = viewer.locator(':scope > div')
    const preview = viewer.locator('img')
    await expect(viewer).toBeVisible()
    await expect(preview).toBeVisible()
    await expect(preview).toHaveAttribute('src', /^data:image\/svg\+xml/)
    await expect(canvas).toHaveCSS('background-color', 'rgb(255, 255, 255)')
    const viewerBox = await viewer.boundingBox()
    const canvasBox = await canvas.boundingBox()
    const previewBox = await preview.boundingBox()
    expect(viewerBox).not.toBeNull()
    expect(canvasBox).not.toBeNull()
    if (!viewerBox || !canvasBox) throw new Error('Viewer layout boxes are unavailable')
    const horizontalOffset =
      canvasBox.x + canvasBox.width / 2 - (viewerBox.x + viewerBox.width / 2)
    const verticalOffset =
      canvasBox.y + canvasBox.height / 2 - (viewerBox.y + viewerBox.height / 2)
    expect(Math.abs(horizontalOffset)).toBeLessThanOrEqual(1)
    expect(Math.abs(verticalOffset)).toBeLessThanOrEqual(1)
    expect(canvasBox?.width).toBeLessThan((viewerBox?.width ?? 0) * 0.9)
    expect(canvasBox?.height).toBeLessThan((viewerBox?.height ?? 0) * 0.9)
    expect(previewBox?.width).toBeLessThan(canvasBox?.width ?? 0)
    expect(previewBox?.height).toBeLessThan(canvasBox?.height ?? 0)
    expect(previewBox?.width).toBeGreaterThan(diagramBox?.width ?? 0)

    await viewer.click({ position: { x: 2, y: 2 } })
    await expect(viewer).toBeHidden()

    await diagram.click()
    await expect(viewer).toBeVisible()

    await canvas.dispatchEvent('wheel', { deltaY: -100 })
    await expect(preview).toHaveCSS('transform', /matrix\(1\.1, 0, 0, 1\.1, 0, 0\)/)

    await page.keyboard.press('Escape')
    await expect(viewer).toBeHidden()
  })
})
