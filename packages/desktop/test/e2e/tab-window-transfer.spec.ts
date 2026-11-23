import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import {
  launchWithMarkdown,
  getMarkdownContent,
  enterSourceMode,
  typeIntoEditor,
  clickMenuById,
  waitForEditor
} from './helpers'

const readMarkdown = async(page: Page, app: ElectronApplication): Promise<string> => {
  const native = await app.browserWindow(page)
  await native.evaluate((window) => window.focus())
  return getMarkdownContent(page, app)
}

const required = <T>(value: T | null | undefined): T => {
  if (value === null || value === undefined) throw new Error('Expected test value to exist')
  return value
}

const tabs = (page: Page) => page.locator('.tabs-container > li[data-id]')

const secondWindow = async(app: ElectronApplication, source: Page): Promise<Page> => {
  await app.evaluate(({ ipcMain }) => ipcMain.emit('app-create-editor-window'))
  await expect.poll(() => app.windows().filter((page) => page !== source).length).toBe(1)
  const destination = required(app.windows().find((page) => page !== source))
  await waitForEditor(destination)
  await app.evaluate(({ BrowserWindow }) => {
    const windows = BrowserWindow.getAllWindows()
    windows[0].setBounds({ x: 0, y: 0, width: 600, height: 700 })
    windows[1].setBounds({ x: 650, y: 0, width: 600, height: 700 })
  })
  return destination
}

// The protocol uses the OS cursor, which CDP mouse events do not move.
const dropAt = async(
  app: ElectronApplication,
  source: Page,
  id: string,
  point: { x: number; y: number },
  cancel = false
): Promise<void> => {
  await app.evaluate(({ screen }, point) => {
    screen.getCursorScreenPoint = () => point
  }, point)
  const accepted = await source.evaluate(
    (id) => window.electron.ipcRenderer.invoke('mt::tabs::begin-drag', id),
    id
  )
  expect(accepted).toBe(true)
  await source.evaluate(
    (cancel) => window.electron.ipcRenderer.invoke('mt::tabs::finish-drag', cancel),
    cancel
  )
}

const tabPoint = async(
  app: ElectronApplication,
  page: Page,
  before = true
): Promise<{ x: number; y: number }> => {
  const box = await page.locator('.editor-tabs').boundingBox()
  if (!box) throw new Error('Missing tab strip')
  const native = await app.browserWindow(page)
  const bounds = await native.evaluate((window) => window.getContentBounds())
  return {
    x: bounds.x + box.x + (before ? 5 : box.width - 5),
    y: bounds.y + box.y + box.height / 2
  }
}

test('moves an unsaved document between windows and leaves a blank source tab', async() => {
  const { app, page } = await launchWithMarkdown('original\n')
  try {
    await typeIntoEditor(page, 'changed ')
    const expected = await readMarkdown(page, app)
    const id = await tabs(page).first().getAttribute('data-id')
    const destination = await secondWindow(app, page)
    await dropAt(app, page, required(id), await tabPoint(app, destination))
    await expect(tabs(destination)).toHaveCount(2)
    await expect(tabs(destination).first()).toHaveAttribute('data-id', required(id))
    await expect(tabs(destination).first()).toHaveClass(/unsaved/)
    expect((await readMarkdown(destination, app)).trimEnd()).toBe(expected.trimEnd())
    await expect(tabs(page)).toHaveCount(1)
    await expect(tabs(page).first()).not.toHaveAttribute('data-id', required(id))
    await expect(tabs(page).first()).toHaveAttribute('title', '')
  } finally {
    await app.close()
  }
})

test('detaches a source-mode tab into a window with the same mode and source undo history', async() => {
  const { app, page } = await launchWithMarkdown('original\n')
  try {
    await enterSourceMode(page, app)
    await page.locator('.CodeMirror').click()
    await page.keyboard.press('ControlOrMeta+End')
    await page.keyboard.type('new text')
    const id = await tabs(page).first().getAttribute('data-id')
    await dropAt(app, page, required(id), { x: -50, y: -50 })
    await expect.poll(() => app.windows().length).toBe(2)
    const destination = required(app.windows().find((window) => window !== page))
    await expect(destination.locator('.source-code')).toBeVisible()
    expect(await readMarkdown(destination, app)).toContain('new text')
    await destination.locator('.CodeMirror').click()
    await destination.keyboard.press('ControlOrMeta+z')
    expect(await readMarkdown(destination, app)).not.toContain('new text')
    await destination.keyboard.press('ControlOrMeta+Shift+z')
    expect(await readMarkdown(destination, app)).toContain('new text')
  } finally {
    await app.close()
  }
})

