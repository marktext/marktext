import { expect } from '@playwright/test'
import { _electron, type ElectronApplication, type Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

const projectRoot = path.resolve(__dirname, '../..')

const getDateAsFilename = (): string => {
  const date = new Date()
  return '' + date.getFullYear() + (date.getMonth() + 1) + date.getDate()
}

const getTempPath = (suffix = ''): string => {
  const name =
    'marktext-e2etest-' +
    getDateAsFilename() +
    '-' +
    Math.random().toString(36).slice(2, 8) +
    suffix
  return path.join(os.tmpdir(), name)
}

export const getElectronPath = (): string => {
  if (process.platform === 'win32') {
    return path.resolve(path.join('node_modules', '.bin', 'electron.cmd'))
  }
  const pathTxt = path.join(projectRoot, 'node_modules/electron/path.txt')
  const relPath = fs.readFileSync(pathTxt, 'utf-8').trim()
  return path.join(projectRoot, 'node_modules/electron/dist', relPath)
}

// Track every temp directory we create so we can sweep them on process exit
// (Playwright workers persist across specs but die when the run ends).
const createdTempDirs = new Set<string>()
const trackTempDir = (dir: string): string => {
  createdTempDirs.add(dir)
  return dir
}
process.on('exit', () => {
  for (const dir of createdTempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true })
    } catch {
      /* ignore */
    }
  }
})

export interface LaunchResult {
  app: ElectronApplication
  page: Page
}

export interface LaunchOptions {
  // When true, sets MARKTEXT_ERROR_INTERACTION=1 in the launch env so
  // src/main/exceptionHandler.ts suppresses the modal "Unexpected error"
  // dialog. Only crash-guard specs that explicitly call expectNoRendererErrors
  // should opt in — otherwise existing specs would silently ignore renderer
  // exceptions that previously surfaced as a dialog (a hidden regression risk).
  suppressErrorDialog?: boolean
}

export const launchElectron = async(
  userArgs?: string[],
  options: LaunchOptions = {}
): Promise<LaunchResult> => {
  userArgs = userArgs || []
  const executablePath = getElectronPath()
  // Pass project root as entry so Electron reads package.json and getAppPath() returns project root.
  // Passing out/main/index.js directly bypasses package.json and breaks __static path resolution.
  const userDataDir = trackTempDir(getTempPath())
  const args = [projectRoot, '--user-data-dir', userDataDir].concat(userArgs)
  const env: Record<string, string> = {}
  for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v
  env.PERF_TESTING = 'true'
  if (options.suppressErrorDialog) env.MARKTEXT_ERROR_INTERACTION = '1'
  const app = await _electron.launch({
    executablePath,
    args,
    cwd: projectRoot,
    env,
    timeout: 30000
  })
  if (options.suppressErrorDialog) await installRendererErrorCounter(app)
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await new Promise((resolve) => setTimeout(resolve, 500))
  return { app, page }
}

// Capture renderer-process errors that would otherwise pop the "Unexpected
// error" dialog. We attach a parallel listener to the same IPC channel
// (`mt::handle-renderer-error`) that exceptionHandler.ts listens on, and
// accumulate the count in a shared global so specs can read it back via
// `getRendererErrors`. Multiple listeners are allowed on ipcMain.
const installRendererErrorCounter = async(app: ElectronApplication): Promise<void> => {
  await app.evaluate(({ ipcMain }) => {
    const g = global as unknown as {
      __mt_renderer_errors__?: Array<{ message?: string; name?: string; stack?: string }>
    }
    if (!g.__mt_renderer_errors__) {
      const sink: Array<{ message?: string; name?: string; stack?: string }> = []
      g.__mt_renderer_errors__ = sink
      ipcMain.on('mt::handle-renderer-error', (_e, error) => {
        sink.push(error)
      })
    }
  })
}

export const getRendererErrors = async(
  app: ElectronApplication
): Promise<Array<{ message?: string; name?: string; stack?: string }>> => {
  return await app.evaluate(() => {
    const g = global as unknown as {
      __mt_renderer_errors__?: Array<{ message?: string; name?: string; stack?: string }>
    }
    return (g.__mt_renderer_errors__ || []).slice()
  })
}

