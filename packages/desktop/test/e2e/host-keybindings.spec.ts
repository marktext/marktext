import type { Muya } from '@muyajs/core'
import type Content from '@muyajs/core/block/base/content'
import type { ElectronApplication, Page } from 'playwright'
import { _electron } from 'playwright'
import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import {
  expectNoRendererErrors,
  getElectronPath,
  launchWithMarkdown,
  waitForEditor,
  waitForMenuReady
} from './helpers'

type ContentElement = HTMLElement & { __MUYA_BLOCK__: Content & { muya: Muya } }
const isMac = process.platform === 'darwin'
const primary = isMac ? 'Command' : 'Ctrl'
const label = (key: string) => (isMac ? `⇧⌘${key}` : `Ctrl+Shift+${key}`)

const markdown = (page: Page) =>
  page.evaluate(() => {
    const content = document.querySelector('.editor-component .mu-content') as ContentElement
    return content.__MUYA_BLOCK__.muya.getMarkdown()
  })

async function selectText(page: Page, text = 'audit') {
  await page.evaluate((value) => {
    const content = document.querySelector('.editor-component .mu-content') as ContentElement
    const muya = content.__MUYA_BLOCK__.muya
    muya.setContent(value)
    muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, value.length, true)
  }, text)
  await expect(page.locator('.mu-format-picker .item.strong')).toBeVisible()
}

async function saveBindings(page: Page, bindings: Record<string, string>) {
  expect(
    await page.evaluate(
      (values) =>
        window.electron.ipcRenderer.invoke(
          'mt::keybinding-save-user-keybindings',
          new Map(Object.entries(values))
        ),
      bindings
    )
  ).toBe(true)
}

// Exercises Electron's dispatcher; injected events do not test OS-reserved shortcuts.
async function press(app: ElectronApplication, page: Page, key: string, modifiers: string[]) {
  const win = await app.browserWindow(page)
  await win.evaluate(
    (window, chord) => {
      window.webContents.sendInputEvent({
        type: 'keyDown',
        keyCode: chord.key,
        modifiers: chord.modifiers
      })
      window.webContents.sendInputEvent({
        type: 'keyUp',
        keyCode: chord.key,
        modifiers: chord.modifiers
      })
    },
    { key, modifiers }
  )
}

