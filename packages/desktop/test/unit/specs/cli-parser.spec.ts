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
})