export const clearRendererErrors = async(app: ElectronApplication): Promise<void> => {
  await app.evaluate(() => {
    const g = global as unknown as {
      __mt_renderer_errors__?: Array<unknown>
    }
    if (g.__mt_renderer_errors__) g.__mt_renderer_errors__.length = 0
  })
}

// Assert that no renderer-process error has been captured since the last clear.
// On failure, prints the captured stacks so the spec output is actionable.
export const expectNoRendererErrors = async(app: ElectronApplication): Promise<void> => {
  const errors = await getRendererErrors(app)
  if (errors.length > 0) {
    const summary = errors.map((e) => `- ${e.name ?? 'Error'}: ${e.message}\n${e.stack ?? ''}`).join('\n\n')
    throw new Error(`Expected no renderer errors, captured ${errors.length}:\n\n${summary}`)
  }
  expect(errors.length).toBe(0)
}

// Poll until a renderer error matching `predicate` is captured (or timeout).
// Prefer this over a fixed `waitForTimeout` when waiting for an error to
// surface — IPC delivery time varies on slower CI runners.
export const waitForRendererError = async(
  app: ElectronApplication,
  predicate: (e: { message?: string; name?: string; stack?: string }) => boolean,
  timeoutMs = 5000,
  pollMs = 50
): Promise<{ message?: string; name?: string; stack?: string } | null> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const errors = await getRendererErrors(app)
    const match = errors.find(predicate)
    if (match) return match
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  return null
}

export const waitForMenuReady = async(
  app: ElectronApplication,
  timeout = 10000
): Promise<void> => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const ready = await app.evaluate(({ Menu }) => !!Menu.getApplicationMenu())
    if (ready) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Application menu was not built within timeout')
}

export const clickMenuById = async(app: ElectronApplication, id: string): Promise<void> => {
  await app.evaluate(({ Menu, BrowserWindow }, menuId) => {
    const menu = Menu.getApplicationMenu()
    if (!menu) throw new Error('Application menu is not built yet')
    const item = menu.getMenuItemById(menuId)
    if (!item) throw new Error('Menu id not found: ' + menuId)
    const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    // Electron auto-toggles `checked` for checkbox/radio items on a real
    // click. Replicate that here so handlers that read `menuItem.checked`
    // (e.g. theme `follow-system-theme`) behave the same under tests.
    if (item.type === 'checkbox') {
      item.checked = !item.checked
    } else if (item.type === 'radio') {
      item.checked = true
    }
    // MenuItem.click signature: (event, focusedWindow, focusedWebContents).
    // Electron synthesizes the menuItem argument for template handlers via
    // _executeCommand, so we only need to forward window/webContents.
    // Do not call win.focus() — on xvfb that can collapse the renderer's
    // current DOM selection, breaking format/selection-driven menu actions.
    item.click(undefined, win, win ? win.webContents : undefined)
  }, id)
}

export const waitForEditor = async(page: Page, timeout = 15000): Promise<void> => {
  await page.waitForSelector('.editor-component', { state: 'attached', timeout })
  await page.waitForFunction(
    () => {
      const el = document.querySelector('.editor-component')
      return el && el.children.length > 0
    },
    null,
    { timeout }
  )
}

export const enterSourceMode = async(page: Page, app: ElectronApplication): Promise<void> => {
  const already = await page.evaluate(() => !!document.querySelector('.source-code .CodeMirror'))
  if (already) return
  await clickMenuById(app, 'sourceCodeModeMenuItem')
  await page.waitForSelector('.source-code .CodeMirror', { state: 'attached', timeout: 10000 })
  await page.waitForFunction(
    () => {
      const cm = document.querySelector('.source-code .CodeMirror') as
        | (Element & { CodeMirror?: unknown })
        | null
      return cm && cm.CodeMirror
    },
    null,
    { timeout: 10000 }
  )
}

export const exitSourceMode = async(page: Page, app: ElectronApplication): Promise<void> => {
  const inSource = await page.evaluate(() => !!document.querySelector('.source-code .CodeMirror'))
  if (!inSource) return
  await clickMenuById(app, 'sourceCodeModeMenuItem')
  await page.waitForFunction(() => !document.querySelector('.source-code'), null, {
    timeout: 10000
  })
}