test.describe('host-owned keybindings', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeEach(async() => {
    const launched = await launchWithMarkdown('audit\n', {
      suppressErrorDialog: true,
      preferences: { language: 'en' }
    })
    app = launched.app
    page = launched.page
  })

  test.afterEach(async() => {
    try {
      await expectNoRendererErrors(app)
    } finally {
      // Restarted instances bypass launchElectron's prompt-free cleanup wrapper.
      await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
      await app.close()
    }
  })

  test('rebinding and unbinding remove old shortcuts and native format mutations', async() => {
    await selectText(page)
    await saveBindings(page, { 'format.strong': `${primary}+Shift+B` })
    await expect(page.locator('.mu-format-picker .item.strong')).toHaveAttribute(
      'title',
      `Emphasize\n${label('B')}`
    )
    await press(app, page, 'B', [isMac ? 'meta' : 'control', 'shift'])
    await expect.poll(() => markdown(page)).toBe('**audit**\n')

    await selectText(page)
    await press(app, page, 'B', [isMac ? 'meta' : 'control'])
    await expect.poll(() => markdown(page)).toBe('audit\n')
    // CDP delivers the browser editing shortcut even when Electron's dispatcher is bypassed.
    await page.evaluate(() => {
      const root = document.querySelector<HTMLElement>('.editor-component')!
      root.addEventListener('beforeinput', (event) => {
        root.dataset.lastInput = `${(event as InputEvent).inputType}:${event.defaultPrevented}`
      })
    })
    await page.keyboard.press(`${isMac ? 'Meta' : 'Control'}+b`)
    await expect(page.locator('.editor-component')).toHaveAttribute(
      'data-last-input',
      'formatBold:true'
    )
    expect(await markdown(page)).toBe('audit\n')
    expect(
      await page
        .locator(
          '.editor-component b, .editor-component strong, .editor-component [style*="font-weight"]'
        )
        .count()
    ).toBe(0)

    await saveBindings(page, { 'format.strong': '' })
    await expect(page.locator('.mu-format-picker .item.strong')).toHaveAttribute(
      'title',
      'Emphasize'
    )
    await press(app, page, 'B', [isMac ? 'meta' : 'control', 'shift'])
    expect(await markdown(page)).toBe('audit\n')
    await page.locator('.mu-format-picker .item.strong').click()
    await expect.poll(() => markdown(page)).toBe('**audit**\n')
  })

  test('inline code has one command binding and front-menu hints refresh while open', async() => {
    test.skip(!isMac, 'The reported hidden inline-code alias is macOS-specific')
    await selectText(page)
    await expect(page.locator('.mu-format-picker .item.inline_code')).toHaveAttribute(
      'title',
      'Inline Code\n⌃⌘C'
    )
    await press(app, page, 'E', ['control', 'meta'])
    expect(await markdown(page)).toBe('audit\n')
    await press(app, page, 'C', ['control', 'meta'])
    await expect.poll(() => markdown(page)).toBe('`audit`\n')

    await selectText(page)
    await press(app, page, 'E', ['meta', 'shift'])
    await expect.poll(() => markdown(page)).toBe('audit\n\naudit\n')
    await press(app, page, 'Z', ['meta'])
    await expect.poll(() => markdown(page)).toBe('audit\n')

    await selectText(page)
    await page.locator('.mu-paragraph-content').first().hover()
    await page.locator('.mu-front-button').click()
    const hint = page.locator('.mu-front-menu .duplicate .short-cut')
    await expect(hint).toHaveText('⇧⌘E')
    await saveBindings(page, { 'edit.duplicate': 'Command+Shift+F12' })
    await expect(hint).toHaveText('⇧⌘F12')
    await saveBindings(page, { 'edit.duplicate': '' })
    await expect(hint).toHaveCount(0)
    await page.locator('.mu-front-menu .duplicate').click()
    await expect.poll(() => markdown(page)).toBe('audit\n\naudit\n')
  })

  test('slash navigation and clicks survive command-shortcut suppression', async() => {
    await page.evaluate(() => {
      const content = document.querySelector('.editor-component .mu-content') as ContentElement
      const muya = content.__MUYA_BLOCK__.muya
      muya.setContent('')
      muya.editor.scrollPage!.firstContentInDescendant()!.setCursor(0, 0, true)
    })
    await page.keyboard.type('/')
    const quick = page.locator('.mu-quick-insert')
    await expect(quick).toBeVisible()
    const table = quick.locator('[data-label="table"]')
    await saveBindings(page, { 'paragraph.table': `${primary}+Shift+F12` })
    await expect(table.locator('.short-cut')).toHaveText(label('F12'))
    const before = await quick.locator('.item.active').getAttribute('data-label')
    await page.keyboard.press('ArrowDown')
    expect(await quick.locator('.item.active').getAttribute('data-label')).not.toBe(before)
    await saveBindings(page, { 'paragraph.table': '' })
    await expect(table.locator('.short-cut')).toHaveCount(0)
    await quick.locator('[data-label="atx-heading 2"]').click()
    await expect.poll(() => markdown(page)).toBe('## \n')
  })

  test('saved custom bindings persist across restart and reach another editor window', async() => {
    const bindings = { 'format.strong': `${primary}+Shift+7`, 'format.inline-code': '' }
    await saveBindings(page, bindings)
    const profile = await app.evaluate(({ app }) => app.getPath('userData'))
    expect(JSON.parse(readFileSync(join(profile, 'keybindings.json'), 'utf8'))).toEqual(bindings)
    await app.close()
    app = await _electron.launch({
      executablePath: getElectronPath(),
      cwd: resolve(__dirname, '../..'),
      args: [resolve(__dirname, '../..'), '--user-data-dir', profile],
      env: { ...process.env, MARKTEXT_ERROR_INTERACTION: '1' }
    })
    page = await app.firstWindow()
    await waitForEditor(page)
    await waitForMenuReady(app)
    await selectText(page)
    await expect(page.locator('.mu-format-picker .item.strong')).toHaveAttribute(
      'title',
      `Emphasize\n${label('7')}`
    )
    await expect(page.locator('.mu-format-picker .item.inline_code')).toHaveAttribute(
      'title',
      'Inline Code'
    )
    await press(app, page, '7', [isMac ? 'meta' : 'control', 'shift'])
    await expect.poll(() => markdown(page)).toBe('**audit**\n')

    const nextWindow = app.waitForEvent('window')
    await app.evaluate(({ Menu }) => {
      const item = Menu.getApplicationMenu()!
        .items.flatMap((entry) => entry.submenu?.items ?? [])
        .find((entry) => entry.label === 'New Window')
      if (!item) throw new Error('New Window menu item is missing')
      item.click()
    })
    const second = await nextWindow
    await waitForEditor(second)
    await selectText(second)
    await expect(second.locator('.mu-format-picker .item.strong')).toHaveAttribute(
      'title',
      `Emphasize\n${label('7')}`
    )
    await saveBindings(second, { 'format.strong': `${primary}+Shift+B` })
    await expect(second.locator('.mu-format-picker .item.strong')).toHaveAttribute(
      'title',
      `Emphasize\n${label('B')}`
    )
    await expect(page.locator('.mu-format-picker .item.strong')).toHaveAttribute(
      'title',
      `Emphasize\n${label('B')}`
    )
  })

  test('Preferences autosaves shifted digits, unbinding and restoring defaults', async() => {
    await selectText(page)
    const settingsWindow = app.waitForEvent('window')
    await app.evaluate(({ ipcMain }) => ipcMain.emit('app-create-settings-window', 'keybindings'))
    const settings = await settingsWindow
    await settings.getByText('Keybindings', { exact: true }).click()
    await expect(settings.locator('.pref-keybindings .footer').getByRole('button', {
      name: 'Save', exact: true
    })).toHaveCount(0)
    const bold = settings
      .locator('.el-table__row')
      .filter({ has: settings.getByText('Bold', { exact: true }) })
    await bold.getByRole('button', { name: 'Edit', exact: true }).click()
    const recorder = settings.locator('.input-textbox')
    await expect(recorder).toBeFocused()
    await recorder.press(`${isMac ? 'Meta' : 'Control'}+Shift+7`)
    const recorded = `${isMac ? 'shift+cmd' : 'ctrl+shift'}+7`
    await expect(recorder).toHaveValue(recorded)
    await recorder.press('Enter')
    await expect(bold).toContainText(recorded)
    await expect(page.locator('.mu-format-picker .item.strong')).toHaveAttribute(
      'title',
      `Emphasize\n${label('7')}`
    )
    const stored = await app.evaluate(({ app }) => app.getPath('userData'))
    expect(
      JSON.parse(readFileSync(join(stored, 'keybindings.json'), 'utf8'))['format.strong']
    ).toBe(recorded)

    await bold.getByRole('button', { name: 'Unbind', exact: true }).click()
    await expect(page.locator('.mu-format-picker .item.strong')).toHaveAttribute(
      'title',
      'Emphasize'
    )
    await bold.getByRole('button', { name: 'Reset', exact: true }).click()
    await expect(page.locator('.mu-format-picker .item.strong')).toHaveAttribute(
      'title',
      `Emphasize\n${isMac ? '⌘B' : 'Ctrl+B'}`
    )
    expect(JSON.parse(readFileSync(join(stored, 'keybindings.json'), 'utf8'))).toEqual({})
  })

  test('Preferences rejects a shifted chord equivalent to a literal-symbol binding', async() => {
    await saveBindings(page, { 'format.emphasis': `${primary}+Plus` })
    const settingsWindow = app.waitForEvent('window')
    await app.evaluate(({ ipcMain }) => ipcMain.emit('app-create-settings-window'))
    const settings = await settingsWindow
    await settings.getByText('Keybindings', { exact: true }).click()
    const bold = settings.locator('.el-table__row').filter({
      has: settings.getByText('Bold', { exact: true })
    })
    await bold.getByRole('button', { name: 'Edit', exact: true }).click()
    const recorder = settings.locator('.input-textbox')
    await expect(recorder).toBeFocused()
    await recorder.press(`${isMac ? 'Meta' : 'Control'}+Shift+Equal`)
    await recorder.press('Enter')
    await expect(settings.getByText('Shortcut in use', { exact: true })).toBeVisible()
    await expect(bold).toContainText(`${primary}+B`)
  })
})