for (const overDestination of [false, true]) {
  test(`detaches a tab over the ${overDestination ? 'destination' : 'source'} editor body`, async() => {
    const { app, page } = await launchWithMarkdown('body drop\n')
    try {
      const id = required(await tabs(page).first().getAttribute('data-id'))
      const destination = overDestination ? await secondWindow(app, page) : page
      const windowCount = app.windows().length
      const native = await app.browserWindow(destination)
      const bounds = await native.evaluate((window) => window.getContentBounds())
      await dropAt(app, page, id, {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2
      })
      await expect.poll(() => app.windows().length).toBe(windowCount + 1)
      const detached = required(
        app.windows().find((window) => window !== page && window !== destination)
      )
      await expect(tabs(detached)).toHaveCount(1)
      await expect(tabs(detached).first()).toHaveAttribute('data-id', id)
      expect(await readMarkdown(detached, app)).toBe('body drop\n')
      await expect(tabs(page).first()).not.toHaveAttribute('data-id', id)
      if (overDestination) await expect(tabs(destination)).toHaveCount(1)
    } finally {
      await app.close()
    }
  })
}

test('blocks same-path duplicates and keeps both dirty versions', async() => {
  const { app, page, filePath } = await launchWithMarkdown('original\n')
  try {
    await typeIntoEditor(page, 'source ')
    const id = await tabs(page).first().getAttribute('data-id')
    const destination = await secondWindow(app, page)
    const native = await app.browserWindow(destination)
    const windowId = await native.evaluate((window) => window.id)
    await destination.evaluate(
      ({ filePath, windowId }) =>
        window.electron.ipcRenderer.send('mt::open-file-by-window-id', windowId, filePath),
      { filePath, windowId }
    )
    await expect(tabs(destination).filter({ hasText: 'note.md' })).toHaveCount(1)
    const destinationCount = await tabs(destination).count()
    await typeIntoEditor(destination, 'destination ')
    const beforeSource = await readMarkdown(page, app)
    const beforeTarget = await readMarkdown(destination, app)
    await dropAt(app, page, required(id), await tabPoint(app, destination))
    await expect(
      page
        .getByRole('alert')
        .filter({ hasText: /This file is already open|目标窗口已打开|目標視窗已開啟/ })
    ).toBeVisible()
    expect(await readMarkdown(page, app)).toBe(beforeSource)
    expect(await readMarkdown(destination, app)).toBe(beforeTarget)
    await expect(tabs(page)).toHaveCount(1)
    await expect(tabs(destination)).toHaveCount(destinationCount)
  } finally {
    await app.close()
  }
})

test('canceling a drag leaves the source document and window intact', async() => {
  const { app, page } = await launchWithMarkdown('kept\n')
  try {
    const id = await tabs(page).first().getAttribute('data-id')
    await dropAt(app, page, required(id), { x: -50, y: -50 }, true)
    expect(app.windows()).toHaveLength(1)
    await expect(tabs(page).first()).toHaveAttribute('data-id', required(id))
    expect(await readMarkdown(page, app)).toBe('kept\n')
  } finally {
    await app.close()
  }
})

for (const sourceMode of [true, false]) {
  test(`preserves undo and redo when moving from ${sourceMode ? 'source' : 'rendered'} into the other mode`, async() => {
    const { app, page } = await launchWithMarkdown('original\n')
    try {
      if (sourceMode) {
        await enterSourceMode(page, app)
        await page.locator('.CodeMirror').click()
        await page.keyboard.press('ControlOrMeta+End')
        await page.keyboard.type(' new edit')
      } else await typeIntoEditor(page, 'new edit ')
      const expected = await readMarkdown(page, app)
      const id = await tabs(page).first().getAttribute('data-id')
      const destination = await secondWindow(app, page)
      if (!sourceMode) await enterSourceMode(destination, app)
      await dropAt(app, page, required(id), await tabPoint(app, destination))
      await expect(tabs(destination)).toHaveCount(2)
      await expect(destination.locator('.source-code')).toHaveCount(sourceMode ? 0 : 1)
      expect((await readMarkdown(destination, app)).trimEnd()).toBe(expected.trimEnd())
      if (sourceMode) await destination.locator('.mu-editor').click()
      else await destination.locator('.CodeMirror').click()
      let undoCount = 0
      let undone = expected
      for (let i = 0; i < 5; i++) {
        const native = await app.browserWindow(destination)
        await native.evaluate((window) => window.webContents.send('mt::editor-edit-action', 'undo'))
        undoCount++
        undone = await readMarkdown(destination, app)
        if (undone.trimEnd() !== expected.trimEnd()) break
      }
      expect(undone.trimEnd()).not.toBe(expected.trimEnd())
      for (let i = 0; i < undoCount; i++) {
        const native = await app.browserWindow(destination)
        await native.evaluate((window) => window.webContents.send('mt::editor-edit-action', 'redo'))
      }
      expect((await readMarkdown(destination, app)).trimEnd()).toBe(expected.trimEnd())
    } finally {
      await app.close()
    }
  })
}

