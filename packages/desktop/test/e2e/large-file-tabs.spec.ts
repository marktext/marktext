import { expect, test } from '@playwright/test'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { launchElectron, waitForEditor, waitForMenuReady } from './helpers'

test('large table documents restore scroll position when switching tabs (#5860)', async() => {
  const directory = mkdtempSync(path.join(tmpdir(), 'marktext-large-tabs-'))
  const largePath = path.join(directory, 'large.md')
  const smallPath = path.join(directory, 'small.md')
  const section = [
    '## Section',
    '',
    '| Name | Description |',
    '| --- | --- |',
    ...Array.from({ length: 20 }, (_, i) => `| Row ${i} | ${'Long **formatted** cell with 中文 text. '.repeat(4)} |`),
    ''
  ].join('\n')
  writeFileSync(largePath, Array.from({ length: 55 }, () => section).join('\n'))
  writeFileSync(smallPath, 'Small document\n\n'.repeat(1000))
  const { app, page } = await launchElectron([largePath, smallPath], { windowLayout: { showTabBar: true },
    preferences: { openFilesInNewWindow: false,}
  })
  try {
    await waitForEditor(page)
    await waitForMenuReady(app)
    const tabs = page.locator('.tabs-container > li')
    await expect(tabs).toHaveCount(2)
    await tabs.filter({ hasText: 'large.md' }).click()
    const scrollSelector = '.editor-component.mu-editor'
    const scrollTop = await page.locator(scrollSelector).evaluate(element => {
      element.scrollTop = 3000
      return element.scrollTop
    })
    expect(scrollTop).toBeGreaterThan(0)
    for (let i = 0; i < 3; i++) {
      await tabs.filter({ hasText: 'small.md' }).click()
      await expect(page.locator('.editor-component')).toContainText('Small document')
      await tabs.filter({ hasText: 'large.md' }).click()
      await expect(page.locator('.editor-component table')).toHaveCount(55)
      await expect.poll(() => page.locator(scrollSelector).evaluate(element => {
        return element.scrollTop
      })).toBe(scrollTop)
      await expect(page.locator(scrollSelector)).toBeVisible()
    }
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    rmSync(directory, { recursive: true, force: true })
  }
})
