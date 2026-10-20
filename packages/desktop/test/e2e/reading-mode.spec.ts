import type CodeMirror from 'codemirror'
import { expect, test } from '@playwright/test'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { launchWithMarkdown, sendIpcToRenderer, typeIntoEditor, toggleReadingMode } from './helpers'

test('clicking rendered diagrams while reading opens the diagram viewer and retains the lock', async() => {
  const markdown =
    'Paragraph\n\n```mermaid\nflowchart TD\nA[Reading] --> B[Preview]\n```\n\n```sequence\nAlice->Bob: Reading preview\n```\n'
  const { app, page, filePath } = await launchWithMarkdown(markdown)
  try {
    await toggleReadingMode(page, app)
    const previews = page.locator('.editor-component .mu-diagram-preview')
    for (let index = 0; index < 2; index++) {
      const svg = previews.nth(index).locator('svg')
      await expect(svg).toBeVisible({ timeout: 20000 })
      await svg.click()
      await expect(page.locator('.image-viewer')).toBeVisible()
      await expect(page.locator('.image-viewer .mu-diagram-preview svg')).toHaveCount(1)
      await expect(page.locator('.media-viewer-toolbar button')).toHaveCount(7)
      await page.keyboard.press('Escape')
      await expect(page.locator('.image-viewer')).toBeHidden()
    }
    await expect(page.locator('.mu-read-only')).toBeVisible()
    await expect(page.locator('.tabs-container li.unsaved')).toHaveCount(0)
    expect(readFileSync(filePath, 'utf8')).toBe(markdown)
    await toggleReadingMode(page, app)
    await previews.first().locator('svg').click()
    await expect(page.locator('.image-viewer')).toBeHidden()
    await expect(page.locator('figure.mu-diagram-block').first()).toHaveClass(/mu-active/)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})

test('the heading copy icon copies its anchor without opening an image viewer while reading', async() => {
  const { app, page } = await launchWithMarkdown('# Reading heading\n\nParagraph\n')
  try {
    await toggleReadingMode(page, app)
    await page.locator('.mu-container h1').hover()
    await page.locator('.mu-copy-header-link img').click()
    await expect
      .poll(() => app.evaluate(({ clipboard }) => clipboard.readText()))
      .toBe('#reading-heading')
    await expect(page.locator('.image-viewer')).toBeHidden()
    await expect(page.locator('.mu-read-only')).toBeVisible()
    await expect(page.locator('.tabs-container li.unsaved')).toHaveCount(0)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})

test('a locked file retains rendering, refuses edits and saves, and follows external changes', async() => {
  const { app, page, filePath } = await launchWithMarkdown('**original** and $x^2$\n', {
    preferences: { autoSave: true, autoSaveDelay: 1000 }
  })
  try {
    const original = readFileSync(filePath)
    await toggleReadingMode(page, app)
    await expect(page.locator('.mu-read-only')).toBeVisible()
    await page.locator('.mu-math-render').click()
    await page.keyboard.type('unwanted')
    await page.keyboard.press('Backspace')
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await page.waitForTimeout(1200)
    expect(readFileSync(filePath).equals(original)).toBe(true)
    await expect(page.locator('.tabs-container li.unsaved')).toHaveCount(0)
    writeFileSync(filePath, '**external update**\n')
    await expect(page.locator('.editor-component')).toContainText('external update', {
      timeout: 8000
    })
    await expect(page.locator('.mu-read-only')).toBeVisible()
    await expect(page.locator('.tabs-container li.unsaved')).toHaveCount(0)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})

test('dirty buffers survive locking and other tabs stay editable', async() => {
  const { app, page, filePath } = await launchWithMarkdown('original\n')
  try {
    await typeIntoEditor(page, ' retained edit')
    await expect(page.locator('.tabs-container li.unsaved')).toHaveCount(1)
    await toggleReadingMode(page, app)
    await expect(page.locator('.mu-read-only')).toBeVisible()
    await expect(page.locator('.tabs-container li.unsaved')).toHaveCount(1)
    expect(readFileSync(filePath, 'utf8')).toBe('original\n')
    await sendIpcToRenderer(app, 'mt::set-view-layout', { showTabBar: true })
    const firstTab = page.locator('.tabs-container li').first()
    const firstId = await firstTab.getAttribute('data-id')
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'new tab\n')
    await expect(page.locator('.mu-read-only')).toHaveCount(0)
    await typeIntoEditor(page, ' editable')
    await expect(page.locator('.editor-component')).toContainText('editable')
    await page.locator(`.tabs-container li[data-id="${firstId}"]`).click()
    await expect(page.locator('.mu-read-only')).toBeVisible()
    await expect(page.locator('.editor-component')).toContainText('retained edit')
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})

test('unlocking default reading stays in live editing without changing the startup source preference', async() => {
  const { app, page } = await launchWithMarkdown('# default reading\n', {
    preferences: { defaultOpenMode: 'read', sourceCodeModeEnabled: true }
  })
  try {
    await expect(page.locator('.mu-read-only')).toBeVisible()
    await expect(page.locator('.CodeMirror')).toHaveCount(0)
    await toggleReadingMode(page, app)
    await expect(page.locator('.CodeMirror')).toHaveCount(0)
    await expect(page.locator('.mu-read-only')).toHaveCount(0)
    const userData = await app.evaluate(({ app }) => app.getPath('userData'))
    expect(JSON.parse(readFileSync(join(userData, 'preferences.json'), 'utf8')).sourceCodeModeEnabled).toBe(true)
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'new document\n')
    await expect(page.locator('.CodeMirror')).toHaveCount(0)
    await expect(page.locator('.mu-read-only')).toHaveCount(0)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})

test('entering reading exits source mode and returns to live editing with the source changes intact', async() => {
  const { app, page, filePath } = await launchWithMarkdown('original\n', {
    preferences: { sourceCodeModeEnabled: true }
  })
  try {
    await page.locator('.CodeMirror').click()
    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+End' : 'Control+End')
    await page.keyboard.type('source edit')
    await toggleReadingMode(page, app)
    await expect(page.locator('.mu-read-only')).toBeVisible()
    await expect(page.locator('.CodeMirror')).toHaveCount(0)
    await expect(page.locator('.editor-component')).toContainText('source edit')
    expect(readFileSync(filePath, 'utf8')).toBe('original\n')
    await toggleReadingMode(page, app)
    await expect(page.locator('.CodeMirror')).toHaveCount(0)
    await expect(page.locator('.mu-read-only')).toHaveCount(0)
    await expect(page.locator('.editor-component')).toContainText('source edit')
    await expect.poll(() => app.evaluate(({ Menu }) =>
      Menu.getApplicationMenu()?.getMenuItemById('sourceCodeModeMenuItem')?.checked
    )).toBe(false)
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
    await expect(page.locator('.editor-component')).not.toContainText('source edit')
    await typeIntoEditor(page, 'live edit')
    await expect(page.locator('.editor-component')).toContainText('live edit')
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})

test('following a local Markdown link opens its new tab in reading mode', async() => {
  const { app, page, filePath } = await launchWithMarkdown('[open next](./next.md)\n')
  try {
    writeFileSync(join(dirname(filePath), 'next.md'), '# next document\n')
    await toggleReadingMode(page, app)
    await expect(page.locator('.mu-read-only')).toBeVisible()
    await page.locator('.mu-link').click()
    await expect(page.locator('.editor-component')).toContainText('next document')
    await expect(page.locator('.mu-read-only')).toBeVisible()
    await expect(page.locator('.tabs-container li')).toHaveCount(2)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})

test('closing a locked dirty tab honors Cancel, then explicitly unlocks and saves', async() => {
  const { app, page, filePath } = await launchWithMarkdown('original\n')
  try {
    await sendIpcToRenderer(app, 'mt::set-view-layout', { showTabBar: true })
    await typeIntoEditor(page, ' retained edit')
    await toggleReadingMode(page, app)
    await expect(page.locator('.mu-read-only')).toBeVisible()
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async() => ({ response: 2, checkboxChecked: false })
    })
    await page.locator('.tabs-container li .close-icon').click()
    await expect(page.locator('.mu-read-only')).toBeVisible()
    expect(readFileSync(filePath, 'utf8')).toBe('original\n')
    await app.evaluate(({ dialog }) => {
      dialog.showMessageBox = async() => ({ response: 0, checkboxChecked: false })
    })
    await page.locator('.tabs-container li .close-icon').click()
    await expect(page.locator('.tabs-container li')).toHaveCount(0)
    expect(readFileSync(filePath, 'utf8')).toContain('retained edit')
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})

test('source tabs with identical content keep independent undo histories', async() => {
  const { app, page } = await launchWithMarkdown('original\n', {
    preferences: { sourceCodeModeEnabled: true }
  })
  const source = page.locator('.CodeMirror')
  try {
    await sendIpcToRenderer(app, 'mt::set-view-layout', { showTabBar: true })
    const firstTab = page.locator('.tabs-container li').first()
    const firstId = await firstTab.getAttribute('data-id')
    await source.evaluate((host: HTMLElement & { CodeMirror: CodeMirror.Editor }) => {
      host.CodeMirror.replaceRange(' edit', { line: 0, ch: 8 })
    })
    await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, 'original edit\n')
    await expect(page.locator('.tabs-container li')).toHaveCount(2)
    await source.evaluate((host: HTMLElement & { CodeMirror: CodeMirror.Editor }) =>
      host.CodeMirror.undo()
    )
    await expect
      .poll(() =>
        source.evaluate((host: HTMLElement & { CodeMirror: CodeMirror.Editor }) =>
          host.CodeMirror.getValue()
        )
      )
      .toBe('original edit\n')
    await page.locator(`.tabs-container li[data-id="${firstId}"]`).click()
    await source.evaluate((host: HTMLElement & { CodeMirror: CodeMirror.Editor }) =>
      host.CodeMirror.undo()
    )
    await expect
      .poll(() =>
        source.evaluate((host: HTMLElement & { CodeMirror: CodeMirror.Editor }) =>
          host.CodeMirror.getValue()
        )
      )
      .toBe('original\n')
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})

test('save as and save share lock protection and keep the saved destination in sync', async() => {
  const { app, page, filePath } = await launchWithMarkdown('original\n')
  const destination = join(dirname(filePath), 'saved-as.md')
  try {
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = async() => ({ canceled: false, filePath })
    }, destination)
    await toggleReadingMode(page, app)
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save-as')
    await page.waitForTimeout(200)
    expect(existsSync(destination)).toBe(false)
    await toggleReadingMode(page, app)
    await typeIntoEditor(page, ' edit')
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save-as')
    await expect
      .poll(() => (existsSync(destination) ? readFileSync(destination, 'utf8') : ''))
      .toContain('edit')
    await expect(page.locator('.tabs-container li.unsaved')).toHaveCount(0)
    await expect(page.locator('.tabs-container li')).toHaveAttribute('title', destination)
    await typeIntoEditor(page, ' more')
    await sendIpcToRenderer(app, 'mt::editor-ask-file-save')
    await expect.poll(() => readFileSync(destination, 'utf8')).toContain('more')
    expect(readFileSync(filePath, 'utf8')).toBe('original\n')
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
  }
})
