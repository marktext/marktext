import { expect, test } from '@playwright/test'
import { _electron, type ElectronApplication } from 'playwright'
import { resolve } from 'node:path'
import { getElectronPath } from './helpers'
import type { windowPositionFixture } from './fixtures/window-position'

test.describe('Restored editor window bounds', () => {
  let app: ElectronApplication

  test.beforeAll(async() => {
    const { build } = await import('vite')
    const outDir = test.info().outputPath('window-position')
    await build({
      configFile: false,
      logLevel: 'error',
      build: {
        outDir,
        lib: {
          entry: resolve(__dirname, 'fixtures/window-position.ts'),
          formats: ['cjs'],
          fileName: () => 'window-position.cjs'
        },
        rolldownOptions: { external: ['electron', 'path'] }
      }
    })
    const fixturePath = resolve(outDir, 'window-position.cjs')
    app = await _electron.launch({
      executablePath: getElectronPath(),
      args: [fixturePath]
    })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  for (const titleBarStyle of ['default', 'hiddenInset'] as const) {
    for (const oversized of [false, true]) {
      test(`${titleBarStyle} title bar preserves ${oversized ? 'clamped' : 'saved'} outer bounds`, async() => {
        const result = await app.evaluate(({ BrowserWindow, Menu, screen }, options) => {
          const { editorWinOptions, ensureWindowPosition } = (globalThis as typeof globalThis & {
            windowPositionFixture: typeof windowPositionFixture
          }).windowPositionFixture
          const display = screen.getPrimaryDisplay()
          const area = process.platform === 'linux' ? display.bounds : display.workArea
          const expected = ensureWindowPosition(options.oversized
            ? { width: area.width + 100, height: area.height + 100 }
            : { x: area.x, y: area.y + area.height - 400, width: 600, height: 400 })
          const win = new BrowserWindow({
            ...editorWinOptions,
            ...expected,
            titleBarStyle: options.titleBarStyle,
            frame: options.titleBarStyle === 'default',
            show: false,
            webPreferences: { sandbox: true }
          })
          try {
            if (process.platform !== 'darwin' && options.titleBarStyle === 'default') {
              win.setMenu(Menu.buildFromTemplate([{ label: 'File', submenu: [{ role: 'close' }] }]))
            }
            return { expected, actual: win.getBounds(), area }
          } finally {
            win.destroy()
          }
        }, { oversized, titleBarStyle })

        expect(result.actual).toMatchObject({ x: result.expected.x, y: result.expected.y })
        // Under Xvfb, screen-sized windows can be reduced by one pixel per axis.
        const maxShrink = process.platform === 'linux' && oversized ? 1 : 0
        for (const dimension of ['width', 'height'] as const) {
          expect(result.actual[dimension]).toBeGreaterThanOrEqual(result.expected[dimension] - maxShrink)
          expect(result.actual[dimension]).toBeLessThanOrEqual(result.expected[dimension])
        }
        expect(result.actual.x + result.actual.width).toBeLessThanOrEqual(result.area.x + result.area.width)
        expect(result.actual.y + result.actual.height).toBeLessThanOrEqual(result.area.y + result.area.height)
      })
    }
  }
})
