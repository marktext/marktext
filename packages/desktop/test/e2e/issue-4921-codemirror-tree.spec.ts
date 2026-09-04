import { expect, test } from '@playwright/test'
import type { ElectronApplication } from 'playwright'
import {
  clearRendererErrors,
  enterSourceMode,
  launchWithMarkdown,
  sendIpcToRenderer,
  waitForRendererError
} from './helpers'

const BASH_SCRIPT = `#!/usr/bin/env bash

type_slowly() {
  local text="$1"
  local pause_after="$2"
  local pause_clear="$3"
  local i

  printf '\\n'

  for ((i = 0; i < \${#text}; i++)); do
    printf '%s' "\${text:i:1}"
    sleep 0.1
  done

  sleep "$pause_after"
  clear
  sleep "$pause_clear"
}

matrix() {
  clear
  type_slowly "Wake up, Neo..." 2 1
  type_slowly "The Matrix has you" 3 1
  type_slowly "Follow the white rabbit." 2 2
  type_slowly "Knock, knock, Neo." 4 3
}

matrix
`

const reportExternalChange = async(
  app: ElectronApplication,
  pathname: string,
  markdown: string
): Promise<void> => {
  await sendIpcToRenderer(app, 'mt::update-file', {
    type: 'change',
    change: {
      pathname,
      mtimeMs: 1,
      data: {
        markdown,
        filename: 'note.md',
        pathname,
        encoding: { encoding: 'utf8', hasBOM: false },
        lineEnding: 'lf',
        adjustLineEndingOnSave: false,
        trimTrailingNewline: 1,
        isMixedLineEndings: false
      }
    }
  })
}

test('Issue #4921: source-mode updates preserve CodeMirror line-tree identity', async() => {
  const { app, page, filePath } = await launchWithMarkdown('initial\n', {
    suppressErrorDialog: true
  })

  try {
    await sendIpcToRenderer(app, 'mt::user-preference', { autoSave: true })
    await page.waitForTimeout(100)
    await enterSourceMode(page, app)
    await clearRendererErrors(app)

    const updatedMarkdown = BASH_SCRIPT.repeat(3)
    await reportExternalChange(app, filePath, updatedMarkdown)
    await expect
      .poll(() =>
        page.evaluate(() => {
          const wrapper = document.querySelector('.source-code .CodeMirror') as
            | (Element & { CodeMirror?: { getValue(): string } })
            | null
          return wrapper?.CodeMirror?.getValue() ?? ''
        })
      )
      .toBe(updatedMarkdown)

    const result = await page.evaluate((bashScript) => {
      interface LeafChunk {
        parent: DocumentChunk
        lines: Array<{ parent: LeafChunk }>
      }
      interface DocumentChunk {
        children: LeafChunk[]
      }
      interface CodeMirrorInternal {
        doc: DocumentChunk
        focus(): void
        getInputField(): HTMLTextAreaElement
        getValue(): string
      }

      const wrapper = document.querySelector('.source-code .CodeMirror') as
        | (Element & { CodeMirror?: CodeMirrorInternal })
        | null
      const cm = wrapper?.CodeMirror
      if (!cm) return false

      cm.focus()
      const beforePaste = cm.getValue()
      const clipboardData = new DataTransfer()
      clipboardData.setData('Text', bashScript)
      cm.getInputField().dispatchEvent(
        new ClipboardEvent('paste', { clipboardData, bubbles: true, cancelable: true })
      )

      const { doc } = cm
      const lineTreeIntact = doc.children.every(
        (leaf) => leaf.parent === doc && leaf.lines.every((line) => line.parent === leaf)
      )
      return { lineTreeIntact, pasteApplied: cm.getValue() !== beforePaste }
    }, BASH_SCRIPT)

    expect(result).toEqual({ lineTreeIntact: true, pasteApplied: true })
    const rendererError = await waitForRendererError(app, () => true, 1000)
    expect(rendererError).toBeNull()
  } finally {
    await app.close()
  }
})
