import { acceleratorToLabel } from './accelerator'

const FORMAT_COMMANDS: Readonly<Record<string, string>> = {
  strong: 'format.strong',
  em: 'format.emphasis',
  u: 'format.underline',
  del: 'format.strike',
  mark: 'format.highlight',
  inline_code: 'format.inline-code',
  inline_math: 'format.inline-math',
  link: 'format.hyperlink',
  image: 'format.image',
  clear: 'format.clear-format'
}

const PARAGRAPH_COMMANDS: Readonly<Record<string, string>> = {
  paragraph: 'paragraph.paragraph',
  'atx-heading 1': 'paragraph.heading-1',
  'atx-heading 2': 'paragraph.heading-2',
  'atx-heading 3': 'paragraph.heading-3',
  'atx-heading 4': 'paragraph.heading-4',
  'atx-heading 5': 'paragraph.heading-5',
  'atx-heading 6': 'paragraph.heading-6',
  'thematic-break': 'paragraph.horizontal-line',
  frontmatter: 'paragraph.front-matter',
  table: 'paragraph.table',
  'math-block': 'paragraph.math-formula',
  'html-block': 'paragraph.html-block',
  'code-block': 'paragraph.code-fence',
  'block-quote': 'paragraph.quote-block',
  'order-list': 'paragraph.order-list',
  'bullet-list': 'paragraph.bullet-list',
  'task-list': 'paragraph.task-list'
}

const FRONT_COMMANDS: Readonly<Record<string, string>> = {
  ...PARAGRAPH_COMMANDS,
  duplicate: 'edit.duplicate',
  new: 'edit.create-paragraph',
  delete: 'edit.delete-paragraph'
}

export const createMuyaShortcutResolvers = (
  getAccelerator: (commandId: string) => string | undefined,
  isMac: boolean
) => {
  const resolve = (commands: Readonly<Record<string, string>>, action: string): string => {
    const commandId = commands[action]
    const accelerator = commandId ? getAccelerator(commandId) : undefined
    return accelerator ? acceleratorToLabel(accelerator, isMac) : ''
  }

  return {
    format: (action: string): string => resolve(FORMAT_COMMANDS, action),
    paragraph: (action: string): string => resolve(PARAGRAPH_COMMANDS, action),
    front: (action: string): string => resolve(FRONT_COMMANDS, action)
  }
}