export const getMarkdownContent = async(
  page: Page,
  app: ElectronApplication
): Promise<string> => {
  const wasInSource = await page.evaluate(
    () => !!document.querySelector('.source-code .CodeMirror')
  )
  if (!wasInSource) await enterSourceMode(page, app)
  const value = await page.evaluate(() => {
    const cm = document.querySelector('.source-code .CodeMirror') as
      | (Element & { CodeMirror?: { getValue(): string } })
      | null
    return cm && cm.CodeMirror ? cm.CodeMirror.getValue() : ''
  })
  if (!wasInSource) await exitSourceMode(page, app)
  return value
}

export const typeIntoEditor = async(page: Page, text: string): Promise<void> => {
  await page.click('.editor-component', { timeout: 5000 })
  await page.keyboard.type(text, { delay: 0 })
}

// The @muyajs/core engine wraps editable paragraph text in
// `span.mu-paragraph-content` (inside `p.mu-paragraph`). Selecting the inner
// content span is what the engine's selection logic expects, so we target it.
// Place a selection inside the first non-empty paragraph content span and let
// the engine commit it to its model. The @muyajs/core engine derives its
// `activeContentBlock` from `click`/`input`/`keydown`/`keyup` events on the
// editor root (see editor/index.ts), so a bare `selectionchange` is not enough
// — we dispatch a synthetic `keyup` on the editor so the active block updates.
const commitSelection = (collapse: boolean) => {
  const root = document.querySelector('.editor-component') as HTMLElement | null
  if (!root) return false
  root.focus()
  const spans = root.querySelectorAll('span.mu-paragraph-content')
  let target: Element | null = null
  for (const span of spans) {
    if (span.textContent && span.textContent.trim().length > 0) {
      target = span
      break
    }
  }
  target = target || spans[0] || null
  if (!target) return false
  const range = document.createRange()
  range.selectNodeContents(target)
  if (collapse) range.collapse(false)
  const sel = window.getSelection()
  if (!sel) return false
  sel.removeAllRanges()
  sel.addRange(range)
  document.dispatchEvent(new Event('selectionchange'))
  root.dispatchEvent(
    new KeyboardEvent('keyup', { key: 'ArrowRight', bubbles: true, cancelable: true })
  )
  return true
}

export const focusEditor = async(page: Page): Promise<void> => {
  await page.evaluate(commitSelection, false)
  // Allow muya's selectionchange listener to commit the selection to its model.
  await page.waitForTimeout(150)
}

export const placeCaretInEditor = async(page: Page): Promise<void> => {
  await page.evaluate(commitSelection, true)
  await page.waitForTimeout(150)
}

export const setSourceMarkdown = async(
  page: Page,
  app: ElectronApplication,
  markdown: string
): Promise<void> => {
  await enterSourceMode(page, app)
  await page.evaluate((value) => {
    const cm = document.querySelector('.source-code .CodeMirror') as
      | (Element & { CodeMirror?: { setValue(v: string): void } })
      | null
    if (cm && cm.CodeMirror) cm.CodeMirror.setValue(value)
  }, markdown)
  await exitSourceMode(page, app)
}

const writeTempMarkdown = (content: string): string => {
  const dir = trackTempDir(getTempPath('-doc'))
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, 'note.md')
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

export const launchWithDoc = async(
  relativeFixture: string,
  options: LaunchOptions = {}
): Promise<LaunchResult> => {
  const { app, page } = await launchElectron([relativeFixture], options)
  await waitForEditor(page)
  await waitForMenuReady(app)
  return { app, page }
}

export interface LaunchWithMarkdownResult extends LaunchResult {
  filePath: string
}

export const launchWithMarkdown = async(
  markdown = '',
  options: LaunchOptions = {}
): Promise<LaunchWithMarkdownResult> => {
  const filePath = writeTempMarkdown(markdown)
  const { app, page } = await launchElectron([filePath], options)
  await waitForEditor(page)
  await waitForMenuReady(app)
  return { app, page, filePath }
}

export const sendIpcToRenderer = async(
  app: ElectronApplication,
  channel: string,
  ...args: unknown[]
): Promise<void> => {
  await app.evaluate(
    ({ BrowserWindow }, payload) => {
      const win = BrowserWindow.getAllWindows()[0]
      win.webContents.send(payload.channel, ...payload.args)
    },
    { channel, args }
  )
}
