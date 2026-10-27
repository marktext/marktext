import { test, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ts from 'typescript'
import { launchElectron } from './helpers'
import type * as Geometry from '../../src/main/applicationState/windowGeometry'

test('geometry adapters use independent native window bounds and recover an off-screen window', async() => {
  const { app } = await launchElectron()
  const source = ts.transpileModule(
    readFileSync(resolve(__dirname, '../../src/main/applicationState/windowGeometry.ts'), 'utf8'),
    {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }
  ).outputText
  try {
    const result = await app.evaluate(({ BrowserWindow, screen }, source) => {
      const module = { exports: {} }
      new Function('module', 'exports', source)(module, module.exports)
      const geometry = module.exports as typeof Geometry
      const displays = screen
        .getAllDisplays()
        .map((display) => ({ id: String(display.id), workArea: display.workArea }))
      const primary = String(screen.getPrimaryDisplay().id)
      const first = new BrowserWindow({ show: false, width: 800, height: 600 })
      const second = new BrowserWindow({ show: false, width: 900, height: 700 })
      const originalSecond = second.getNormalBounds()
      const requested = {
        normalBounds: { x: 99999, y: -99999, width: 800, height: 600 },
        maximized: false,
        displayId: 'removed'
      }
      geometry.applyWindowGeometry(first, requested, displays, primary)
      const captured = geometry.captureWindowGeometry(first, displays, primary)
      const expected = geometry.fitWindowGeometry(requested, displays, primary)
      const unchanged = second.getNormalBounds()
      first.destroy()
      second.destroy()
      return { captured, expected, originalSecond, unchanged }
    }, source)
    expect(result.captured).toEqual(result.expected)
    expect(result.unchanged).toEqual(result.originalSecond)
  } finally {
    await app.evaluate(({ app }) => app.exit(0)).catch(() => {})
    await app.close()
  }
})
