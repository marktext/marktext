const fs = require('fs')
const os = require('os')
const path = require('path')
const { _electron } = require('playwright')

const projectRoot = path.resolve(__dirname, '../..')

const getDateAsFilename = () => {
  const date = new Date()
  return '' + date.getFullYear() + (date.getMonth() + 1) + date.getDay()
}

const getTempPath = (suffix = '') => {
  const name = 'marktext-e2etest-' + getDateAsFilename() + '-' + Math.random().toString(36).slice(2, 8) + suffix
  return path.join(os.tmpdir(), name)
}

const getElectronPath = () => {
  if (process.platform === 'win32') {
    return path.resolve(path.join('node_modules', '.bin', 'electron.cmd'))
  }
  const pathTxt = path.join(projectRoot, 'node_modules/electron/path.txt')
  const relPath = fs.readFileSync(pathTxt, 'utf-8').trim()
  return path.join(projectRoot, 'node_modules/electron/dist', relPath)
}

// Track every temp directory we create so we can sweep them on process exit
// (Playwright workers persist across specs but die when the run ends).
const createdTempDirs = new Set()
const trackTempDir = (dir) => {
  createdTempDirs.add(dir)
  return dir
}
process.on('exit', () => {
  for (const dir of createdTempDirs) {
    try { fs.rmSync(dir, { recursive: true, force: true }) } catch { /* ignore */ }
  }
})

const launchElectron = async userArgs => {
  userArgs = userArgs || []
  const executablePath = getElectronPath()
  // Pass project root as entry so Electron reads package.json and getAppPath() returns project root.
  // Passing out/main/index.js directly bypasses package.json and breaks __static path resolution.
  const userDataDir = trackTempDir(getTempPath())
  const args = [projectRoot, '--user-data-dir', userDataDir].concat(userArgs)
  const app = await _electron.launch({
    executablePath,
    args,
    cwd: projectRoot,
    env: { ...process.env, PERF_TESTING: 'true' },
    timeout: 30000
  })
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await new Promise((resolve) => setTimeout(resolve, 500))
  return { app, page }
}

const waitForMenuReady = async(app, timeout = 10000) => {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const ready = await app.evaluate(({ Menu }) => !!Menu.getApplicationMenu())
    if (ready) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('Application menu was not built within timeout')
}

const clickMenuById = async(app, id) => {
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

const waitForEditor = async(page, timeout = 15000) => {
  await page.waitForSelector('.editor-component', { state: 'attached', timeout })
  await page.waitForFunction(() => {
    const el = document.querySelector('.editor-component')
    return el && el.children.length > 0
  }, null, { timeout })
}

const enterSourceMode = async(page, app) => {
  const already = await page.evaluate(() => !!document.querySelector('.source-code .CodeMirror'))
  if (already) return
  await clickMenuById(app, 'sourceCodeModeMenuItem')
  await page.waitForSelector('.source-code .CodeMirror', { state: 'attached', timeout: 10000 })
  await page.waitForFunction(() => {
    const cm = document.querySelector('.source-code .CodeMirror')
    return cm && cm.CodeMirror
  }, null, { timeout: 10000 })
}

const exitSourceMode = async(page, app) => {
  const inSource = await page.evaluate(() => !!document.querySelector('.source-code .CodeMirror'))
  if (!inSource) return
  await clickMenuById(app, 'sourceCodeModeMenuItem')
  await page.waitForFunction(() => !document.querySelector('.source-code'), null, { timeout: 10000 })
}

const getMarkdownContent = async(page, app) => {
  const wasInSource = await page.evaluate(() => !!document.querySelector('.source-code .CodeMirror'))
  if (!wasInSource) await enterSourceMode(page, app)
  const value = await page.evaluate(() => {
    const cm = document.querySelector('.source-code .CodeMirror')
    return cm && cm.CodeMirror ? cm.CodeMirror.getValue() : ''
  })
  if (!wasInSource) await exitSourceMode(page, app)
  return value
}

const typeIntoEditor = async(page, text) => {
  await page.click('.editor-component', { timeout: 5000 })
  await page.keyboard.type(text, { delay: 0 })
}

// Muya validates selections via `node.closest('span.ag-paragraph')` — the inner
// span that wraps editable text. Selecting the outer <p class="ag-paragraph">
// or its contents fails validation, so we always target the inner span.
const focusEditor = async(page) => {
  await page.evaluate(() => {
    const root = document.querySelector('.editor-component')
    if (!root) return false
    root.focus()
    const spans = root.querySelectorAll('span.ag-paragraph')
    let target = null
    for (const span of spans) {
      if (span.textContent && span.textContent.trim().length > 0) {
        target = span
        break
      }
    }
    target = target || spans[0]
    if (!target) return false
    const range = document.createRange()
    range.selectNodeContents(target)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
    return true
  })
  // Allow muya's selectionchange listener to commit the selection to its model.
  await page.waitForTimeout(150)
}

const placeCaretInEditor = async(page) => {
  await page.evaluate(() => {
    const root = document.querySelector('.editor-component')
    if (!root) return
    root.focus()
    const spans = root.querySelectorAll('span.ag-paragraph')
    let target = null
    for (const span of spans) {
      if (span.textContent && span.textContent.trim().length > 0) {
        target = span
        break
      }
    }
    target = target || spans[0]
    if (!target) return
    const range = document.createRange()
    range.selectNodeContents(target)
    range.collapse(false)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
    document.dispatchEvent(new Event('selectionchange'))
  })
  await page.waitForTimeout(150)
}

const setSourceMarkdown = async(page, app, markdown) => {
  await enterSourceMode(page, app)
  await page.evaluate((value) => {
    const cm = document.querySelector('.source-code .CodeMirror')
    if (cm && cm.CodeMirror) cm.CodeMirror.setValue(value)
  }, markdown)
  await exitSourceMode(page, app)
}

const writeTempMarkdown = (content) => {
  const dir = trackTempDir(getTempPath('-doc'))
  fs.mkdirSync(dir, { recursive: true })
  const filePath = path.join(dir, 'note.md')
  fs.writeFileSync(filePath, content, 'utf-8')
  return filePath
}

const launchWithDoc = async(relativeFixture) => {
  const { app, page } = await launchElectron([relativeFixture])
  await waitForEditor(page)
  await waitForMenuReady(app)
  return { app, page }
}

const launchWithMarkdown = async(markdown = '') => {
  const filePath = writeTempMarkdown(markdown)
  const { app, page } = await launchElectron([filePath])
  await waitForEditor(page)
  await waitForMenuReady(app)
  return { app, page, filePath }
}

const sendIpcToRenderer = async(app, channel, ...args) => {
  await app.evaluate(({ BrowserWindow }, payload) => {
    const win = BrowserWindow.getAllWindows()[0]
    win.webContents.send(payload.channel, ...payload.args)
  }, { channel, args })
}

module.exports = {
  getElectronPath,
  launchElectron,
  launchWithDoc,
  launchWithMarkdown,
  waitForEditor,
  waitForMenuReady,
  clickMenuById,
  enterSourceMode,
  exitSourceMode,
  getMarkdownContent,
  typeIntoEditor,
  focusEditor,
  placeCaretInEditor,
  setSourceMarkdown,
  sendIpcToRenderer
}
