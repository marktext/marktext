import pathe from 'pathe'
import { beforeAll, describe, it, expect } from 'vitest'

import { resolveLocalLinkHref } from '@/util/resolveLinkHref'

// The preload exposes pathe as `window.path`; use the real library rather than
// a hand-written stub, since the relative branch depends on how it treats
// drive and UNC roots.
beforeAll(() => {
  window.path = pathe as unknown as typeof window.path
})

describe('resolveLocalLinkHref — document directory', () => {
  it('escapes #, ? and % in the document directory', () => {
    window.DIRNAME = '/home/me/C# 100%25 what?'
    expect(resolveLocalLinkHref('./notes.md')).toBe(
      'file:///home/me/C%23 100%2525 what%3F/notes.md'
    )
  })

  it('keeps the fragment and the already-encoded characters of the link', () => {
    window.DIRNAME = '/home/me/C#'
    expect(resolveLocalLinkHref('my%20notes.md#intro')).toBe(
      'file:///home/me/C%23/my%20notes.md#intro'
    )
  })

  it('resolves against the new URL to the file on disk', () => {
    window.DIRNAME = '/home/me/C# 100%25 what?'
    const url = new URL(resolveLocalLinkHref('./notes.md'))
    expect(decodeURIComponent(url.pathname)).toBe('/home/me/C# 100%25 what?/notes.md')
    expect(url.hash).toBe('')
    expect(url.search).toBe('')
  })
})

describe('resolveLocalLinkHref — Windows document directory (#5336)', () => {
  it('keeps the server of a UNC document directory', () => {
    window.DIRNAME = pathe.dirname('\\\\server\\share\\docs\\note.md')
    const url = new URL(resolveLocalLinkHref('./notes.md'))
    expect(url.host).toBe('server')
    expect(url.pathname).toBe('/share/docs/notes.md')
  })

  it('keeps the host of a WSL document directory when the link climbs up', () => {
    window.DIRNAME = '//wsl.localhost/Ubuntu-24.04/home/me/docs'
    expect(resolveLocalLinkHref('../notes/todo.md#today')).toBe(
      'file://wsl.localhost/Ubuntu-24.04/home/me/notes/todo.md#today'
    )
  })

  it('gives a drive-letter document directory an empty host', () => {
    window.DIRNAME = pathe.dirname('C:\\Users\\me\\docs\\note.md')
    expect(resolveLocalLinkHref('./notes.md')).toBe('file:///C:/Users/me/docs/notes.md')
  })
})
