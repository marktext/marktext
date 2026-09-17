import { describe, it, expect, vi, beforeEach } from 'vitest'

// The quick open command talks to ripgrep over IPC; nothing in these tests
// reaches the disk search, so a bare stand-in is enough.
vi.mock('@/node/fileSearcher', () => ({
  default: class {
    search = vi.fn()
  }
}))

import QuickOpenCommand from '@/commands/quickOpen'

const PATHNAME = '/home/user/notes/todo.md'

const makeCommand = (projectTree: { pathname: string } | null) =>
  new QuickOpenCommand({
    editor: { tabs: [{ pathname: PATHNAME }, { pathname: '' }] },
    project: { projectTree }
  } as unknown as ConstructorParameters<typeof QuickOpenCommand>[0])

describe('QuickOpenCommand with files open but no folder', () => {
  beforeEach(() => {
    Object.assign(window, {
      fileUtils: {
        isChildOfDirectory: (dir: string, child: string) => child.startsWith(`${dir}/`),
        hasMarkdownExtension: (p: string) => p.endsWith('.md'),
        MARKDOWN_INCLUSIONS: ['*.md']
      },
      path: {
        relative: (from: string, to: string) => to.slice(from.length + 1)
      }
    })
  })

  it('lists the open tabs instead of failing to initialize', async() => {
    const command = makeCommand(null)

    await expect(command.run()).resolves.toBeUndefined()
    expect(command.subcommands).toEqual([
      { id: PATHNAME, title: PATHNAME, description: PATHNAME }
    ])
  })

  it('still shows paths relative to the opened folder', async() => {
    const command = makeCommand({ pathname: '/home/user' })

    await command.run()
    expect(command.subcommands).toEqual([
      { id: PATHNAME, description: 'notes/todo.md' }
    ])
  })
})
