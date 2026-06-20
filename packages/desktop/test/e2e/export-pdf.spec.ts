import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import * as fs from 'node:fs'
import {
  launchWithMarkdown,
  waitForMenuReady,
  sendIpcToRenderer
} from './helpers'

// Item 231 — PDF export to a real file via the Electron menu (smoke).
//
// The full path is: File › Export › Export PDF →
//   main `exportFile()` sends `mt::show-export-dialog` →
//   renderer export-settings dialog → confirm →
//   renderer renders styled HTML into the hidden print webview and sends
//   `mt::response-export` (store/editor.ts EXPORT) →
//   main `handleResponseForExport` → showSaveDialog → webContents.printToPDF →
//   writeFile → `mt::export-success`.
//
// The native save dialog is the only non-headless seam: we stub
// `electron.dialog.showSaveDialog` in the MAIN process to return a temp path,
// then drive the REAL renderer export pipeline. We assert a non-empty file
// beginning with the `%PDF-` magic bytes is written and that `mt::export-success`
// fires back to the renderer. Pixel/layout fidelity stays a manual check.

const PDF_DOC =
  '# Export Smoke\n\n' +
  'First paragraph with **bold** and *italic* text.\n\n' +
  'Second paragraph for a multi-block document.\n\n' +
  '- list item one\n- list item two\n'

// Install a main-process stub for `dialog.showSaveDialog` that returns the
// supplied path (no native picker). Returns nothing; the renderer success
// listener and on-disk polling confirm the rest.
const stubSaveDialog = async(app: ElectronApplication, targetPath: string): Promise<void> => {
  await app.evaluate(async({ dialog }, savePath) => {
    const g = global as unknown as {
      __mt_orig_showSaveDialog__?: typeof dialog.showSaveDialog
    }
    if (!g.__mt_orig_showSaveDialog__) {
      g.__mt_orig_showSaveDialog__ = dialog.showSaveDialog.bind(dialog)
    }
    // Override with a resolved temp path so handleResponseForExport proceeds
    // straight to printToPDF + writeFile.
    ;(dialog as unknown as { showSaveDialog: unknown }).showSaveDialog = async() => ({
      canceled: false,
      filePath: savePath
    })
  }, targetPath)
}

const restoreSaveDialog = async(app: ElectronApplication): Promise<void> => {
  await app.evaluate(({ dialog }) => {
    const g = global as unknown as {
      __mt_orig_showSaveDialog__?: typeof dialog.showSaveDialog
    }
    if (g.__mt_orig_showSaveDialog__) {
      ;(dialog as unknown as { showSaveDialog: unknown }).showSaveDialog =
        g.__mt_orig_showSaveDialog__
    }
  })
}

// Attach a renderer-side listener on `mt::export-success` recording the payload
// into a window global the spec can read back. Mirrors the app's own
// LISTEN_FOR_EXPORT_SUCCESS handler but is observable from the test.
const installExportSuccessProbe = async(page: Page): Promise<void> => {
  await page.evaluate(() => {
    const w = window as unknown as {
      __mt_export_success__?: Array<{ type?: string; filePath?: string }>
      __mt_export_probe_installed__?: boolean
    }
    if (w.__mt_export_probe_installed__) return
    w.__mt_export_probe_installed__ = true
    const sink: Array<{ type?: string; filePath?: string }> = []
    w.__mt_export_success__ = sink
    window.electron.ipcRenderer.on('mt::export-success', (_e: unknown, payload: unknown) => {
      sink.push((payload ?? {}) as { type?: string; filePath?: string })
    })
  })
}

const getExportSuccesses = async(
  page: Page
): Promise<Array<{ type?: string; filePath?: string }>> => {
  return await page.evaluate(() => {
    const w = window as unknown as { __mt_export_success__?: Array<{ type?: string; filePath?: string }> }
    return (w.__mt_export_success__ ?? []).slice()
  })
}

const clearExportSuccesses = async(page: Page): Promise<void> => {
  await page.evaluate(() => {
    const w = window as unknown as { __mt_export_success__?: Array<unknown> }
    if (w.__mt_export_success__) w.__mt_export_success__.length = 0
  })
}

