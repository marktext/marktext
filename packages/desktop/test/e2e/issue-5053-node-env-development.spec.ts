import * as os from 'node:os'
import { expect, test } from '@playwright/test'
import { launchElectron } from './helpers'

// #5053, #5083: a NODE_ENV=development exported by the user's shell switched
// the built app into development mode, so it loaded the window from the
// missing dev server URL and crashed on launch with "Invalid URL".

test('a built app ignores NODE_ENV=development from the environment', async() => {
  const { app, page } = await launchElectron([], { env: { NODE_ENV: 'development' } })
  try {
    expect(page.url()).toMatch(/^file:\/\//)

    const { userData, hasSingleInstanceLock } = await app.evaluate(({ app }) => ({
      userData: app.getPath('userData'),
      hasSingleInstanceLock: app.hasSingleInstanceLock()
    }))
    expect(userData.startsWith(os.tmpdir())).toBe(true)
    expect(hasSingleInstanceLock).toBe(true)
  } finally {
    await app.close()
  }
})
