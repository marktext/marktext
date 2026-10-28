import { expect, test } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { launchElectron, sendIpcToRenderer } from './helpers'

for (const target of ['session', 'file'] as const) {
  test(`#5412: hidden sidebar remains hidden when reopening ${target}`, async() => {
    const directory = mkdtempSync(join(tmpdir(), 'mt-sidebar-reopen-'))
    const profile = join(directory, 'profile')
    const file = join(directory, 'document.md')
    const state = () =>
      JSON.parse(readFileSync(join(profile, 'state', 'application-state.json'), 'utf8'))
    writeFileSync(file, 'Single document sidebar restoration')
    let running: ElectronApplication | null = null
    try {
      const first = await launchElectron([file], {
        userDataDir: profile,
        preferences: { language: 'en', restoreLayoutState: true, startUpAction: 'restoreAll' },
        suppressErrorDialog: true
      })
      running = first.app
      await sendIpcToRenderer(first.app, 'mt::set-view-layout', { showSideBar: true })
      await expect(first.page.locator('.side-bar')).toBeVisible()
      await sendIpcToRenderer(first.app, 'mt::set-view-layout', { showSideBar: false })
      await expect(first.page.locator('.side-bar')).toBeHidden()
      await expect.poll(() => state().session.windows[0].layout.sidebar.visible).toBe(false)
      const previousId = state().session.windows[0].id
      const closed = first.app.waitForEvent('close')
      await first.app.evaluate(({ app }) => app.quit()).catch(() => {})
      await closed
      running = null
      const reopened = await launchElectron(target === 'session' ? [] : [file], {
        userDataDir: profile,
        suppressErrorDialog: true
      })
      running = reopened.app
      await expect(
        reopened.page.getByRole('textbox', { name: 'Document', exact: true })
      ).toContainText('Single document sidebar restoration')
      await expect(reopened.page.locator('.side-bar')).toBeHidden()
      expect(state().session.windows[0].layout.sidebar.visible).toBe(false)
      if (target === 'session') expect(state().session.windows[0].id).toBe(previousId)
      else expect(state().session.windows[0].id).not.toBe(previousId)
    } finally {
      if (running) await running.close()
      rmSync(directory, { recursive: true, force: true })
    }
  })
}
