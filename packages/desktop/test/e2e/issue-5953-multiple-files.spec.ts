import { expect, test } from '@playwright/test'
import { _electron, type ElectronApplication } from 'playwright'
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import type { ApplicationState } from '../../src/shared/types/applicationState'
import { getElectronPath, launchElectron } from './helpers'

const projectRoot = resolve(__dirname, '../..')
let directory: string
let profile: string
let files: string[]
let app: ElectronApplication | undefined

test.beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'mt-5953-'))
  profile = join(directory, 'profile')
  mkdirSync(profile)
  writeFileSync(join(profile, 'preferences.json'), JSON.stringify({
    language: 'en', startUpAction: 'blank', openFilesInNewWindow: false
  }))
  files = Array.from({ length: 7 }, (_, i) => join(directory, `note ${i}.md`))
  for (const [i, file] of files.entries()) writeFileSync(file, `Document ${i}\n`)
})

test.afterEach(async() => {
  if (app) {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app.close().catch(() => {})
    app = undefined
  }
  rmSync(directory, { recursive: true, force: true })
})

const assertSingleWindow = async() => {
  const running = app
  if (!running) throw new Error('Application has not launched')
  const statePath = join(profile, 'state/application-state.json')
  await expect.poll(() => existsSync(statePath)).toBe(true)
  await expect.poll(() => {
    const state: ApplicationState = JSON.parse(readFileSync(statePath, 'utf8'))
    return state.session.windows.map(window => window.documents.flatMap(document =>
      document.resource.kind === 'file' ? [document.resource.location.path] : []
    ).sort())
  }).toEqual([[...files].sort()])
  expect(await running.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length)).toBe(1)
  const page = await running.firstWindow()
  await expect(page.locator('.tabs-container > li')).toHaveCount(files.length)
}

test('opens seven CLI files in a single window', async() => {
  const launched = await launchElectron(files, { userDataDir: profile })
  app = launched.app
  await assertSingleWindow()
})

test('opens seven successive requests in the running window', async() => {
  const launched = await launchElectron([], { userDataDir: profile })
  app = launched.app
  await app.evaluate(({ app }, { files, projectRoot }) => {
    for (const file of files) {
      const argv = [process.execPath, projectRoot, file]
      app.emit('second-instance', {}, argv, process.cwd(), { argv })
    }
  }, { files, projectRoot })
  await assertSingleWindow()
})

const launchDuringStartup = async(requests: string[][], beforeReady = false) => {
  const bootstrap = join(directory, 'bootstrap.cjs')
  // Explorer can deliver more launches while the initial session is still loading (#5953).
  writeFileSync(bootstrap, `
    const { app, ipcMain } = require('electron')
    global.startupErrors = []
    process.on('uncaughtException', error => global.startupErrors.push(String(error)))
    process.on('unhandledRejection', error => global.startupErrors.push(String(error)))
    ipcMain.on('mt::handle-renderer-error', (_event, error) => global.startupErrors.push(error.message))
    app.setAppPath(${JSON.stringify(projectRoot)})
    require(${JSON.stringify(join(projectRoot, 'out/main/index.js'))})
    const open = () => {
      for (const request of ${JSON.stringify(requests)}) {
        const argv = [process.execPath, app.getAppPath(), ...request]
        app.emit('second-instance', {}, argv, process.cwd(), { argv })
      }
    }
    if (${beforeReady}) open()
    else app.once('ready', open)
  `)
  app = await _electron.launch({
    executablePath: getElectronPath(),
    args: [bootstrap, '--user-data-dir', profile, files[0]],
    cwd: projectRoot,
    env: { ...process.env, MARKTEXT_ERROR_INTERACTION: '1' }
  })
  await app.firstWindow()
  return app
}

const assertNoStartupErrors = async(running: ElectronApplication) => {
  expect(await running.evaluate(() =>
    (globalThis as unknown as { startupErrors: string[] }).startupErrors
  )).toEqual([])
}

for (const beforeReady of [false, true]) {
  test(`keeps startup requests in the initial window (before ready=${beforeReady})`, async() => {
    const running = await launchDuringStartup(files.slice(1).map(file => [file]), beforeReady)
    await assertSingleWindow()
    await assertNoStartupErrors(running)
  })
}

test('preserves explicit new-window and read-only options queued during startup', async() => {
  const requested = files.slice(1, 3)
  const running = await launchDuringStartup([['--new-window', '--read-only', ...requested]])
  const statePath = join(profile, 'state/application-state.json')
  await expect.poll(() => existsSync(statePath)).toBe(true)
  await expect.poll(() => {
    const state: ApplicationState = JSON.parse(readFileSync(statePath, 'utf8'))
    return state.session.windows.map(window => window.documents.map(document => ({
      path: document.resource.kind === 'file' ? document.resource.location.path : null,
      readOnly: document.readOnly
    })))
  }).toEqual([
    [{ path: files[0], readOnly: false }],
    requested.map(path => ({ path, readOnly: true }))
  ])
  await expect.poll(() => running.windows().length).toBe(2)
  const pages = running.windows()
  await expect(pages[0].locator('.tabs-container > li')).toHaveCount(1)
  await expect(pages[1].locator('.tabs-container > li')).toHaveCount(2)
  await expect(pages[1].locator('.mu-read-only')).toBeVisible()
  await assertNoStartupErrors(running)
})
