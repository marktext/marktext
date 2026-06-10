import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  clearRendererErrors,
  enterSourceMode,
  expectNoRendererErrors,
  launchWithMarkdown,
  sendIpcToRenderer
} from './helpers'

interface SourcePosition {
  line: number
  ch: number
}

interface SourceSelection {
  anchor: SourcePosition
  head: SourcePosition
}

const getSourceValue = async(page: Page): Promise<string> => {
  return await page.evaluate(() => {
    const cm = document.querySelector('.source-code .CodeMirror') as
      | (Element & { CodeMirror?: { getValue(): string } })
      | null
    return cm?.CodeMirror?.getValue() ?? ''
  })
}

const getSourceSelectionText = async(page: Page): Promise<string> => {
  return await page.evaluate(() => {
    const cm = document.querySelector('.source-code .CodeMirror') as
      | (Element & { CodeMirror?: { getSelection(): string } })
      | null
    return cm?.CodeMirror?.getSelection() ?? ''
  })
}

const getVisibleDialogCount = async(page: Page): Promise<number> => {
  return await page.evaluate(() => {
    return Array.from(document.querySelectorAll('.el-dialog')).filter((dialog) => {
      const element = dialog as HTMLElement
      const style = window.getComputedStyle(element)
      const rect = element.getBoundingClientRect()
      return style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        rect.width > 0 &&
        rect.height > 0
    }).length
  })
}

const setSourceValue = async(
  page: Page,
  value: string,
  selection: SourceSelection = {
    anchor: { line: 0, ch: 0 },
    head: { line: 0, ch: 0 }
  }
): Promise<void> => {
  await page.evaluate(
    ({ value, selection }) => {
      const cm = document.querySelector('.source-code .CodeMirror') as
        | (Element & {
          CodeMirror?: {
            focus(): void
            refresh(): void
            setSelection(anchor: SourcePosition, head: SourcePosition): void
            setValue(value: string): void
            clearHistory(): void
          }
        })
        | null
      if (!cm?.CodeMirror) return
      cm.CodeMirror.setValue(value)
      cm.CodeMirror.clearHistory()
      cm.CodeMirror.refresh()
      cm.CodeMirror.setSelection(selection.anchor, selection.head)
      cm.CodeMirror.focus()
    },
    { value, selection }
  )
}

const clickToolbarButton = async(page: Page, name: string): Promise<void> => {
  await page.getByRole('button', { name, exact: true }).click()
}

const clickTitleOption = async(page: Page, name: string): Promise<void> => {
  await page.locator('.toolbar-menu.menu-title summary').click()
  await page.getByRole('button', { name, exact: true }).click()
}

const clickListOption = async(page: Page, name: string): Promise<void> => {
  await page.locator('.toolbar-menu.menu-list summary').click()
  await page.getByRole('button', { name, exact: true }).click()
}

const waitForSourceValue = async(page: Page, expected: string): Promise<void> => {
  await expect.poll(() => getSourceValue(page)).toBe(expected)
}

const typeInSource = async(page: Page, text: string): Promise<void> => {
  await page.waitForTimeout(75)
  await page.keyboard.type(text, { delay: 10 })
}

const undoShortcut = process.platform === 'darwin' ? 'Meta+Z' : 'Control+Z'
const redoShortcut = process.platform === 'darwin' ? 'Meta+Shift+Z' : 'Control+Shift+Z'

const clickSourcePosition = async(
  page: Page,
  position: SourcePosition,
  waitBeforeClick = 150
): Promise<void> => {
  if (waitBeforeClick > 0) {
    await page.waitForTimeout(waitBeforeClick)
  }
  const point = await page.evaluate((position) => {
    const cm = document.querySelector('.source-code .CodeMirror') as
      | (Element & {
        CodeMirror?: {
          charCoords(
            position: SourcePosition,
            mode: 'window'
          ): { left: number; right: number; top: number; bottom: number }
          refresh(): void
        }
      })
      | null
    if (!cm?.CodeMirror) return null
    cm.CodeMirror.refresh()
    const coords = cm.CodeMirror.charCoords(position, 'window')
    return {
      x: Math.round((coords.left + coords.right) / 2),
      y: Math.round((coords.top + coords.bottom) / 2)
    }
  }, position)

  if (!point) throw new Error('Unable to resolve CodeMirror click position')
  await page.mouse.click(point.x, point.y)
}

