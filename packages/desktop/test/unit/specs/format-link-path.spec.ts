import path from 'path'
import { describe, expect, it } from 'vitest'

import { normalizeFormatLinkPath } from 'main_renderer/menu/actions/formatLinkPath'

describe('normalizeFormatLinkPath', () => {
  const dirname = path.join(path.sep, 'docs')

  it('decodes valid percent-encoded local link paths', () => {
    expect(normalizeFormatLinkPath('bad%20name.md', dirname)).toBe(
      path.join(dirname, 'bad name.md')
    )
  })

  it('does not throw for malformed percent escapes', () => {
    expect(normalizeFormatLinkPath('bad%zz.md', dirname)).toBe(path.join(dirname, 'bad%zz.md'))
    expect(normalizeFormatLinkPath('%.md', dirname)).toBe(path.join(dirname, '%.md'))
    expect(normalizeFormatLinkPath('%E0%A4%A.md', dirname)).toBe(
      path.join(dirname, '%E0%A4%A.md')
    )
  })

  it('normalizes absolute paths without joining dirname', () => {
    const absolutePath = path.join(path.sep, 'tmp', 'bad%20name.md')

    expect(normalizeFormatLinkPath(absolutePath, dirname)).toBe(
      path.join(path.sep, 'tmp', 'bad name.md')
    )
  })
})
