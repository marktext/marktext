import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, makeRoomForOutline, sendIpcToRenderer } from './helpers'

// #4997: icon-only controls must have an accessible name, be reachable and
// operable from the keyboard, and show their label on hover. These drive the
// real built app the way a keyboard or screen reader user would.

const PREFERENCES = {
  sideBarVisibility: true,
  tabBarVisibility: true,
  language: 'en',
  theme: 'light',
  followSystemTheme: false
}
const HOVER_DELAY = process.platform === 'darwin' ? 1500 : 500

const activeLabel = (page: Page) =>
  page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? null)

// Presses Tab from the top of the document until the control named `label` is
// focused, which proves it is in the tab order rather than merely focusable.
const tabTo = async(page: Page, label: string, maxPresses = 40): Promise<void> => {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  for (let i = 0; i < maxPresses; i++) {
    await page.keyboard.press('Tab')
    if ((await activeLabel(page)) === label) return
  }
  throw new Error(`Tab never reached "${label}"`)
}

const tooltip = (page: Page, text: string) =>
  page.locator('.el-popper[role="tooltip"]', { hasText: text })

test.describe('#4997 icon-only controls in the editor window', () => {
  let app: ElectronApplication
  let page: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Doc\n\nneedle\n', { preferences: PREFERENCES })
    app = launched.app
    page = launched.page
    await makeRoomForOutline(app, page)
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  test('the sidebar actions are named and the outline reports its expanded state', async() => {
    for (const name of ['Search', 'Settings']) {
      await expect(page.getByRole('button', { name, exact: true })).toBeVisible()
    }
    const outline = page.getByRole('button', { name: 'Collapse table of contents', exact: true })
    await expect(outline).toBeVisible()
    await expect(outline).toHaveAttribute('aria-expanded', 'true')
    await expect(outline).toHaveAttribute('aria-controls', 'document-outline-tree')
  })

  // el-tooltip calls preventDefault on Enter/Space keydown of its trigger, which
  // cancels the wrapped button's click unless the tooltip leaves those keys alone.
  test('Enter and Space activate a button wrapped in a tooltip', async() => {
    const search = page.getByRole('button', { name: 'Search', exact: true })
    await search.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('.side-bar-search')).toBeVisible()

    const files = page.getByRole('button', { name: 'Back to files', exact: true })
    await files.focus()
    await page.keyboard.press('Space')
    await expect(page.locator('.side-bar .tree-view')).toBeVisible()
  })

  test('a brief hover does not show a tooltip or leave one scheduled after moving away', async() => {
    await page.bringToFront()
    const toc = page.getByRole('button', { name: 'Collapse table of contents', exact: true })
    await toc.hover()
    // Sample after the old 300ms delay but before either platform's new delay.
    await page.waitForTimeout(350)
    await expect(tooltip(page, 'Collapse table of contents')).toBeHidden()
    await page.mouse.move(0, 0)
    await page.waitForTimeout(HOVER_DELAY + 100)
    await expect(tooltip(page, 'Collapse table of contents')).toBeHidden()
  })

  test('hovering shows the label as a tooltip and Escape dismisses it', async() => {
    // Hover events only reach the page while its window is in front.
    await page.bringToFront()
    const toc = page.getByRole('button', { name: 'Collapse table of contents', exact: true })
    await toc.hover()
    await expect(tooltip(page, 'Collapse table of contents')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(tooltip(page, 'Collapse table of contents')).toBeHidden()
    await page.mouse.move(0, 0)
  })

  test('an open tooltip follows live theme changes without a speech-bubble arrow', async() => {
    await page.bringToFront()
    const search = page.getByRole('button', { name: 'Search', exact: true })
    await search.hover()
    const popper = tooltip(page, 'Search')
    await expect(popper).toBeVisible()
    await expect(popper.locator('.el-popper__arrow')).toHaveCount(0)

    const themeStyle = page.locator('#ag-theme')
    const lightThemeStyle = await themeStyle.textContent()
    try {
      for (const theme of [
        'light',
        'dark',
        'ayu-light',
        'one-dark',
        'solarized-light',
        'solarized-dark',
        'ulysses'
      ]) {
        const previousStyle = await themeStyle.textContent()
        await page.evaluate((theme) => {
          window.electron.ipcRenderer.send('mt::set-user-preference', { theme })
        }, theme)
        if (theme !== 'light')
          await expect.poll(() => themeStyle.textContent()).not.toBe(previousStyle)
        await expect(popper).toBeVisible()
        await expect
          .poll(() =>
            popper.evaluate((el) => {
              const probe = document.createElement('div')
              probe.style.backgroundColor = 'var(--floatBgColor)'
              const tint = document.body.classList.contains('dark') ? '#fff' : '#000'
              probe.style.color = `color-mix(in srgb, var(--sideBarTitleColor) 75%, ${tint})`
              probe.style.border = '1px solid var(--floatBorderColor)'
              probe.style.boxShadow = 'var(--floatShadow)'
              document.body.append(probe)
              const actual = getComputedStyle(el)
              const expected = getComputedStyle(probe)
              const matches = ['backgroundColor', 'color', 'borderTopColor', 'boxShadow'].every(
                (property) =>
                  actual[property as keyof CSSStyleDeclaration] ===
                  expected[property as keyof CSSStyleDeclaration]
              )
              probe.remove()
              return matches
            })
          )
          .toBe(true)
      }
    } finally {
      await page.keyboard.press('Escape')
      await page.mouse.move(0, 0)
      await page.evaluate(() => {
        window.electron.ipcRenderer.send('mt::set-user-preference', { theme: 'light' })
      })
      await expect.poll(() => themeStyle.textContent()).toBe(lightThemeStyle)
    }
  })

  // An open el-tooltip sets the trigger's aria-describedby, which would make
  // screen readers repeat the label after the name.
  test('keyboard focus does not open the tooltip', async() => {
    await tabTo(page, 'Collapse table of contents')
    await page.waitForTimeout(HOVER_DELAY + 100)
    await expect(tooltip(page, 'Collapse table of contents')).toBeHidden()
    expect(
      await page.evaluate(() => document.activeElement?.getAttribute('aria-describedby') ?? null)
    ).toBeNull()
  })

  test('focused icon buttons draw a visible focus ring', async() => {
    await tabTo(page, 'Search')
    const outline = await page.evaluate(() => {
      const style = getComputedStyle(document.activeElement as Element)
      return { style: style.outlineStyle, width: parseFloat(style.outlineWidth) }
    })
    expect(outline.style).toBe('solid')
    expect(outline.width).toBeGreaterThanOrEqual(2)
  })

  test('the tab strip buttons are in the tab order and named after their file', async() => {
    const tabs = page.locator('.editor-tabs .tabs-container > li')
    const before = await tabs.count()
    const filename = (await tabs.first().locator('span').first().textContent())?.trim()

    await expect(
      page.locator('.editor-tabs').getByRole('button', { name: `Close ${filename}` })
    ).toHaveCount(1)

    await tabTo(page, 'New Tab')
    await page.keyboard.press('Enter')
    await expect(tabs).toHaveCount(before + 1)
  })

  test('the find bar toggles report their state and the buttons are named', async() => {
    await sendIpcToRenderer(app, 'mt::editor-edit-action', 'replace')
    const bar = page.locator('.search-bar')
    await expect(bar).toBeVisible()

    for (const name of ['Find Previous', 'Find Next', 'Replace All', 'Replace Single']) {
      await expect(bar.getByRole('button', { name, exact: true })).toBeVisible()
    }
    await expect(bar.getByRole('button', { name: 'Replace', exact: true })).toHaveAttribute(
      'aria-expanded',
      'true'
    )

    const caseToggle = bar.getByRole('button', { name: 'Case Sensitive' })
    await expect(caseToggle).toHaveAttribute('aria-pressed', 'false')
    await caseToggle.focus()
    await page.keyboard.press('Space')
    await expect(caseToggle).toHaveAttribute('aria-pressed', 'true')
    await expect(caseToggle).toHaveClass(/active/)

    await page.keyboard.press('Escape')
    await expect(bar).toBeHidden()
  })

  test('the window controls are named and ordered left to right', async() => {
    test.skip(process.platform === 'darwin', 'macOS keeps the native traffic lights')
    const labels = await page
      .locator('.window-controls button')
      .evaluateAll((els) => els.map((el) => el.getAttribute('aria-label')))
    expect(labels).toEqual(['Minimize', expect.stringMatching(/^(Maximize|Restore)$/), 'Close'])
    await expect(page.getByRole('button', { name: 'Application Menu' })).toHaveAttribute(
      'aria-haspopup',
      'menu'
    )
  })
})