test.describe('Source mode formatting toolbar', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('seed\n', { suppressErrorDialog: true })
    app = launched.app
    page = launched.page
    await enterSourceMode(page, app)
    await sendIpcToRenderer(app, 'mt::user-preference', { showFormattingToolbar: true })
    await page.waitForSelector('.formatting-toolbar', { state: 'attached', timeout: 10000 })
    await expect(page.getByRole('button', { name: 'Bold', exact: true })).toBeEnabled()
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test.beforeEach(async() => {
    await clearRendererErrors(app)
  })

  test('inline format buttons keep CodeMirror editable', async() => {
    const cases = [
      { button: 'Bold', expected: '**typed**' },
      { button: 'Italic', expected: '*typed*' },
      { button: 'Strikethrough', expected: '~~typed~~' }
    ]

    for (const item of cases) {
      await setSourceValue(page, 'word', {
        anchor: { line: 0, ch: 0 },
        head: { line: 0, ch: 4 }
      })
      await clickToolbarButton(page, item.button)
      await typeInSource(page, 'typed')
      await waitForSourceValue(page, item.expected)
      await expectNoRendererErrors(app)
      await clearRendererErrors(app)
    }
  })

  test('link and image insert markdown placeholders without opening dialogs', async() => {
    await setSourceValue(page, '')
    await clickToolbarButton(page, 'Link')
    await expect.poll(() => getVisibleDialogCount(page)).toBe(0)
    await expect.poll(() => getSourceSelectionText(page)).toBe('text')
    await typeInSource(page, 'label')
    await waitForSourceValue(page, '[label](url)')

    await setSourceValue(page, '')
    await clickToolbarButton(page, 'Image')
    await expect.poll(() => getVisibleDialogCount(page)).toBe(0)
    await expect.poll(() => getSourceSelectionText(page)).toBe('alt')
    await typeInSource(page, 'logo')
    await waitForSourceValue(page, '![logo](path)')
    await expectNoRendererErrors(app)
  })

  test('quote and list placeholders select only editable text', async() => {
    await setSourceValue(page, '')
    await clickToolbarButton(page, 'Quote')
    await expect.poll(() => getSourceSelectionText(page)).toBe('quote')
    await typeInSource(page, 'citation')
    await waitForSourceValue(page, '> citation')

    await setSourceValue(page, '')
    await clickListOption(page, 'Unordered List')
    await expect.poll(() => getSourceSelectionText(page)).toBe('list item')
    await typeInSource(page, 'first')
    await waitForSourceValue(page, '- first')

    await setSourceValue(page, '')
    await clickListOption(page, 'Ordered List')
    await expect.poll(() => getSourceSelectionText(page)).toBe('list item')
    await typeInSource(page, 'first')
    await waitForSourceValue(page, '1. first')

    await setSourceValue(page, '')
    await clickListOption(page, 'Task List')
    await expect.poll(() => getSourceSelectionText(page)).toBe('list item')
    await typeInSource(page, 'first')
    await waitForSourceValue(page, '- [ ] first')
    await expectNoRendererErrors(app)
  })

  test('heading menu exposes levels 4 to 6 in source mode', async() => {
    const cases = [
      { item: 'Heading 4', expected: '#### Heading' },
      { item: 'Heading 5', expected: '##### Heading' },
      { item: 'Heading 6', expected: '###### Heading' }
    ]

    for (const item of cases) {
      await setSourceValue(page, '')
      await clickTitleOption(page, item.item)
      await waitForSourceValue(page, item.expected)
      await clearRendererErrors(app)
    }
    await expectNoRendererErrors(app)
  })

  test('front matter inserts at document start with a blank line after it', async() => {
    await setSourceValue(page, '# Title\n\nBody', {
      anchor: { line: 2, ch: 4 },
      head: { line: 2, ch: 4 }
    })
    await clickToolbarButton(page, 'Front Matter')
    await waitForSourceValue(page, '---\ntitle: \n---\n\n# Title\n\nBody')
    await expectNoRendererErrors(app)
  })

  test('undo and redo work through keyboard, menu commands, and toolbar buttons', async() => {
    await setSourceValue(page, '')
    await typeInSource(page, 'abc')
    await waitForSourceValue(page, 'abc')

    await page.keyboard.press(undoShortcut)
    await waitForSourceValue(page, '')
    await page.keyboard.press(redoShortcut)
    await waitForSourceValue(page, 'abc')

    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'undo')
    await waitForSourceValue(page, '')
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'redo')
    await waitForSourceValue(page, 'abc')

    await sendIpcToRenderer(app, 'mt::execute-command-by-id', 'edit.undo')
    await waitForSourceValue(page, '')
    await sendIpcToRenderer(app, 'mt::execute-command-by-id', 'edit.redo')
    await waitForSourceValue(page, 'abc')

    await clickToolbarButton(page, 'Undo')
    await waitForSourceValue(page, '')
    await clickToolbarButton(page, 'Redo')
    await waitForSourceValue(page, 'abc')

    await setSourceValue(page, 'baseline\n')
    await page.keyboard.press(undoShortcut)
    await waitForSourceValue(page, 'baseline\n')
    await expectNoRendererErrors(app)
  })

  test('inserted table remains editable after direct clicks', async() => {
    const tableMarkdown = '| Column 1 | Column 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n'

    await setSourceValue(page, '')
    await clickToolbarButton(page, 'Table')
    await expect.poll(() => getSourceSelectionText(page)).toBe('Column 1')
    await waitForSourceValue(page, tableMarkdown)

    await clickToolbarButton(page, 'Undo')
    await waitForSourceValue(page, '')
    await clickToolbarButton(page, 'Redo')
    await waitForSourceValue(page, tableMarkdown)

    await setSourceValue(page, '')
    await clickToolbarButton(page, 'Table')
    await expect.poll(() => getSourceSelectionText(page)).toBe('Column 1')
    await typeInSource(page, 'Name')
    await waitForSourceValue(page, '| Name | Column 2 |\n| --- | --- |\n| Cell 1 | Cell 2 |\n')

    await clickSourcePosition(page, { line: 2, ch: 2 })
    await typeInSource(page, 'X')
    await waitForSourceValue(page, '| Name | Column 2 |\n| --- | --- |\n| CXell 1 | Cell 2 |\n')

    await setSourceValue(page, 'before\nbelow\n', {
      anchor: { line: 0, ch: 6 },
      head: { line: 0, ch: 6 }
    })
    await clickToolbarButton(page, 'Table')
    await clickSourcePosition(page, { line: 4, ch: 2 }, 0)
    await typeInSource(page, 'Y')
    await waitForSourceValue(page, 'before\n\n| Column 1 | Column 2 |\n| --- | --- |\n| CYell 1 | Cell 2 |\n\nbelow\n')

    await clickSourcePosition(page, { line: 2, ch: 13 }, 0)
    await typeInSource(page, 'Z')
    await waitForSourceValue(page, 'before\n\n| Column 1 | ZColumn 2 |\n| --- | --- |\n| CYell 1 | Cell 2 |\n\nbelow\n')

    await setSourceValue(page, 'before\nbelow\n', {
      anchor: { line: 0, ch: 6 },
      head: { line: 0, ch: 6 }
    })
    await clickToolbarButton(page, 'Table')
    await page.keyboard.press(undoShortcut)
    await waitForSourceValue(page, 'before\nbelow\n')
    await page.keyboard.press(undoShortcut)
    await waitForSourceValue(page, 'before\nbelow\n')
    await expectNoRendererErrors(app)
  })
})
