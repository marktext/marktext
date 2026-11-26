import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { expect, test } from '@playwright/test'
import { expectNoRendererErrors, launchElectron, sendIpcToRenderer, waitForEditor, waitForMenuReady } from './helpers'

test('quick open matches file names containing braces literally (#6142)', async() => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-quick-open-braces-'))
  const pathname = path.join(folder, 'photo{2}.md')
  fs.writeFileSync(pathname, '# Photo\n')
  const { app, page } = await launchElectron([pathname], { preferences: { language: 'en' } })

  try {
    await waitForEditor(page)
    await waitForMenuReady(app)

    await sendIpcToRenderer(app, 'mt::execute-command-by-id', 'file.quick-open')
    const input = page.locator('input.search:visible').first()
    await expect(input).toHaveAttribute('placeholder', 'Search file to open')

    await input.pressSequentially('photo{2}')
    await expect(page.locator('.commands li.command-item')).toHaveCount(1)
    await expect(page.locator('.commands li.command-item')).toContainText('photo{2}.md')

    await input.press('Escape')
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
    fs.rmSync(folder, { recursive: true, force: true })
  }
})
