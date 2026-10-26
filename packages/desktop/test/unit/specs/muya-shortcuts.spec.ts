import { describe, expect, it } from 'vitest'
import { createMuyaShortcutResolvers } from '@/util/muyaShortcuts'
import { acceleratorToLabel } from '@/util/accelerator'
import darwin from 'main_renderer/keyboard/keybindingsDarwin'
import windows from 'main_renderer/keyboard/keybindingsWindows'
import linux from 'main_renderer/keyboard/keybindingsLinux'

const actions = [
  ['format', 'strong', 'format.strong'],
  ['format', 'em', 'format.emphasis'],
  ['format', 'u', 'format.underline'],
  ['format', 'del', 'format.strike'],
  ['format', 'mark', 'format.highlight'],
  ['format', 'inline_code', 'format.inline-code'],
  ['format', 'inline_math', 'format.inline-math'],
  ['format', 'link', 'format.hyperlink'],
  ['format', 'image', 'format.image'],
  ['format', 'clear', 'format.clear-format'],
  ['front', 'duplicate', 'edit.duplicate'],
  ['front', 'new', 'edit.create-paragraph'],
  ['front', 'delete', 'edit.delete-paragraph'],
  ['paragraph', 'paragraph', 'paragraph.paragraph'],
  ['paragraph', 'thematic-break', 'paragraph.horizontal-line'],
  ['paragraph', 'frontmatter', 'paragraph.front-matter'],
  ['paragraph', 'table', 'paragraph.table'],
  ['paragraph', 'math-block', 'paragraph.math-formula'],
  ['paragraph', 'html-block', 'paragraph.html-block'],
  ['paragraph', 'code-block', 'paragraph.code-fence'],
  ['paragraph', 'block-quote', 'paragraph.quote-block'],
  ['paragraph', 'order-list', 'paragraph.order-list'],
  ['paragraph', 'bullet-list', 'paragraph.bullet-list'],
  ['paragraph', 'task-list', 'paragraph.task-list'],
  ...[1, 2, 3, 4, 5, 6].map((level) => [
    'paragraph',
    `atx-heading ${level}`,
    `paragraph.heading-${level}`
  ])
] as Array<['format' | 'front' | 'paragraph', string, string]>

describe.each([
  ['macOS', darwin, true],
  ['Windows', windows, false],
  ['Linux', linux, false]
] as const)('Muya hints on %s', (_name, bindings, isMac) => {
  const resolve = createMuyaShortcutResolvers((id) => bindings.get(id), isMac)

  it.each(actions)('%s / %s follows %s', (surface, action, command) => {
    expect(resolve[surface](action)).toBe(acceleratorToLabel(bindings.get(command) ?? '', isMac))
    if (surface === 'paragraph') expect(resolve.front(action)).toBe(resolve.paragraph(action))
  })
})

it('reads live overrides and clears removed or unbound entries without a default fallback', () => {
  let bindings: Record<string, string> = { 'format.strong': 'Ctrl+Alt+F12' }
  const resolve = createMuyaShortcutResolvers((id) => bindings[id], false)
  expect(resolve.format('strong')).toBe('Ctrl+Alt+F12')
  bindings = { 'format.strong': '' }
  expect(resolve.format('strong')).toBe('')
  bindings = {}
  expect(resolve.format('strong')).toBe('')
  expect(resolve.format('color')).toBe('')
  expect(resolve.paragraph('diagram mermaid')).toBe('')
})

it('hides Windows heading hints while Linux inline code uses Ctrl+Y', () => {
  expect(
    createMuyaShortcutResolvers((id) => windows.get(id), false).paragraph('atx-heading 1')
  ).toBe('')
  expect(createMuyaShortcutResolvers((id) => linux.get(id), false).format('inline_code')).toBe(
    'Ctrl+Y'
  )
})

it('has no duplicate non-empty default accelerators on any platform', () => {
  for (const bindings of [darwin, windows, linux]) {
    const labels = [...bindings.values()]
      .filter(Boolean)
      .map((value) => acceleratorToLabel(value, bindings === darwin))
    expect(new Set(labels).size).toBe(labels.length)
  }
})