test.describe('#4997 form controls in the Preferences window', () => {
  let app: ElectronApplication
  let prefs: Page

  test.beforeAll(async() => {
    const launched = await launchWithMarkdown('# Doc\n', { preferences: PREFERENCES })
    app = launched.app
    const opened = app.waitForEvent('window')
    await launched.page.getByRole('button', { name: 'Settings', exact: true }).click()
    prefs = await opened
    await prefs.waitForSelector('.pref-sidebar .category')
  })

  test.afterAll(async() => {
    if (app) await app.close()
  })

  // Element Plus's autocomplete also puts role="combobox" on a wrapper <div> it
  // gives no way to label; only the controls that take focus are checked.
  const CATEGORIES = ['general', 'editor', 'markdown', 'spelling', 'theme', 'image', 'keybindings']
  for (const category of CATEGORIES) {
    test(`every focusable control on the ${category} page has a name`, async() => {
      await prefs.evaluate((c) => {
        window.location.hash = `#/preference/${c}`
      }, category)
      await prefs.waitForSelector(`.pref-${category === 'spelling' ? 'spellchecker' : category}`)
      // Element Plus renders the switch's native input at zero size, so only
      // controls inside a `display: none` subtree are skipped.
      const controls = prefs
        .locator('.pref-setting')
        .locator('input:not([type="hidden"]), textarea, button, [role="slider"]')
      let checked = 0
      for (let i = 0; i < (await controls.count()); i++) {
        const control = controls.nth(i)
        if (!(await control.evaluate((el) => el.checkVisibility()))) continue
        await expect(control).toHaveAccessibleName(/\S/)
        checked++
      }
      expect(checked).toBeGreaterThan(0)
    })
  }

  test('the "learn more" links are named after their setting', async() => {
    await prefs.evaluate(() => {
      window.location.hash = '#/preference/markdown'
    })
    const links = prefs.getByRole('button', { name: /^Learn more about / })
    await expect(links.first()).toBeVisible()
    expect(await links.count()).toBeGreaterThan(5)
  })
})
