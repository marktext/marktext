import { tmpdir } from 'os'
import path from 'path'
import { pathToFileURL } from 'url'
import { describe, expect, it } from 'vitest'
import parseArgs, { userArguments } from 'main_renderer/cli/parser'

describe('CLI parser', () => {
  it('excludes the Electron entry directory so it cannot suppress session restore', () => {
    expect(userArguments(['electron', '/app', '--user-data-dir', '/profile'], true)).toEqual([
      '--user-data-dir',
      '/profile'
    ])
    expect(
      userArguments(
        ['electron', '--inspect=0', '--remote-debugging-port=0', '/app', '/notes'],
        true,
        '/app'
      )
    ).toEqual(['--inspect=0', '--remote-debugging-port=0', '/notes'])
    expect(userArguments(['marktext', '/notes'], false)).toEqual(['/notes'])
  })
  it('parses --read-only without treating it as a path', () => {
    const args = parseArgs(['--read-only', 'note.md'])

    expect(args['--read-only']).toBe(true)
    expect(args._).toEqual(['note.md'])
  })
  it('turns file:// URIs from desktop entries into paths (#5843)', () => {
    const pathname = path.join(tmpdir(), 'My Notes', 'café.md')

    expect(parseArgs([pathToFileURL(pathname).href, 'note.md'])._).toEqual([pathname, 'note.md'])
  })
  it.skipIf(process.platform === 'win32')('keeps a file:// URI with a remote host as given', () => {
    expect(parseArgs(['file://host/note.md'])._).toEqual(['file://host/note.md'])
  })
})
