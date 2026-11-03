import { expect, test } from '@playwright/test'
import { launchWithMarkdown, sendIpcToRenderer } from './helpers'

const TABLE = '| a | b | c | d | e | f |\n| --- | --- | --- | --- | --- | --- |\n| 1 | 2 | 3 | 4 | 5 | 6 |\n'

test('#5974 table column tools do not intercept tab clicks', async() => {
  const { app, page } = await launchWithMarkdown(TABLE, {
    windowLayout: { showTabBar: true, showSideBar: false }
  })
  try {
    const window = await app.browserWindow(page)
    await window.evaluate(win => win.setContentSize(1100, 720))
    for (let i = 0; i < 5; i++) {
      await sendIpcToRenderer(app, 'mt::new-untitled-tab', true, i === 4 ? TABLE : `Document ${i}`)
    }
    await expect(page.locator('.tabs-container > li')).toHaveCount(6)
    const cell = page.locator('.mu-table-cell').first()
    await cell.click()
    await page.evaluate(() => {
      const editor = document.querySelector<HTMLElement>('.editor-component')
      const cell = document.querySelector('.mu-table-cell')
      if (!editor || !cell) throw new Error('The table editor is missing')
      editor.scrollTop += cell.getBoundingClientRect().top - editor.getBoundingClientRect().top - 7
    })
    const cellBox = await cell.boundingBox()
    const tabsBox = await page.locator('.editor-tabs').boundingBox()
    if (!cellBox || !tabsBox) throw new Error('The table or tab bar has no bounds')
    const point = { x: cellBox.x + cellBox.width / 2, y: tabsBox.y + tabsBox.height - 4 }
    const ids = await page.evaluate(({ x, y }) => {
      const tab = Array.from(document.querySelectorAll('.tabs-container > li')).find(el => {
        const rect = el.getBoundingClientRect()
        return x >= rect.left && x < rect.right && y >= rect.top && y < rect.bottom
      })
      return {
        target: tab?.getAttribute('data-id'),
        active: document.querySelector('.tabs-container > li.active')?.getAttribute('data-id')
      }
    }, point)
    expect(ids.target).toBeTruthy()
    expect(ids.target).not.toBe(ids.active)
    if (!ids.target || !ids.active) throw new Error('Expected a different tab under the pointer')

    await page.mouse.move(point.x, cellBox.y - 3)
    const toolbar = page.locator('.mu-table-column-tools-container')
    await expect(toolbar).toHaveCSS('opacity', '1')
    const toolbarBox = await toolbar.boundingBox()
    if (!toolbarBox) throw new Error('The table toolbar has no bounds')
    expect(toolbarBox.y).toBeGreaterThanOrEqual(tabsBox.y + tabsBox.height)
    await page.mouse.move(point.x, point.y)
    await expect(toolbar).toHaveCSS('opacity', '0')
    await page.mouse.down()
    await page.mouse.up()
    await expect(page.locator('.tabs-container > li.active')).toHaveAttribute('data-id', ids.target)

    await page.locator(`.tabs-container > li[data-id="${ids.active}"]`).click()
    await expect(page.locator('.mu-table tr').first().locator('td')).toHaveCount(6)
  } finally {
    await app.close()
  }
})
