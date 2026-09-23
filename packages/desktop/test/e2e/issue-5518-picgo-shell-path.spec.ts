import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import { launchElectron } from './helpers'

// #5518: launched from Finder/Dock the app gets launchd's PATH, not the login
// shell's, so an uploader the user installed with pnpm/volta/nvm was reported
// as not installed and every upload failed. The stand-in below carries a name
// no machine can already have, so the login shell is the only way to reach it —
// a real `picgo` in one of the static fallback dirs cannot turn this green.
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

    // launchElectron copies the whole environment before applying this, so
    // without an explicit PATH the app would inherit the runner's login-shell
    // one and never be in the situation #5518 describes. This is what launchd
    // hands a Dock launch: /etc/paths and nothing of the user's own.
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
