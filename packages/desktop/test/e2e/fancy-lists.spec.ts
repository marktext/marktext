import { expect, test } from '@playwright/test'
import type { Page } from 'playwright'
import { getMarkdownContent, launchWithMarkdown } from './helpers'

const ON = { preferences: { fancyLists: true } }

// Each ordered list as `depth style delimiter`, in document order.
const orderedLists = (page: Page): Promise<string[]> =>
  page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>('.editor-component ol.mu-order-list')].map((list) => {
      let depth = 0
      for (let node = list.parentElement; node; node = node.parentElement) {
        if (node.matches('ol.mu-order-list')) depth++
      }
      return `${depth} ${list.dataset.style ?? 'decimal'} ${list.dataset.delimiter}`
    })
  )

const caretAtEndOf = async(page: Page, text: string): Promise<void> => {
  await page.locator('span.mu-paragraph-content', { hasText: text }).click()
  await page.keyboard.press('End')
}

test('an outline renders as nested typed lists', async() => {
  const { app, page } = await launchWithMarkdown(
    'I.  Introduction\n    A.  Background\n        1. Early work\n\n(a) one\n(b) two\n',
    ON
  )
  try {
    expect(await orderedLists(page)).toEqual([
      '0 upper-roman .',
      '1 upper-alpha .',
      '2 decimal .',
      '0 lower-alpha ()'
    ])
  } finally {
    await app.close()
  }
})

test('Tab moves an item down the outline ladder and Shift+Tab moves it back', async() => {
  const markdown = 'I.  Introduction\n    A.  Background\nII. Method\n'
  const { app, page } = await launchWithMarkdown(markdown, ON)
  try {
    await caretAtEndOf(page, 'Method')
    await page.keyboard.press('Tab')
    expect(await getMarkdownContent(page, app)).toBe(
      'I.  Introduction\n    A.  Background\n    B.  Method\n'
    )

    await caretAtEndOf(page, 'Method')
    await page.keyboard.press('Shift+Tab')
    expect(await getMarkdownContent(page, app)).toBe(markdown)
  } finally {
    await app.close()
  }
})

test('Enter at the end of an outline item starts the next roman item', async() => {
  const { app, page } = await launchWithMarkdown('I.  Introduction\nII. Method\n', ON)
  try {
    await caretAtEndOf(page, 'Method')
    await page.keyboard.press('Enter')
    await page.keyboard.type('Results')
    expect(await getMarkdownContent(page, app)).toBe('I.  Introduction\nII. Method\nIII. Results\n')
  } finally {
    await app.close()
  }
})

test('with the preference off, roman markers stay paragraph text', async() => {
  const markdown = 'I.  Introduction\nII. Method\n'
  const { app, page } = await launchWithMarkdown(markdown)
  try {
    expect(await orderedLists(page)).toEqual([])
    await expect(page.locator('span.mu-paragraph-content', { hasText: 'Introduction' })).toHaveCount(1)
    expect(await getMarkdownContent(page, app)).toBe(markdown)
  } finally {
    await app.close()
  }
})
