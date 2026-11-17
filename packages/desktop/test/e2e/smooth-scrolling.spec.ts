import { expect, test } from '@playwright/test'
import type { Page } from 'playwright'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { enterSourceMode, expectNoRendererErrors, launchWithMarkdown } from './helpers'

const probeWheel = (page: Page) => page.evaluate(() => {
  const container = document.createElement('div')
  container.style.cssText = 'height: 100px; width: 200px; overflow: auto'
  const content = document.createElement('div')
  content.style.height = '1000px'
  container.append(content)
  document.body.append(container)
  const event = new WheelEvent('wheel', { deltaY: 120, bubbles: true, cancelable: true })
  content.dispatchEvent(event)
  const result = { prevented: event.defaultPrevented, top: container.scrollTop }
  container.remove()
  return result
})

test('smooth scrolling is a searchable, live preference shared by existing windows', async() => {
  const { app, page } = await launchWithMarkdown('# Smooth scrolling\n', {
    preferences: { language: 'en' }, suppressErrorDialog: true
  })
  try {
    expect(await probeWheel(page)).toEqual({ prevented: false, top: 0 })
    expect(await app.evaluate(({ app, Menu }) => ({
      startupFlag: app.commandLine.hasSwitch('disable-smooth-scrolling'),
      menuItem: !!Menu.getApplicationMenu()?.getMenuItemById('smoothScrollingMenuItem')
    }))).toEqual({ startupFlag: false, menuItem: false })

    const newWindow = app.waitForEvent('window')
    await page.evaluate(() => window.electron.ipcRenderer.send('app-create-editor-window'))
    const second = await newWindow
    await expect(second.getByRole('textbox', { name: 'Document', exact: true })).toBeVisible()

    const settingsWindow = app.waitForEvent('window')
    await page.evaluate(() => window.electron.ipcRenderer.send('mt::open-setting-window'))
    const settings = await settingsWindow
    await settings.locator('.pref-sidebar input').fill('smoothScrolling')
    await settings.locator('.pref-autocomplete li').first().click()
    const control = settings.locator('#setting-smoothScrolling')
    await expect(control).toBeFocused()
    const toggle = control.getByRole('switch')
    await expect(toggle).toBeChecked()
    await toggle.locator('..').click()
    await expect(toggle).not.toBeChecked()
    for (const editor of [page, second]) {
      await expect.poll(() => probeWheel(editor)).toEqual({ prevented: true, top: 120 })
    }
    const directory = await app.evaluate(({ app }) => app.getPath('userData'))
    await expect.poll(() => JSON.parse(readFileSync(join(directory, 'preferences.json'), 'utf8')).smoothScrolling).toBe(false)

    await toggle.locator('..').click()
    for (const editor of [page, second]) {
      await expect.poll(() => probeWheel(editor)).toEqual({ prevented: false, top: 0 })
    }
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

test('a saved disabled preference immediately scrolls a real wheel event without a startup flag', async() => {
  const markdown = Array.from({ length: 100 }, (_, index) => `Paragraph ${index + 1}.`).join('\n\n')
  const { app, page } = await launchWithMarkdown(markdown, {
    preferences: { language: 'en', smoothScrolling: false }, suppressErrorDialog: true
  })
  try {
    expect(await app.evaluate(({ app }) => app.commandLine.hasSwitch('disable-smooth-scrolling'))).toBe(false)
    await expect.poll(() => probeWheel(page)).toEqual({ prevented: true, top: 120 })
    await page.evaluate(() => {
      const container = document.createElement('div')
      container.id = 'wheel-test'
      container.style.cssText = 'position:fixed;left:40px;top:150px;height:200px;width:200px;overflow:auto;z-index:99999'
      const content = document.createElement('div')
      content.style.cssText = 'height:2000px;background:white'
      container.append(content)
      document.body.append(container)
      window.addEventListener('wheel', event => {
        container.dataset.trusted = String(event.isTrusted)
        container.dataset.prevented = String(event.defaultPrevented)
        container.dataset.positionDuringEvent = String(container.scrollTop)
      }, { once: true })
    })
    await page.locator('#wheel-test').hover()
    await page.mouse.wheel(0, 120)
    await expect(page.locator('#wheel-test')).toHaveAttribute('data-trusted', 'true')
    await expect(page.locator('#wheel-test')).toHaveAttribute('data-prevented', 'true')
    await expect(page.locator('#wheel-test')).toHaveAttribute('data-position-during-event', '120')
    await page.locator('#wheel-test').evaluate(element => element.remove())

    for (const selector of ['.editor-component', '.source-code']) {
      if (selector === '.source-code') await enterSourceMode(page, app)
      const editor = page.locator(selector)
      await editor.evaluate(element => { element.scrollTop = 0 })
      const bounds = await editor.boundingBox()
      if (!bounds) throw new Error(`Missing scroll container: ${selector}`)
      await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
      await page.mouse.wheel(0, 120)
      await expect.poll(() => editor.evaluate(element => element.scrollTop)).toBe(120)
    }
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})

for (const direction of ['vertical', 'horizontal', 'rtl'] as const) {
  test(`fractional ${direction} scroll boundaries pass wheel input to the parent`, async() => {
    const { app, page } = await launchWithMarkdown('# Fractional scroll boundary\n', {
      preferences: { language: 'en', smoothScrolling: false }, suppressErrorDialog: true
    })
    try {
      await expect.poll(() => probeWheel(page)).toEqual({ prevented: true, top: 120 })
      const initial = await page.evaluate(direction => {
        const vertical = direction === 'vertical'
        const outer = document.createElement('div')
        outer.id = 'fractional-outer'
        // Zoom exposes fractional scroll limits even on displays with integer scaling.
        outer.style.cssText = 'position:fixed;left:40px;top:100px;width:250px;height:200px;overflow:auto;zoom:2;z-index:99999;background:white'
        if (direction === 'rtl') outer.style.direction = 'rtl'
        const inner = document.createElement('div')
        inner.id = 'fractional-inner'
        inner.style.cssText = `width:${vertical ? '150px' : '100.25px'};height:${vertical ? '100.25px' : '80px'};overflow-x:${vertical ? 'hidden' : 'auto'};overflow-y:${vertical ? 'auto' : 'hidden'}`
        const content = document.createElement('div')
        content.style.cssText = `width:${vertical ? '100px' : '1000px'};height:${vertical ? '1000px' : '40px'}`
        inner.append(content)
        const spacer = document.createElement('div')
        spacer.style.cssText = 'width:1000px;height:1000px'
        outer.append(inner, spacer)
        document.body.append(outer)
        const sign = direction === 'rtl' ? -1 : 1
        inner.scrollTo({ [vertical ? 'top' : 'left']: sign * 1e6, behavior: 'instant' })
        const maximum = vertical ? inner.scrollHeight - inner.clientHeight : inner.scrollWidth - inner.clientWidth
        const position = vertical ? inner.scrollTop : inner.scrollLeft
        let count = 0
        window.addEventListener('wheel', event => {
          outer.dataset.lastWheel = JSON.stringify({
            count: ++count,
            trusted: event.isTrusted,
            prevented: event.defaultPrevented,
            inner: vertical ? inner.scrollTop : inner.scrollLeft,
            outer: vertical ? outer.scrollTop : outer.scrollLeft
          })
        })
        return { maximum, position, sign, devicePixelRatio }
      }, direction)
      const roundingGap = initial.maximum - Math.abs(initial.position)
      expect(roundingGap, JSON.stringify(initial)).toBeGreaterThan(0)
      expect(roundingGap).toBeLessThanOrEqual(1)

      for (let attempt = 1; attempt <= 3; attempt++) {
        await page.locator('#fractional-outer').evaluate(element => element.scrollTo({ top: 0, left: 0, behavior: 'instant' }))
        await page.locator('#fractional-inner').hover()
        await page.mouse.wheel(direction === 'vertical' ? 0 : initial.sign * 120, direction === 'vertical' ? 120 : 0)
        await expect.poll(async() => {
          const data = await page.locator('#fractional-outer').getAttribute('data-last-wheel')
          return data ? JSON.parse(data).count : 0
        }).toBe(attempt)
        const wheel = JSON.parse(await page.locator('#fractional-outer').getAttribute('data-last-wheel') ?? '{}')
        expect(wheel.trusted).toBe(true)
        expect(wheel.prevented).toBe(true)
        expect(wheel.inner).toBe(initial.position)
        expect(wheel.outer * initial.sign, JSON.stringify({ initial, attempt, wheel })).toBeGreaterThan(0)
      }
      await expectNoRendererErrors(app)
    } finally {
      await app.close()
    }
  })
}
