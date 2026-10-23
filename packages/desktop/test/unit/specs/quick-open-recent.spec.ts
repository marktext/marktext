import path from 'node:path'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import QuickOpenRecentCommand from '@/commands/quickOpenRecent'

const FOLDER = '/notes/project'
const FILE = '/notes/todo.md'
const NESTED = '/notes/archive/old.md'

describe('QuickOpenRecentCommand', () => {
  let documents: { pathname: string; isDirectory: boolean }[]
  let send: ReturnType<typeof vi.fn>
  let command: QuickOpenRecentCommand

  beforeEach(() => {
    documents = []
    send = vi.fn()
    Object.assign(window, {
      electron: {
        ipcRenderer: {
          invoke: vi.fn(async() => documents),
          send
        }
      },
      marktext: { env: { windowId: 7 } },
      path: {
        basename: path.posix.basename,
        dirname: path.posix.dirname
      }
    })
    command = new QuickOpenRecentCommand()
  })

  it('lists folders before files while keeping the recent order', async() => {
    documents = [
      { pathname: FILE, isDirectory: false },
      { pathname: FOLDER, isDirectory: true },
      { pathname: NESTED, isDirectory: false }
    ]

    await command.run()

    expect(command.subcommands).toEqual([
      {
        id: FOLDER,
        description: 'project',
        detail: '/notes',
        title: FOLDER,
        group: 'folders',
        removable: true,
        isDirectory: true
      },
      {
        id: FILE,
        description: 'todo.md',
        detail: '/notes',
        title: FILE,
        group: 'files',
        removable: true,
        isDirectory: false
      },
      {
        id: NESTED,
        description: 'old.md',
        detail: '/notes/archive',
        title: NESTED,
        group: 'files',
        removable: true,
        isDirectory: false
      }
    ])
    expect(command.subcommandSelectedIndex).toBe(0)
  })

  it('filters by name or path without caring about case', async() => {
    documents = [
      { pathname: FILE, isDirectory: false },
      { pathname: FOLDER, isDirectory: true },
      { pathname: NESTED, isDirectory: false }
    ]
    await command.run()

    expect((await command.search('PROJECT')).map((item) => item.id)).toEqual([FOLDER])
    expect((await command.search('archive/old')).map((item) => item.id)).toEqual([NESTED])
    expect((await command.search('todo')).map((item) => item.id)).toEqual([FILE])
  })

  it('opens files and folders through their own IPC channels', async() => {
    documents = [
      { pathname: FOLDER, isDirectory: true },
      { pathname: FILE, isDirectory: false }
    ]
    await command.run()

    await command.executeSubcommand(FILE)
    await command.executeSubcommand(FOLDER)

    expect(send).toHaveBeenNthCalledWith(1, 'mt::open-file-by-window-id', 7, FILE)
    expect(send).toHaveBeenNthCalledWith(2, 'app-open-directory-by-id', 7, FOLDER)
  })

  it('removes an entry from the list and from the recent documents', async() => {
    documents = [
      { pathname: FILE, isDirectory: false },
      { pathname: NESTED, isDirectory: false }
    ]
    await command.run()

    command.removeItem(FILE)

    expect(command.subcommands.map((item) => item.id)).toEqual([NESTED])
    expect(send).toHaveBeenCalledWith('mt::remove-recently-used-document', FILE)
  })
})
