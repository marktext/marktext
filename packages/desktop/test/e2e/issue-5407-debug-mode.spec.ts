import { expect, test } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { launchElectron, waitForMenuReady } from './helpers'

// #5407: a built app ran with debug mode on, because `debug` was derived from
// `NODE_ENV !== 'production'` and nothing sets NODE_ENV in a released build. The
// View menu then offered "Show Developer Tools" and "Reload Window" to everyone.

interface DebugState {
  debug: boolean
  viewItemCount: number
}

// The developer tools entries carry no id and their labels are translated, so
// count the View submenu instead: debug mode appends a separator and two items.
const readDebugState = (app: ElectronApplication): Promise<DebugState> =>
  app.evaluate(({ Menu }) => {
    const view = Menu.getApplicationMenu()?.items.find((item) => item.submenu?.items.some(
      (entry) => entry.id === 'sourceCodeModeMenuItem'
    ))
    if (!view?.submenu) throw new Error('View menu was not found')
    return {
      debug: !!(global as typeof global & { MARKTEXT_DEBUG?: boolean }).MARKTEXT_DEBUG,
      viewItemCount: view.submenu.items.length
    }
  })

// Debug mode is turned on with MARKTEXT_DEBUG here rather than `--debug`,
// which Node's CLI parser claims before the app sees it (#5409).
test('a built app offers no developer tools unless debug mode is turned on', async() => {
  const plain = await launchElectron()
  let plainState: DebugState
  try {
    await waitForMenuReady(plain.app)
    plainState = await readDebugState(plain.app)
  } finally {
    await plain.app.close()
  }
  expect(plainState.debug).toBe(false)

  const debugRun = await launchElectron([], { env: { MARKTEXT_DEBUG: '1' } })
  let debugState: DebugState
  try {
    await waitForMenuReady(debugRun.app)
    debugState = await readDebugState(debugRun.app)
  } finally {
    await debugRun.app.close()
  }
  expect(debugState.debug).toBe(true)
  // The separator, "Show Developer Tools" and "Reload Window".
  expect(debugState.viewItemCount).toBe(plainState.viewItemCount + 3)
})
