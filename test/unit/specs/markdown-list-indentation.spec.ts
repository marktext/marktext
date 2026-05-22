import { describe, it, expect } from 'vitest'
import ContentState from 'muya/lib/contentState'
import EventCenter from 'muya/lib/eventHandler/event'
import ExportMarkdown from 'muya/lib/utils/exportMarkdown'
import { MUYA_DEFAULT_OPTION } from 'muya/lib/config'

interface MuyaCtx {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  options: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  eventCenter: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  contentState: any
}

const createMuyaContext = (listIndentation: number | string): MuyaCtx => {
  const ctx = {} as MuyaCtx
  ctx.options = Object.assign({}, MUYA_DEFAULT_OPTION, { listIndentation })
  ctx.eventCenter = new EventCenter()
  ctx.contentState = new ContentState(ctx, ctx.options)
  return ctx
}

// ----------------------------------------------------------------------------
// Muya parser (Markdown to HTML to Markdown)
//

const verifyMarkdown = (
  expectedMarkdown: string,
  listIndentation: number | string,
  markdown = ''
): void => {
  if (!markdown) {
    markdown = `start

- foo
- foo
  - foo
  - foo
    - foo
    - foo
      - foo
  - foo
- foo

sep

1. foo
2. foo
   1. foo
   2. foo
      1. foo
   3. foo
3. foo
   20. foo
       141. foo
            1. foo
`
  }

  const ctx = createMuyaContext(listIndentation)
  ctx.contentState.importMarkdown(markdown)

  const blocks = ctx.contentState.getBlocks()
  const exportedMarkdown = new ExportMarkdown(blocks, listIndentation).generate()
  expect(exportedMarkdown).to.equal(expectedMarkdown)
}

describe('Muya list indentation', () => {
  it('Indent by 1 space', () => {
    const md = `start

- foo
- foo
  - foo
  - foo
    - foo
    - foo
      - foo
  - foo
- foo

sep

1. foo
2. foo
   1. foo
   2. foo
      1. foo
   3. foo
3. foo
   20. foo
       141. foo
            1. foo
`
    verifyMarkdown(md, 1)
  })
  it('Indent by 2 spaces', () => {
    const md = `start

- foo
- foo
   - foo
   - foo
      - foo
      - foo
         - foo
   - foo
- foo

sep

1. foo
2. foo
    1. foo
    2. foo
        1. foo
    3. foo
3. foo
    20. foo
         141. foo
               1. foo
`
    verifyMarkdown(md, 2)
  })
  it('Indent by 3 spaces', () => {
    const md = `start

- foo
- foo
    - foo
    - foo
        - foo
        - foo
            - foo
    - foo
- foo

sep

1. foo
2. foo
     1. foo
     2. foo
          1. foo
     3. foo
3. foo
     20. foo
           141. foo
                  1. foo
`
    verifyMarkdown(md, 3)
  })
  it('Indent by 4 spaces', () => {
    const md = `start

- foo
- foo
     - foo
     - foo
          - foo
          - foo
               - foo
     - foo
- foo

sep

1. foo
2. foo
      1. foo
      2. foo
            1. foo
      3. foo
3. foo
      20. foo
             141. foo
                     1. foo
`

    verifyMarkdown(md, 4)
  })
  /*  it('Indent by one tab', () => {
    const md = `start

- foo
- foo
\t- foo
\t- foo
\t\t- foo
\t\t- foo
\t\t\t- foo
\t- foo
- foo

sep

1. foo
2. foo
\t1. foo
\t2. foo
\t\t1. foo
\t3. foo
3. foo
\t20. foo
\t\t141. foo
\t\t\t1. foo
`
    verifyMarkdown(md, "tab")
  }) */
  it('Indent using Daring Fireball Markdown Spec', () => {
    const md = `start

- foo
- foo
    - foo
    - foo
        - foo
        - foo
            - foo
    - foo
- foo

sep

1. foo
2. foo
    1. foo
    2. foo
        1. foo
    3. foo
3. foo
    20. foo
        99. foo
            1. foo
`

    verifyMarkdown(md, 'dfm', md)
  })
})