// Drive the real renderer export dialog: send the same IPC the menu item sends
// (`mt::show-export-dialog`), wait for the export-settings dialog to render,
// then click its primary "Export" button. That runs the renderer pipeline that
// renders the print webview and emits `mt::response-export` to main.
const triggerPdfExportViaDialog = async(app: ElectronApplication, page: Page): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::show-export-dialog', 'pdf')
  const confirm = page.locator('.print-settings-dialog .button-primary')
  await confirm.waitFor({ state: 'visible', timeout: 10000 })
  await confirm.click()
}

const pollForPdfFile = async(filePath: string, timeoutMs = 20000): Promise<Buffer> => {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath)
      if (data.length > 0) return data
    }
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`PDF file was not written within ${timeoutMs}ms: ${filePath}`)
}

test.describe('PDF export to a real file (item 231)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown(PDF_DOC)
    app = launched.app
    page = launched.page
    await waitForMenuReady(app)
    await installExportSuccessProbe(page)
  })

  test.afterAll(async() => {
    if (app) {
      await restoreSaveDialog(app)
      await app.close()
    }
  })

  test('writes a non-empty file beginning with the %PDF- magic bytes', async() => {
    const out = '/tmp/marktext-e2e-export-' + Date.now() + '-a.pdf'
    if (fs.existsSync(out)) fs.rmSync(out)
    await clearExportSuccesses(page)
    await stubSaveDialog(app, out)

    await triggerPdfExportViaDialog(app, page)

    const data = await pollForPdfFile(out)
    expect(data.length).toBeGreaterThan(0)
    expect(data.subarray(0, 5).toString('latin1')).toBe('%PDF-')

    fs.rmSync(out, { force: true })
  })

  test('fires mt::export-success with type "pdf" and the written file path', async() => {
    const out = '/tmp/marktext-e2e-export-' + Date.now() + '-b.pdf'
    if (fs.existsSync(out)) fs.rmSync(out)
    await clearExportSuccesses(page)
    await stubSaveDialog(app, out)

    await triggerPdfExportViaDialog(app, page)

    await pollForPdfFile(out)

    await expect
      .poll(async() => (await getExportSuccesses(page)).length, { timeout: 10000 })
      .toBeGreaterThan(0)

    const successes = await getExportSuccesses(page)
    const match = successes.find((s) => s.filePath === out)
    expect(match, 'export-success payload should reference the written path').toBeTruthy()
    expect(match?.type).toBe('pdf')

    fs.rmSync(out, { force: true })
  })

  test('canceling the save dialog writes no file and fires no export-success', async() => {
    const out = '/tmp/marktext-e2e-export-' + Date.now() + '-c.pdf'
    if (fs.existsSync(out)) fs.rmSync(out)
    await clearExportSuccesses(page)
    // Stub the save dialog to report cancellation — main must skip printToPDF.
    await app.evaluate(({ dialog }) => {
      ;(dialog as unknown as { showSaveDialog: unknown }).showSaveDialog = async() => ({
        canceled: true,
        filePath: undefined
      })
    })

    await triggerPdfExportViaDialog(app, page)

    // Give main a generous window to (not) write the file.
    await page.waitForTimeout(2000)

    expect(fs.existsSync(out)).toBe(false)
    const successes = await getExportSuccesses(page)
    expect(successes.find((s) => s.filePath === out)).toBeFalsy()
  })

  test('the renderer EXPORT path round-trips a second export to a fresh path', async() => {
    // Re-export to a different path to prove the print service is re-armed and
    // the wiring is not single-shot.
    const out = '/tmp/marktext-e2e-export-' + Date.now() + '-d.pdf'
    if (fs.existsSync(out)) fs.rmSync(out)
    await clearExportSuccesses(page)
    await stubSaveDialog(app, out)

    await triggerPdfExportViaDialog(app, page)

    const data = await pollForPdfFile(out)
    expect(data.subarray(0, 5).toString('latin1')).toBe('%PDF-')

    await expect
      .poll(async() => (await getExportSuccesses(page)).some((s) => s.filePath === out), {
        timeout: 10000
      })
      .toBe(true)

    fs.rmSync(out, { force: true })
  })
})