test('keeps the source document if the destination closes during preparation', async() => {
  const { app, page } = await launchWithMarkdown('survives\n')
  try {
    await typeIntoEditor(page, 'unsaved ')
    const expected = await readMarkdown(page, app)
    const id = await tabs(page).first().getAttribute('data-id')
    const destination = await secondWindow(app, page)
    const point = await tabPoint(app, destination)
    const native = await app.browserWindow(destination)
    const targetId = await native.evaluate((window) => window.webContents.id)
    await app.evaluate(({ ipcMain, BrowserWindow }, targetId) => {
      const listener = (event: Electron.IpcMainEvent): void => {
        if (event.sender.id !== targetId) return
        ipcMain.removeListener('mt::tabs::reply', listener)
        BrowserWindow.fromWebContents(event.sender)?.destroy()
      }
      ipcMain.on('mt::tabs::reply', listener)
    }, targetId)
    await dropAt(app, page, required(id), point)
    await expect(tabs(page).first()).toHaveAttribute('data-id', required(id))
    expect(await readMarkdown(page, app)).toBe(expected)
    expect(await page.evaluate(() => document.documentElement.inert)).toBe(false)
  } finally {
    await app.close()
  }
})

test('preserves an untitled document origin across workspaces and uses it in Save As', async() => {
  const { app, page, filePath } = await launchWithMarkdown('origin\n')
  try {
    const origin = await page.evaluate((path) => window.path.dirname(path), filePath)
    const native = await app.browserWindow(page)
    const sourceWindowId = await native.evaluate((window) => window.id)
    await app.evaluate(
      ({ ipcMain }, { sourceWindowId, origin }) =>
        ipcMain.emit('app-open-directory-by-id', sourceWindowId, origin, true),
      { sourceWindowId, origin }
    )
    await expect(page.locator('.side-bar')).toBeVisible()
    await page.locator('.editor-tabs .new-file').click({ force: true })
    await expect(tabs(page)).toHaveCount(2)
    await typeIntoEditor(page, 'untitled draft')
    const id = await tabs(page).last().getAttribute('data-id')
    const destination = await secondWindow(app, page)
    await dropAt(app, page, required(id), await tabPoint(app, destination))
    expect(await destination.evaluate(() => window.DIRNAME)).toBe(origin)
    await app.evaluate(({ dialog }) => {
      dialog.showSaveDialog = async(
        windowOrOptions: Electron.BaseWindow | Electron.SaveDialogOptions,
        options?: Electron.SaveDialogOptions
      ) => {
        const choice = options ?? (windowOrOptions as Electron.SaveDialogOptions)
        ;(globalThis as typeof globalThis & { transferSavePath?: string }).transferSavePath =
          choice.defaultPath
        return { canceled: true, filePath: '' }
      }
    })
    await clickMenuById(app, 'fileSaveAsMenuItem')
    await expect
      .poll(() =>
        app.evaluate(
          () => (globalThis as typeof globalThis & { transferSavePath?: string }).transferSavePath
        )
      )
      .toContain(origin)
  } finally {
    await app.close()
  }
})

const nativePointer = async(
  commands: Array<{ x: number; y: number; button?: 'down' | 'up' }>
): Promise<void> => {
  const { execFile } = await import('node:child_process')
  const { promisify } = await import('node:util')
  await promisify(execFile)(
    'python3',
    [
      '-c',
      `
import ctypes, ctypes.util, json, sys, time
x11 = ctypes.CDLL(ctypes.util.find_library('X11'))
xtst = ctypes.CDLL(ctypes.util.find_library('Xtst'))
x11.XOpenDisplay.restype = ctypes.c_void_p
x11.XOpenDisplay.argtypes = [ctypes.c_char_p]
x11.XSync.argtypes = [ctypes.c_void_p, ctypes.c_int]
x11.XCloseDisplay.argtypes = [ctypes.c_void_p]
xtst.XTestFakeMotionEvent.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.c_int, ctypes.c_int, ctypes.c_ulong]
xtst.XTestFakeButtonEvent.argtypes = [ctypes.c_void_p, ctypes.c_uint, ctypes.c_int, ctypes.c_ulong]
display = x11.XOpenDisplay(None)
if not display: raise RuntimeError('X11 display unavailable')
try:
    for command in json.loads(sys.argv[1]):
        xtst.XTestFakeMotionEvent(display, -1, round(command['x']), round(command['y']), 0)
        if command.get('button'): xtst.XTestFakeButtonEvent(display, 1, int(command['button'] == 'down'), 0)
        x11.XSync(display, 0)
        time.sleep(0.03)
finally:
    x11.XCloseDisplay(display)
`,
      JSON.stringify(commands)
    ],
    { timeout: 10000 }
  )
}

