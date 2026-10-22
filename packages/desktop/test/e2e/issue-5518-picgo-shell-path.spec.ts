import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron } from './helpers'

// #5518. The name is one no machine can already have, so a real picgo in a
// static fallback dir cannot turn this green.
const UPLOADER = 'mt-e2e-uploader-5518'

let app: ElectronApplication
let page: Page
let tmpDir: string

test.describe('a command only the login shell knows about (#5518)', () => {
  test.skip(process.platform === 'win32', 'Windows GUI apps inherit the user PATH')

  test.beforeAll(async() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'mt-5518-'))
    const binDir = path.join(tmpDir, 'pnpm-home')
    fs.mkdirSync(binDir)
    fs.writeFileSync(path.join(binDir, UPLOADER), '#!/bin/sh\nexit 0\n', { mode: 0o755 })

    const shell = path.join(tmpDir, 'login-shell')
    fs.writeFileSync(
      shell,
      [
        '#!/bin/sh',
        'for a in "$@"; do last="$a"; done',
        `PATH="${binDir}:/usr/bin:/bin" /bin/sh -c "$last"`
      ].join('\n') + '\n',
      { mode: 0o755 }
    )

    // launchElectron copies the whole environment first, so without this the
    // app would get the runner's login-shell PATH. These are /etc/paths.
    const launched = await launchElectron([], {
      env: { PATH: '/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin', SHELL: shell }
    })
    app = launched.app
    page = launched.page
  })

  test.afterAll(async() => {
    await app?.close()
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('the uploader panel is told it is installed', async() => {
    const exists = await page.evaluate((name) => window.commandExists.exists(name), UPLOADER)
    expect(exists).toBe(true)
  })

  test('a command nobody installed is still reported missing', async() => {
    const exists = await page.evaluate(() => window.commandExists.exists('mt-e2e-missing-5518'))
    expect(exists).toBe(false)
  })
})
