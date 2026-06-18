import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { enterSourceMode, launchWithMarkdown } from './helpers'

const FIXTURE = [
  '# Document title',
  '',
  'Paragraph 01',
  '',
  '### Section One',
  '',
  'Section body',
  '',
  '### Section Two',
  '',
  'More body',
  ''
].join('\n')

const getHeadingRect = async(page: Page, text: string) => {
  return page.evaluate((headingText) => {
    const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .find((el) => el.textContent && el.textContent.includes(headingText))
    if (!heading) throw new Error('Heading not found: ' + headingText)

    const rect = heading.getBoundingClientRect()
    return {
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height
    }
  }, text)
}

const getHeadingChevronDisplay = async(page: Page, text: string): Promise<string> => {
  return page.evaluate((headingText) => {
    const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5, h6'))
      .find((el) => el.textContent && el.textContent.includes(headingText))
    const chevron = heading && heading.querySelector('.ag-front-icon')
    return chevron ? window.getComputedStyle(chevron).display : ''
  }, text)
}

const findSourceLine = async(page: Page, text: string): Promise<number> => {
  return page.evaluate((targetText) => {
    const root = document.querySelector('.source-code .CodeMirror') as
      | (Element & {
        CodeMirror?: {
          firstLine(): number
          lastLine(): number
          getLine(line: number): string
        }
      })
      | null
    const cm = root && root.CodeMirror
    if (!cm) throw new Error('CodeMirror not ready')

    for (let line = cm.firstLine(); line <= cm.lastLine(); line += 1) {
      if (cm.getLine(line).includes(targetText)) return line
    }
    throw new Error('Source line not found: ' + targetText)
  }, text)
}

const getSourceChevronOpacity = async(page: Page, line: number): Promise<string> => {
  return page.evaluate((targetLine) => {
    const root = document.querySelector('.source-code .CodeMirror') as
      | (Element & {
        CodeMirror?: {
          lineInfo(line: number): { gutterMarkers?: Record<string, HTMLElement> }
        }
      })
      | null
    const marker = root && root.CodeMirror
      ? root.CodeMirror.lineInfo(targetLine).gutterMarkers?.['CodeMirror-foldgutter']
      : null
    return marker ? window.getComputedStyle(marker).opacity : ''
  }, line)
}

const moveMouseToSourceTextLine = async(page: Page, line: number): Promise<void> => {
  const point = await page.evaluate((targetLine) => {
    const root = document.querySelector('.source-code .CodeMirror') as
      | (Element & {
        CodeMirror?: {
          charCoords(pos: { line: number; ch: number }, mode: 'window'): {
            left: number
            right: number
            top: number
            bottom: number
          }
        }
      })
      | null
    const cm = root && root.CodeMirror
    if (!cm) throw new Error('CodeMirror not ready')

    const coords = cm.charCoords({ line: targetLine, ch: 2 }, 'window')
    return {
      x: coords.right + 8,
      y: (coords.top + coords.bottom) / 2
    }
  }, line)
  await page.mouse.move(point.x, point.y)
}

const moveMouseToSourceLineGutter = async(page: Page, line: number): Promise<void> => {
  const point = await page.evaluate((targetLine) => {
    const root = document.querySelector('.source-code .CodeMirror') as
      | (Element & {
        CodeMirror?: {
          lineInfo(line: number): { gutterMarkers?: Record<string, HTMLElement> }
        }
      })
      | null
    const marker = root && root.CodeMirror
      ? root.CodeMirror.lineInfo(targetLine).gutterMarkers?.['CodeMirror-foldgutter']
      : null
    if (!marker) throw new Error('Fold gutter marker not found')

    const markerRect = marker.getBoundingClientRect()
    return {
      x: markerRect.right + 18,
      y: (markerRect.top + markerRect.bottom) / 2
    }
  }, line)
  await page.mouse.move(point.x, point.y)
}

test.describe('Heading fold chevrons', () => {
  test('WYSIWYG headings show fold chevrons on focus and hover', async() => {
    const { app, page } = await launchWithMarkdown(FIXTURE)
    try {
      await page.locator('.editor-component p', { hasText: 'Paragraph 01' }).click()
      await page.mouse.move(5, 5)
      await expect.poll(() => getHeadingChevronDisplay(page, 'Section One')).toBe('none')

      const headingRect = await getHeadingRect(page, 'Section One')
      await page.mouse.move(headingRect.left + headingRect.width / 2, headingRect.top + headingRect.height / 2)
      await expect.poll(() => getHeadingChevronDisplay(page, 'Section One')).toBe('block')

      await page.mouse.move(headingRect.left - 80, headingRect.top + headingRect.height / 2)
      await expect.poll(() => getHeadingChevronDisplay(page, 'Section One')).toBe('block')

      await page.locator('.editor-component h3', { hasText: 'Section Two' }).click()
      await page.mouse.move(5, 5)
      await expect.poll(() => getHeadingChevronDisplay(page, 'Section Two')).toBe('block')
    } finally {
      await app.close()
    }
  })

  test('source headings show fold chevrons on focus and stable line hover', async() => {
    const { app, page } = await launchWithMarkdown(FIXTURE)
    try {
      await enterSourceMode(page, app)
      const line = await findSourceLine(page, '### Section One')

      await page.evaluate((targetLine) => {
        const root = document.querySelector('.source-code .CodeMirror') as
          | (Element & {
            CodeMirror?: {
              focus(): void
              setCursor(line: number, ch: number): void
            }
          })
          | null
        const cm = root && root.CodeMirror
        if (!cm) throw new Error('CodeMirror not ready')
        cm.setCursor(0, 0)
        cm.focus()
        if (targetLine === 0) throw new Error('Fixture heading unexpectedly on first line')
      }, line)
      await page.mouse.move(5, 5)
      await expect.poll(() => getSourceChevronOpacity(page, line)).toBe('0')

      await page.evaluate((targetLine) => {
        const root = document.querySelector('.source-code .CodeMirror') as
          | (Element & {
            CodeMirror?: {
              focus(): void
              setCursor(line: number, ch: number): void
            }
          })
          | null
        const cm = root && root.CodeMirror
        if (!cm) throw new Error('CodeMirror not ready')
        cm.setCursor(targetLine, 0)
        cm.focus()
      }, line)
      await expect.poll(() => getSourceChevronOpacity(page, line)).toBe('1')

      await page.evaluate(() => {
        const root = document.querySelector('.source-code .CodeMirror') as
          | (Element & {
            CodeMirror?: {
              focus(): void
              setCursor(line: number, ch: number): void
            }
          })
          | null
        const cm = root && root.CodeMirror
        if (!cm) throw new Error('CodeMirror not ready')
        cm.setCursor(0, 0)
        cm.focus()
      })
      await moveMouseToSourceTextLine(page, line)
      await expect.poll(() => getSourceChevronOpacity(page, line)).toBe('1')

      await moveMouseToSourceLineGutter(page, line)
      await expect.poll(() => getSourceChevronOpacity(page, line)).toBe('1')
    } finally {
      await app.close()
    }
  })
})