test('native pointer capture moves a tab across real window boundaries', async() => {
  test.skip(
    process.platform !== 'linux',
    'Native input driver uses X11; protocol tests are platform independent.'
  )
  const { app, page } = await launchWithMarkdown('native drag\n')
  try {
    const id = await tabs(page).first().getAttribute('data-id')
    const destination = await secondWindow(app, page)
    const sourceNative = await app.browserWindow(page)
    await sourceNative.evaluate((window) => window.focus())
    const bounds = await sourceNative.evaluate((window) => window.getContentBounds())
    const tab = await tabs(page).first().boundingBox()
    if (!tab) throw new Error('Source tab missing')
    const from = { x: bounds.x + tab.x + tab.width / 2, y: bounds.y + tab.y + tab.height / 2 }
    const to = await tabPoint(app, destination)
    const commands: Array<{ x: number; y: number; button?: 'down' | 'up' }> = [
      { ...from, button: 'down' }
    ]
    for (let step = 1; step <= 20; step++)
      commands.push({
        x: from.x + ((to.x - from.x) * step) / 20,
        y: from.y + ((to.y - from.y) * step) / 20
      })
    commands.push({ ...to, button: 'up' })
    await nativePointer(commands)
    await expect(tabs(destination).first()).toHaveAttribute('data-id', required(id))
    await expect(tabs(page)).toHaveCount(1)
    await expect(tabs(page).first()).not.toHaveAttribute('data-id', required(id))
  } finally {
    await app.close()
  }
})

test('Escape during a captured pointer drag cancels detachment', async() => {
  test.skip(
    process.platform !== 'linux',
    'Native input driver uses X11; protocol tests are platform independent.'
  )
  const { app, page } = await launchWithMarkdown('cancel drag\n')
  try {
    const id = await tabs(page).first().getAttribute('data-id')
    const native = await app.browserWindow(page)
    await native.evaluate((window) => {
      window.setBounds({ x: 0, y: 0, width: 600, height: 700 })
      window.focus()
    })
    const bounds = await native.evaluate((window) => window.getContentBounds())
    const tab = await tabs(page).first().boundingBox()
    if (!tab) throw new Error('Source tab missing')
    const from = { x: bounds.x + tab.x + tab.width / 2, y: bounds.y + tab.y + tab.height / 2 }
    await nativePointer([
      { ...from, button: 'down' },
      { x: from.x + 30, y: from.y },
      { x: 1000, y: 800 }
    ])
    await expect(page.locator('.tab-transfer-ghost')).toHaveCount(1)
    await page.keyboard.press('Escape')
    await expect(page.locator('.tab-transfer-ghost')).toHaveCount(0)
    await nativePointer([{ x: 1000, y: 800, button: 'up' }])
    await expect(tabs(page).first()).toHaveAttribute('data-id', required(id))
    expect(app.windows()).toHaveLength(1)
  } finally {
    await app.close()
  }
})

type TransferPopupItem = { id?: string; enabled?: boolean; submenu?: TransferPopupItem[] }

const transferMenu = async(
  app: ElectronApplication,
  page: Page,
  action: string,
  keyboard = false
): Promise<void> => {
  await app.evaluate(({ ipcMain }, action) => {
    const captured = globalThis as typeof globalThis & { transferMenuOpened?: boolean }
    captured.transferMenuOpened = false
    ipcMain.removeAllListeners('mt::menu::popup')
    ipcMain.on('mt::menu::popup', (event, template: TransferPopupItem[]) => {
      const leaves = (items: TransferPopupItem[]): TransferPopupItem[] =>
        items.flatMap((item) => (item.submenu ? leaves(item.submenu) : [item]))
      const item = leaves(template).find((item) => item.id?.startsWith(`${action}-mi-`))
      captured.transferMenuOpened = !!item?.enabled
      if (item?.enabled) event.sender.send('mt::menu::click', { id: item.id })
      event.sender.send('mt::menu::closed')
    })
  }, action)
  const tab = tabs(page)
    .filter({ has: page.locator('.unsaved-dot') })
    .first()
  if (keyboard) {
    await tab.focus()
    await page.keyboard.press('Shift+F10')
  } else await tab.click({ button: 'right' })
  await expect
    .poll(() =>
      app.evaluate(
        () =>
          (globalThis as typeof globalThis & { transferMenuOpened?: boolean }).transferMenuOpened
      )
    )
    .toBe(true)
}

