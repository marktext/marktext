import { describe, expect, it } from 'vitest'
import { toNativePath } from 'common/filesystem/paths'

// #5683 — the renderer only ever produces `/` paths, but Windows' shell trash /
// reveal helpers (SHCreateItemFromParsingName) reject them with "Failed to parse
// path". They must be handed a native-separator path. `sep` is injected here so
// the Windows branch is covered on every CI platform.
describe('toNativePath', () => {
  it('converts renderer `/` paths to Windows backslashes', () => {
    expect(toNativePath('C:/Users/test/proj/pkg', '\\')).toBe('C:\\Users\\test\\proj\\pkg')
    expect(toNativePath('C:/Users/test/proj/pkg/a.md', '\\')).toBe(
      'C:\\Users\\test\\proj\\pkg\\a.md'
    )
  })

  it('leaves posix paths untouched', () => {
    expect(toNativePath('/Users/test/proj/pkg', '/')).toBe('/Users/test/proj/pkg')
  })

  it('leaves an already-native Windows path unchanged', () => {
    expect(toNativePath('C:\\Users\\test\\proj\\pkg', '\\')).toBe('C:\\Users\\test\\proj\\pkg')
  })
})
