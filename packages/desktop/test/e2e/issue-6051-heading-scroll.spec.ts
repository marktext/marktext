import { expect, test } from '@playwright/test'
import { launchWithMarkdown, makeRoomForOutline, sendIpcToRenderer } from './helpers'

for (const count of [103, 511]) {
  test(`scrolling with ${count} headings reads logarithmically many heading positions`, async() => {
    const markdown = Array.from(
      { length: count },
      (_, index) => `# Section ${index + 1}\n\nBody text for section ${index + 1}.\n`
    ).join('\n')
    const { app, page } = await launchWithMarkdown(markdown, { preferences: { language: 'en' } })
    try {
      await makeRoomForOutline(app, page)
      await expect(page.locator('.mu-container > h1')).toHaveCount(count)
      await expect(page.locator('.side-bar-toc .el-tree-node__label')).toHaveCount(count)

      const reads = await page.locator('.mu-editor').evaluate((container) => {
        const headings = Array.from(container.querySelectorAll<HTMLElement>('.mu-container > h1'))
        let clientRects = 0
        let boundingRects = 0
        for (const heading of headings) {
          const getClientRects = heading.getClientRects.bind(heading)
          const getBoundingClientRect = heading.getBoundingClientRect.bind(heading)
          heading.getClientRects = () => {
            clientRects++
            return getClientRects()
          }
          heading.getBoundingClientRect = () => {
            boundingRects++
            return getBoundingClientRect()
          }
        }
        try {
          container.dispatchEvent(new Event('scroll'))
          return { clientRects, boundingRects }
        } finally {
          for (const heading of headings) {
            delete (heading as Partial<HTMLElement>).getClientRects
            delete (heading as Partial<HTMLElement>).getBoundingClientRect
          }
        }
      })
      expect(reads.boundingRects).toBeGreaterThan(0)
      expect(reads.boundingRects).toBeLessThanOrEqual(Math.ceil(Math.log2(count + 1)))
      expect(reads.clientRects).toBeLessThanOrEqual(Math.ceil(Math.log2(count + 1)))

      for (const section of [Math.floor(count / 2), count - 1, 2]) {
        await page.locator('.mu-editor').evaluate((container, index) => {
          const target = container.querySelectorAll('.mu-container > h1')[index - 1]
          container.scrollTop +=
            target.getBoundingClientRect().top - container.getBoundingClientRect().top - 30
        }, section)
        await expect(
          page.locator('.side-bar-toc .is-current > .el-tree-node__content .el-tree-node__label')
        ).toHaveText(`Section ${section}`)
      }

      await page.locator('.mu-editor').evaluate((container) => {
        const headings = container.querySelectorAll<HTMLElement>('.mu-container > h1')
        headings.forEach((heading, index) => {
          if (index === 0 || index % 2 === 1) heading.style.display = 'none'
        })
      })
      await page.locator('.mu-editor').evaluate((container) => {
        const target = container.querySelectorAll('.mu-container > h1')[2]
        container.scrollTop +=
          target.getBoundingClientRect().top - container.getBoundingClientRect().top - 30
      })
      await expect(
        page.locator('.side-bar-toc .is-current > .el-tree-node__content .el-tree-node__label')
      ).toHaveText('Section 3')

      await sendIpcToRenderer(app, 'language-changed', 'zh-CN')
      await expect(page.locator('.mu-container > h1').first()).toBeVisible()
      await page.locator('.mu-editor').evaluate((container) => {
        const target = container.querySelectorAll('.mu-container > h1')[4]
        container.scrollTop +=
          target.getBoundingClientRect().top - container.getBoundingClientRect().top - 30
      })
      await expect(
        page.locator('.side-bar-toc .is-current > .el-tree-node__content .el-tree-node__label')
      ).toHaveText('Section 5')
    } finally {
      await app.close()
    }
  })
}
