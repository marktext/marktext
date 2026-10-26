import { expect, test } from '@playwright/test'
import { launchWithMarkdown, sendIpcToRenderer, expectNoRendererErrors } from './helpers'

test('registered command names and search follow cold and cached language changes', async() => {
  const { app, page } = await launchWithMarkdown('command locale\n', {
    preferences: { language: 'en' },
    suppressErrorDialog: true
  })
  const input = page.locator('.command-palette input.search')
  const titles = page.locator('.command-palette .command-item > .title')
  const open = async() => {
    await sendIpcToRenderer(app, 'mt::show-command-palette')
    await expect(input).toBeVisible()
  }
  const close = async() => {
    await input.press('Escape')
    await expect(input).toBeHidden()
  }
  try {
    await open()
    await expect(titles.filter({ hasText: /^Quick Open$/ })).toHaveCount(1)
    await expect(titles.filter({ hasText: /^Change Encoding$/ })).toHaveCount(1)
    await close()

    for (const locale of ['zh-CN', 'en', 'zh-CN']) {
      await sendIpcToRenderer(app, 'language-changed', locale)
      await sendIpcToRenderer(app, 'mt::user-preference', { language: locale })
      const expected =
        locale === 'en'
          ? [
            'Quick Open',
            'Quick Open Recent',
            'Change Encoding',
            'Change Line Ending',
            'Trailing Newline',
            'Switch Language'
          ]
          : [
            '快速打开',
            '快速打开最近使用',
            '更改编码',
            '更改行结束符',
            '尾随换行',
            '切换拼写检查语言'
          ]
      await expect
        .poll(async() => {
          await open()
          const names = await titles.allTextContents()
          await close()
          return expected.every((name) => names.includes(name))
        })
        .toBe(true)
    }

    await open()
    await input.fill('快速打开')
    // The palette filters on keyup; Space preserves this query after trimming.
    await input.press('Space')
    await expect(titles.filter({ hasText: /^快速打开$/ })).toHaveCount(1)
    await expect(titles.filter({ hasText: /Quick Open/ })).toHaveCount(0)
    await expectNoRendererErrors(app)
  } finally {
    await app.close()
  }
})
