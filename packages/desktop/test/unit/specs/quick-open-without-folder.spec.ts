import path from 'node:path'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { fileSearchMock } = vi.hoisted(() => ({ fileSearchMock: vi.fn() }))

vi.mock('@/node/fileSearcher', () => ({
  default: class {
    search = fileSearchMock
  }
}))

import QuickOpenCommand from '@/commands/quickOpen'

const RECENT = '/home/user/notes/todo.md'
const TAB = '/home/user/notes/open-tab.md'
const FOLDER = '/home/user/notes'

const makeCommand = (
  options: {
    tabs?: string[]
    projectTree?: { pathname: string } | null
  } = {}
) =>
  new QuickOpenCommand({
    editor: { tabs: (options.tabs ?? []).map((pathname) => ({ pathname })) },
    project: { projectTree: options.projectTree ?? null }
  } as unknown as ConstructorParameters<typeof QuickOpenCommand>[0])

describe('QuickOpenCommand recent files', () => {
  let recentDocuments: { pathname: string; isDirectory: boolean }[]

  beforeEach(() => {
    recentDocuments = []
    Object.assign(window, {
      electron: {
        ipcRenderer: {
          invoke: vi.fn(async() => recentDocuments),
          send: vi.fn()
        }
      },
      fileUtils: {
        isChildOfDirectory: (dir: string, child: string) =>
          path.posix.relative(dir, child).startsWith('..') === false,
        hasMarkdownExtension: (p: string) => p.endsWith('.md'),
        MARKDOWN_INCLUSIONS: ['*.md']
      },
      path: {
        basename: path.posix.basename,
        dirname: path.posix.dirname,
        relative: path.posix.relative
      }
    })
    fileSearchMock.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('lists recently opened files instead of only open tabs', async() => {
    recentDocuments = [{ pathname: RECENT, isDirectory: false }]
    const command = makeCommand()

    await expect(command.run()).resolves.toBeUndefined()

    expect(command.subcommands).toEqual([
      {
        id: RECENT,
        group: 'recently opened',
        removable: true,
        title: RECENT,
        description: RECENT
      }
    ])
  })

  it('keeps open tabs that are missing from the recent list', async() => {
    const command = makeCommand({ tabs: [TAB] })

    await command.run()

    expect(command.subcommands).toEqual([
      {
        id: TAB,
        group: 'recently opened',
        title: TAB,
        description: TAB
      }
    ])
  })

  it('ignores folders in the quick open file list', async() => {
    recentDocuments = [
      { pathname: FOLDER, isDirectory: true },
      { pathname: RECENT, isDirectory: false }
    ]
    const command = makeCommand()

    await command.run()

    expect(command.subcommands.map((item) => item.id)).toEqual([RECENT])
  })

  it('shows recent files relative to the opened folder', async() => {
    recentDocuments = [{ pathname: RECENT, isDirectory: false }]
    const command = makeCommand({ projectTree: { pathname: '/home/user' } })

    await command.run()

    expect(command.subcommands).toEqual([
      {
        id: RECENT,
        group: 'recently opened',
        removable: true,
        description: 'notes/todo.md'
      }
    ])
  })

  it('still refuses to open when there is nothing to list', async() => {
    const command = makeCommand()

    await expect(command.run()).rejects.toBeInstanceOf(Error)
  })

  it('ranks name matches before path-only matches', async() => {
    vi.useFakeTimers()
    const NAME_MATCH = '/home/user/other/notes.md'
    recentDocuments = [
      { pathname: RECENT, isDirectory: false },
      { pathname: NAME_MATCH, isDirectory: false }
    ]
    const command = makeCommand()
    await command.run()

    const nameQuery = command.search('notes')
    await vi.advanceTimersByTimeAsync(300)
    expect((await nameQuery).map((item) => item.id)).toEqual([NAME_MATCH, RECENT])

    const pathQuery = command.search('notes/')
    await vi.advanceTimersByTimeAsync(300)
    expect((await pathQuery).map((item) => item.id)).toEqual([RECENT])
  })

  it('puts recent matches before folder search results and removes duplicates', async() => {
    vi.useFakeTimers()
    recentDocuments = [{ pathname: RECENT, isDirectory: false }]
    const found = '/home/user/found-todo.md'
    fileSearchMock.mockImplementation(
      (_roots: unknown, _pattern: unknown, options: { didMatch: (result: string) => void }) => {
        options.didMatch(RECENT)
        options.didMatch(found)
        const promise = Promise.resolve() as Promise<void> & { cancel?: () => void }
        promise.cancel = vi.fn()
        return promise
      }
    )
    const command = makeCommand({ projectTree: { pathname: '/home/user' } })
    await command.run()

    const search = command.search('todo')
    await vi.advanceTimersByTimeAsync(300)
    const results = await search

    expect(results.map((item) => ({ id: item.id, group: item.group }))).toEqual([
      { id: RECENT, group: 'recently opened' },
      { id: found, group: 'file results' }
    ])
  })
})
