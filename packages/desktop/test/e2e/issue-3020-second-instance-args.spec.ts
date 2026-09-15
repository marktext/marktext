import { spawn, type ChildProcess } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { expect, test } from '@playwright/test'
import { getElectronPath, launchWithMarkdown } from './helpers'

// #3020: the `argv` of the `second-instance` event lists switches before the
// other arguments and adds switches of its own, so `second.md --user-data-dir
// <dir>` arrived as `--user-data-dir --allow-file-access-from-files … second.md
// <dir>`: the running instance failed to parse it and never opened the file.

const projectRoot = path.resolve(__dirname, '../..')

const waitForExit = (child: ChildProcess, timeout: number): Promise<number | null> =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('The second instance did not exit')), timeout)
    child.on('exit', (code) => {
      clearTimeout(timer)
      resolve(code)
    })
  })

test('a second instance started with --user-data-dir opens its file in the running instance', async() => {
  const { app, page, filePath } = await launchWithMarkdown('# first\n')
  // An exception thrown by a main-process listener hangs an app under
  // Playwright, so record what the app's own second-instance listeners throw.
  await app.evaluate(({ app }) => {
    const errors: string[] = []
    ;(globalThis as { __secondInstanceErrors?: string[] }).__secondInstanceErrors = errors
    const listeners = app.listeners('second-instance')
    app.removeAllListeners('second-instance')
    app.on('second-instance', (...args) => {
      for (const listener of listeners) {
        try {
          listener.apply(app, args)
        } catch (error) {
          errors.push(String(error))
        }
      }
    })
  })

  const docDir = path.dirname(filePath)
  fs.writeFileSync(path.join(docDir, 'second.md'), '# second\n', 'utf-8')
  const userDataDir = await app.evaluate(({ app }) => app.getPath('userData'))
  const secondInstance = spawn(
    getElectronPath(),
    [projectRoot, 'second.md', '--user-data-dir', userDataDir],
    { cwd: docDir, env: { ...process.env, PERF_TESTING: 'true' }, stdio: 'ignore' }
  )
  try {
    expect(await waitForExit(secondInstance, 15000)).toBe(0)
    const errors = await app.evaluate(
      () => (globalThis as { __secondInstanceErrors?: string[] }).__secondInstanceErrors
    )
    expect(errors).toEqual([])

    await expect(page.locator('.tabs-container > li', { hasText: 'second.md' })).toHaveCount(1, {
      timeout: 10000
    })
    const windowCount = await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length
    )
    expect(windowCount).toBe(1)
  } finally {
    if (secondInstance.exitCode === null) secondInstance.kill()
    await app.close()
  }
})
