import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { launchElectron, expectNoRendererErrors } from './helpers'

for (const input of [
  '{broken',
  JSON.stringify({ fontSize: 'large', startUpAction: 'obsolete', autoSave: false })
]) {
  test(`editable startup with invalid preferences: ${input}`, async() => {
    const { app, page } = await launchElectron([], {
      suppressErrorDialog: true,
      userDataFiles: { 'preferences.json': input }
    })
    try {
      const editor = page.getByRole('textbox')
      await expect(editor).toBeVisible()
      await editor.click()
      await page.keyboard.type('Configuration fallback is editable')
      await expect(editor).toContainText('Configuration fallback is editable')
      if (input === '{broken') {
        const directory = await app.evaluate(({ app }) => app.getPath('userData'))
        expect(readFileSync(join(directory, 'preferences.json'), 'utf8')).toBe(input)
      }
      await expectNoRendererErrors(app)
    } finally {
      await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
      await app.close()
    }
  })
}