test('keyboard tab menu creates a new window without global coordinates on Wayland', async() => {
  const { app, page } = await launchWithMarkdown('menu draft\n')
  try {
    await enterSourceMode(page, app)
    await app.evaluate(({ app, screen }) => {
      app.commandLine.appendSwitch('ozone-platform', 'wayland')
      screen.getCursorScreenPoint = () => {
        throw new Error('Wayland has no global cursor')
      }
    })
    const id = await tabs(page).first().getAttribute('data-id')
    await transferMenu(app, page, 'moveTabToNewWindow', true)
    await expect.poll(() => app.windows().length).toBe(2)
    const destination = required(app.windows().find((window) => window !== page))
    await expect(tabs(destination).first()).toHaveAttribute('data-id', required(id))
    await expect(destination.locator('.source-code')).toBeVisible()
    expect((await readMarkdown(destination, app)).trimEnd()).toBe('menu draft')
  } finally {
    await app.close()
  }
})

test('tab menu moves an unsaved document to another window on Wayland', async() => {
  const { app, page } = await launchWithMarkdown('menu merge\n')
  try {
    await typeIntoEditor(page, 'unsaved ')
    const expected = await readMarkdown(page, app)
    const id = await tabs(page).first().getAttribute('data-id')
    const destination = await secondWindow(app, page)
    const targets = await page.evaluate(() =>
      window.electron.ipcRenderer.invoke('mt::tabs::transfer-targets')
    )
    expect(targets).toHaveLength(1)
    await app.evaluate(({ app, screen }) => {
      app.commandLine.appendSwitch('ozone-platform', 'wayland')
      screen.getCursorScreenPoint = () => {
        throw new Error('Wayland has no global cursor')
      }
    })
    await transferMenu(app, page, `moveTabToWindow-${targets[0].id}`)
    await expect(tabs(destination)).toHaveCount(2)
    await expect(tabs(destination).last()).toHaveAttribute('data-id', required(id))
    expect((await readMarkdown(destination, app)).trimEnd()).toBe(expected.trimEnd())
    await expect(tabs(page)).toHaveCount(1)
    await expect(tabs(page).first()).not.toHaveAttribute('data-id', required(id))
  } finally {
    await app.close()
  }
})

test('Wayland keeps local tab sorting without accessing global coordinates', async() => {
  test.skip(process.platform !== 'linux', 'Wayland backend selection only applies to Linux.')
  const { app, page } = await launchWithMarkdown('local sorting\n')
  try {
    await page.locator('.editor-tabs .new-file').click({ force: true })
    await expect(tabs(page)).toHaveCount(2)
    const before = await tabs(page).evaluateAll((rows) =>
      rows.map((row) => row.getAttribute('data-id'))
    )
    await app.evaluate(({ app, screen }) => {
      app.commandLine.appendSwitch('ozone-platform', 'wayland')
      screen.getCursorScreenPoint = () => {
        throw new Error('Wayland has no global cursor')
      }
    })
    const from = await tabs(page).first().boundingBox()
    const to = await tabs(page).last().boundingBox()
    if (!from || !to) throw new Error('Missing local tabs')
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(to.x + to.width * 0.8, to.y + to.height / 2, { steps: 10 })
    await page.mouse.up()
    await expect(tabs(page).last()).toHaveAttribute('data-id', required(before[0]))
    expect(app.windows()).toHaveLength(1)
  } finally {
    await app.close()
  }
})

test('detaching a source document preserves its scroll position', async() => {
  const { app, page } = await launchWithMarkdown(
    Array.from({ length: 200 }, (_, i) => `Paragraph ${i}\n\n`).join('')
  )
  try {
    await enterSourceMode(page, app)
    const scroll = await page.locator('.source-code').evaluate((element) => {
      element.scrollTop = 500
      return element.scrollTop
    })
    expect(scroll).toBeGreaterThan(0)
    const id = await tabs(page).first().getAttribute('data-id')
    await dropAt(app, page, required(id), { x: -50, y: -50 })
    await expect.poll(() => app.windows().length).toBe(2)
    const destination = required(app.windows().find((window) => window !== page))
    await expect
      .poll(() => destination.locator('.source-code').evaluate((element) => element.scrollTop))
      .toBe(scroll)
  } finally {
    await app.close()
  }
})
