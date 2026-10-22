import { expect, test } from '@playwright/test'
import { launchWithMarkdown, clickMenuById } from './helpers'

const markdown = [
  '# Mermaid theme contrast',
  '',
  '```mermaid',
  'sequenceDiagram',
  '    Alice->>Bob: Hello Bob',
  '    Bob-->>Alice: Hi Alice',
  '```',
  '',
  '```mermaid',
  'flowchart LR',
  '    A[Start] --> B[Finish]',
  '```',
  ''
].join('\n')

test('Mermaid connectors and arrowheads follow dark themes on startup and switching (#5832)', async() => {
  test.setTimeout(90000)
  const { app, page } = await launchWithMarkdown(markdown, {
    preferences: { theme: 'dracula', followSystemTheme: false }
  })
  const connectors = '.mu-diagram-preview .messageLine0, .mu-diagram-preview .messageLine1, .mu-diagram-preview .flowchart-link'
  const colors = async(selector: string, property: 'fill' | 'stroke') =>
    page.locator(selector).evaluateAll((elements, property) => elements.map((element) =>
      getComputedStyle(element)[property]
    ), property)
  try {
    await expect(page.locator('.mu-diagram-preview svg')).toHaveCount(2, { timeout: 20000 })
    await expect(page.locator(connectors)).toHaveCount(3)
    if (process.env.DIAGRAM_THEME_SCREENSHOT) {
      await page.screenshot({ path: process.env.DIAGRAM_THEME_SCREENSHOT })
    }
    for (const theme of ['dracula', 'light', 'nord', 'material-dark', 'dark', 'light']) {
      await clickMenuById(app, theme)
      const expected = theme === 'light' ? 'rgb(51, 51, 51)' : 'rgb(211, 211, 211)'
      await expect.poll(() => colors(connectors, 'stroke')).toEqual([expected, expected, expected])
      await expect.poll(() => page.locator(connectors).evaluateAll((elements) =>
        elements.map((element) => {
          const reference = element.getAttribute('marker-end')?.match(/#([^)'"]+)/)?.[1]
          const path = reference ? document.getElementById(reference)?.querySelector('path') : null
          return path ? getComputedStyle(path).fill : null
        })
      )).toEqual([expected, expected, expected])
    }
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})
