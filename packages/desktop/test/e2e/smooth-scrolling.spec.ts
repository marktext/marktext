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
