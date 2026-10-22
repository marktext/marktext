import { describe, it, expect } from 'vitest'
import { checkPathExcludePattern } from 'common/filesystem/paths'

// The sidebar watcher calls this from chokidar's `ignored` predicate. A throw
// there aborts the initial traversal and leaves the project tree empty
// (GH#5159), so "does not throw" is as much a requirement as the match result.
describe('checkPathExcludePattern', () => {
  it('excludes nothing when no pattern is configured', () => {
    expect(checkPathExcludePattern('/home/user/notes/README.md', [])).toBe(false)
  })

  it('keeps paths that no pattern matches', () => {
    expect(checkPathExcludePattern('/home/user/notes/README.md', ['*.tmp', 'drafts'])).toBe(false)
  })

  it('excludes paths a pattern matches', () => {
    expect(checkPathExcludePattern('/home/user/notes/scratch.tmp', ['*.tmp'])).toBe(true)
  })

  it('matches a slashless pattern against the basename', () => {
    expect(checkPathExcludePattern('/home/user/notes/drafts', ['drafts'])).toBe(true)
  })

  it('matches patterns that span directories', () => {
    expect(checkPathExcludePattern('/home/user/notes/drafts/post.md', ['**/drafts/**'])).toBe(true)
  })

  it('ignores an empty pathname', () => {
    expect(checkPathExcludePattern('', ['*.tmp'])).toBe(false)
  })
})
