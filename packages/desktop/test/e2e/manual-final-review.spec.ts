import { expect, test } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import type { BaseWindow, MessageBoxOptions } from 'electron'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { ApplicationState } from '../../src/shared/types/applicationState'
import { expectNoRendererErrors, launchElectron } from './helpers'

let directory: string
let running: ElectronApplication | null = null
test.beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'mt-manual-review-'))
})
test.afterEach(async() => {
  if (running) await running.close()
  running = null
  rmSync(directory, { recursive: true, force: true })
})

test('renderer reload replays existing workspace files and retains live documents', async() => {
  const root = join(directory, 'workspace')
  const profile = join(directory, 'profile')
  mkdirSync(root)
  const first = join(root, 'first.md')
  writeFileSync(first, '# First file\n')
  writeFileSync(join(root, 'second.md'), '# Second file\n')
  const { app, page } = await launchElectron([root, first], {
    userDataDir: profile,
    preferences: { language: 'en', autoSave: false },
    windowLayout: { showSideBar: true, showTabBar: true },
    suppressErrorDialog: true
  })
  running = app
  await expect(page.locator('.side-bar-file[title$="second.md"]')).toBeVisible()
  await page.getByRole('textbox', { name: 'Document', exact: true }).fill('Live file edits')
  await page.getByRole('button', { name: /^New tab$/i }).click()
  await expect(page.locator('.tabs-container > li')).toHaveCount(2)
  await expect(page.getByRole('textbox', { name: 'Document', exact: true })).not.toContainText(
    'Live file edits'
  )
  await page.getByRole('textbox', { name: 'Document', exact: true }).fill('Live untitled draft')
  const state = (): ApplicationState =>
    JSON.parse(readFileSync(join(profile, 'state', 'application-state.json'), 'utf8'))
  await expect
    .poll(() =>
      state().session.windows[0].documents.every((document) => document.content.kind === 'recovery')
    )
    .toBe(true)
  const before = state().session.windows[0]
  for (let reload = 0; reload < 2; reload++) {
    await page.reload()
    await expect(page.getByRole('textbox', { name: 'Document', exact: true })).toContainText(
      'Live untitled draft'
    )
    await expect(page.locator('.side-bar-file[title$="first.md"]')).toBeVisible()
    await expect(page.locator('.side-bar-file[title$="second.md"]')).toBeVisible()
    expect(state().session.windows[0].documents.map((document) => document.id)).toEqual(
      before.documents.map((document) => document.id)
    )
  }
  writeFileSync(join(root, 'after-reload.md'), '# New watcher event\n')
  await expect(page.locator('.side-bar-file[title$="after-reload.md"]')).toBeVisible()
  await expect(page.locator('.side-bar-file[title$="first.md"]')).toHaveCount(1)
  await expectNoRendererErrors(app)
})

test('close confirmation identifies named files and untitled drafts before canceling', async() => {
  const first = join(directory, 'first.md')
  writeFileSync(first, '# Named file\n')
  const { app, page } = await launchElectron([first], {
    preferences: { language: 'en', autoSave: false },
    windowLayout: { showTabBar: true },
    suppressErrorDialog: true
  })
  running = app
  await page.getByRole('textbox', { name: 'Document', exact: true }).fill('Named dirty body')
  await page.getByRole('button', { name: /^New tab$/i }).click()
  await expect(page.locator('.tabs-container > li')).toHaveCount(2)
  await expect(page.getByRole('textbox', { name: 'Document', exact: true })).not.toContainText(
    'Named dirty body'
  )
  await page.getByRole('textbox', { name: 'Document', exact: true }).fill('Untitled dirty body')
  const draft = await page.locator('.tabs-container > li').last().getAttribute('aria-label')
  await app.evaluate(({ dialog }) => {
    dialog.showMessageBox = async(
      windowOrOptions: BaseWindow | MessageBoxOptions,
      options?: MessageBoxOptions
    ) => {
      const configuration = (options ?? windowOrOptions) as MessageBoxOptions
      const audit = globalThis as unknown as { closeDetail: string }
      audit.closeDetail = configuration.detail ?? ''
      return { response: 2, checkboxChecked: false }
    }
  })
  await page.evaluate(() => {
    const root = document.querySelector('#app') as Element & {
      __vue_app__: {
        config: { globalProperties: { $pinia: { _s: Map<string, { CLOSE_ALL_TABS(): void }> } } }
      }
    }
    root.__vue_app__.config.globalProperties.$pinia._s.get('editor')?.CLOSE_ALL_TABS()
  })
  await expect
    .poll(() => app.evaluate(() => (globalThis as unknown as { closeDetail: string }).closeDetail))
    .toContain(first)
  const detail = await app.evaluate(
    () => (globalThis as unknown as { closeDetail: string }).closeDetail
  )
  expect(detail).toContain(draft)
  await expect(page.locator('.tabs-container > li')).toHaveCount(2)
})
