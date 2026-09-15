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

interface ExitResult {
  code: number | null
  signal: NodeJS.Signals | null
  output: string
}

// Resolves once the child has exited and closed its stdio, with everything it
// printed; rejects if that takes longer than `timeout` ms.
const waitForExit = (child: ChildProcess, timeout: number): Promise<ExitResult> => {
  let output = ''
  child.stdout?.on('data', (chunk: Buffer) => {
    output += chunk
  })
  child.stderr?.on('data', (chunk: Buffer) => {
    output += chunk
  })
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`The second instance did not exit. Output:\n${output}`))
    }, timeout)
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      resolve({ code, signal, output })
    })
  })
}

interface SecondInstanceRecord {
  received: number
  errors: string[]
}

test('a second instance started with --user-data-dir opens its file in the running instance', async() => {
  const { app, page, filePath } = await launchWithMarkdown('# first\n')
  // An exception thrown by a main-process listener hangs an app under
  // Playwright, so record what the app's own second-instance listeners throw.
  await app.evaluate(({ app }) => {
    const record: SecondInstanceRecord = { received: 0, errors: [] }
    ;(globalThis as { __secondInstance?: SecondInstanceRecord }).__secondInstance = record
    const listeners = app.listeners('second-instance')
    app.removeAllListeners('second-instance')
    app.on('second-instance', (...args) => {
      record.received++
      for (const listener of listeners) {
        try {
          listener.apply(app, args)
        } catch (error) {
          record.errors.push(String(error))
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
    { cwd: docDir, env: { ...process.env, PERF_TESTING: 'true' } }
  )
  try {
    const { code, signal, output } = await waitForExit(secondInstance, 15000)
    expect.soft({ code, signal }, `Output of the second instance:\n${output}`).toEqual({
      code: 0,
      signal: null
    })
    const record = await app.evaluate(
      () => (globalThis as { __secondInstance?: SecondInstanceRecord }).__secondInstance
    )
    expect(record).toEqual({ received: 1, errors: [] })

    await expect(page.locator('.tabs-container > li', { hasText: 'second.md' })).toHaveCount(1, {
      timeout: 10000
    })
    const windowCount = await app.evaluate(
      ({ BrowserWindow }) => BrowserWindow.getAllWindows().length
    )
    expect(windowCount).toBe(1)
  } finally {
    if (secondInstance.exitCode === null && secondInstance.signalCode === null) {
      secondInstance.kill()
    }
    await app.close()
  }
})
