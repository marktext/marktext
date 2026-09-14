import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchElectron } from './helpers'

// #3439 — invoking "New File" (sidebar context menu) on a COLLAPSED folder did
// nothing: the create <input> only renders inside the folder's expanded
// contents, and handleInputFocus guarded the expand behind `if (input.value)`,
// which is null while collapsed — so the folder never expanded and no input
// appeared.

// A collapsed sidebar folder's create-input is visible once the folder expands.
const visibleNewInput = (page: Page): Promise<number> =>
  page.evaluate(
    () =>
      Array.from(
        document.querySelectorAll('.side-bar-folder .folder-contents input.new-input')
      ).filter((el) => (el as HTMLElement).offsetParent !== null).length
  )

test.describe('New File on a collapsed folder (#3439)', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    // launchElectron opens the desktop package folder in the sidebar (its
    // sub-folders render as collapsed tree-folders).
    const launched = await launchElectron()
    app = launched.app
    page = launched.page
    await page.waitForSelector('.side-bar-folder .folder-name', { timeout: 10000 })

    // Replace the sidebar context-menu popup handler so it does NOT open a real
    // native menu (which would hang the headless run); instead resolve the
    // template to the "New File" item and dispatch its click straight back to
    // the renderer, driving the real context-menu → bus → store → tree-folder
    // path.
    await app.evaluate(({ ipcMain }) => {
      const findId = (items: Array<{ id?: string, submenu?: unknown }>): string | null => {
        for (const it of items || []) {
          if (it?.id && String(it.id).startsWith('newFileMenuItem')) return it.id
          if (it?.submenu) {
            const r = findId(it.submenu as Array<{ id?: string }>)
            if (r) return r
          }
        }
        return null
      }
      ipcMain.removeAllListeners('mt::menu::popup')
      ipcMain.on('mt::menu::popup', (event, template) => {
        const id = findId(template as Array<{ id?: string }>)
        if (id) {
          setTimeout(() => {
            try {
              event.sender.send('mt::menu::click', { id })
            } catch { /* window gone */ }
          }, 30)
        }
      })
    })
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the create input appears when New File targets a collapsed folder', async() => {
    // No tree-folder create input is rendered initially.
    expect(await visibleNewInput(page)).toBe(0)

    // Right-click the first (collapsed) sub-folder → sets it active + pops the
    // context menu, which the main-side hook resolves to "New File".
    await page.evaluate(() => {
      const fn = document.querySelector('.side-bar-folder .folder-name') as HTMLElement | null
      if (!fn) throw new Error('no sub-folder in sidebar')
      const r = fn.getBoundingClientRect()
      fn.dispatchEvent(
        new MouseEvent('contextmenu', {
          bubbles: true,
          clientX: r.left + 5,
          clientY: r.top + 5
        })
      )
    })

    // The targeted folder must expand and reveal its create input.
    await expect.poll(() => visibleNewInput(page), { timeout: 6000 }).toBeGreaterThanOrEqual(1)

    await page.keyboard.press('Escape')
  })
})
