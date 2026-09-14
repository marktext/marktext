import { describe, it, expect, vi } from 'vitest'

// `resolveLocalLinkHref` reads `window.DIRNAME` + `window.path.resolve` for the
// relative-resolve branch. Stub those preload surfaces before the hoisted
// import runs.
vi.hoisted(() => {
  const w = globalThis as unknown as {
    window?: {
      path?: { sep: string; resolve?: (...parts: string[]) => string }
      DIRNAME?: string
    }
  }
  w.window ??= {}
  w.window.path ??= {
    sep: '/',
    resolve: (...parts: string[]) =>
      parts.join('/').replace(/\/\.\//g, '/').replace(/\/{2,}/g, '/')
  }
  w.window.DIRNAME = '/docs'
})

import { resolveLocalLinkHref } from '@/util/resolveLinkHref'

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
