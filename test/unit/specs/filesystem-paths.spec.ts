import { describe, it, expect } from 'vitest'
import {
  hasMarkdownExtension,
  isChildOfDirectory,
  checkPathExcludePattern,
  MARKDOWN_EXTENSIONS,
  MARKDOWN_INCLUSIONS,
  IMAGE_EXTENSIONS
} from 'common/filesystem/paths'
import path from 'path'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

describe('MARKDOWN_EXTENSIONS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(MARKDOWN_EXTENSIONS)).toBe(true)
  })

  it('contains the canonical "md" extension', () => {
    expect(MARKDOWN_EXTENSIONS).toContain('md')
  })

  it('contains "markdown" and "mdx"', () => {
    expect(MARKDOWN_EXTENSIONS).toContain('markdown')
    expect(MARKDOWN_EXTENSIONS).toContain('mdx')
  })

  it('has no duplicate entries', () => {
    expect(new Set(MARKDOWN_EXTENSIONS).size).toBe(MARKDOWN_EXTENSIONS.length)
  })
})

describe('MARKDOWN_INCLUSIONS', () => {
  it('has the same length as MARKDOWN_EXTENSIONS', () => {
    expect(MARKDOWN_INCLUSIONS.length).toBe(MARKDOWN_EXTENSIONS.length)
  })

  it('each entry starts with "*."', () => {
    for (const inc of MARKDOWN_INCLUSIONS) {
      expect(inc.startsWith('*.')).toBe(true)
    }
  })
})

describe('IMAGE_EXTENSIONS', () => {
  it('is frozen', () => {
    expect(Object.isFrozen(IMAGE_EXTENSIONS)).toBe(true)
  })

  it('contains common web image formats', () => {
    expect(IMAGE_EXTENSIONS).toContain('png')
    expect(IMAGE_EXTENSIONS).toContain('jpg')
    expect(IMAGE_EXTENSIONS).toContain('jpeg')
    expect(IMAGE_EXTENSIONS).toContain('svg')
    expect(IMAGE_EXTENSIONS).toContain('webp')
    expect(IMAGE_EXTENSIONS).toContain('gif')
  })
})

// ---------------------------------------------------------------------------
// hasMarkdownExtension
// ---------------------------------------------------------------------------

describe('hasMarkdownExtension', () => {
  it.each([...MARKDOWN_EXTENSIONS])('returns true for .%s extension', (ext) => {
    expect(hasMarkdownExtension(`document.${ext}`)).toBe(true)
  })

  it('is case-insensitive for uppercase extensions', () => {
    expect(hasMarkdownExtension('README.MD')).toBe(true)
    expect(hasMarkdownExtension('NOTES.MARKDOWN')).toBe(true)
  })

  it('is case-insensitive for mixed-case extensions', () => {
    expect(hasMarkdownExtension('doc.Md')).toBe(true)
  })

  it('returns false for non-markdown extension .html', () => {
    expect(hasMarkdownExtension('page.html')).toBe(false)
  })

  it('returns false for non-markdown extension .txt', () => {
    // .txt IS in MARKDOWN_EXTENSIONS, so use a different non-md extension
    expect(hasMarkdownExtension('script.js')).toBe(false)
  })

  it('returns false for a file with no extension', () => {
    expect(hasMarkdownExtension('Makefile')).toBe(false)
  })

  it('returns false for an empty string', () => {
    expect(hasMarkdownExtension('')).toBe(false)
  })

  it('returns false for null input', () => {
    expect(hasMarkdownExtension(null as unknown as string)).toBe(false)
  })

  it('returns false for undefined input', () => {
    expect(hasMarkdownExtension(undefined as unknown as string)).toBe(false)
  })

  it('works with full absolute paths', () => {
    expect(hasMarkdownExtension('/home/user/notes/readme.md')).toBe(true)
    expect(hasMarkdownExtension('/home/user/notes/readme.ts')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// isChildOfDirectory
// ---------------------------------------------------------------------------

describe('isChildOfDirectory', () => {
  const dir = path.join('home', 'user', 'docs')

  it('returns true when child is directly inside dir', () => {
    expect(isChildOfDirectory(dir, path.join(dir, 'file.md'))).toBe(true)
  })

  it('returns true when child is deeply nested inside dir', () => {
    expect(isChildOfDirectory(dir, path.join(dir, 'sub', 'deep', 'file.md'))).toBe(true)
  })

  it('returns false when child is the same as dir', () => {
    expect(isChildOfDirectory(dir, dir)).toBe(false)
  })

  it('returns false when child is outside dir', () => {
    expect(isChildOfDirectory(dir, path.join('home', 'user', 'other', 'file.md'))).toBe(false)
  })

  it('returns false for empty dir', () => {
    expect(isChildOfDirectory('', path.join(dir, 'file.md'))).toBe(false)
  })

  it('returns false for empty child', () => {
    expect(isChildOfDirectory(dir, '')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// checkPathExcludePattern
// ---------------------------------------------------------------------------

describe('checkPathExcludePattern', () => {
  it('returns true when a pattern matches the basename', () => {
    expect(checkPathExcludePattern('path/to/node_modules', ['node_modules'])).toBe(true)
  })

  it('returns true when a glob pattern matches', () => {
    expect(checkPathExcludePattern('path/to/file.min.js', ['*.min.js'])).toBe(true)
  })

  it('returns false when no pattern matches', () => {
    expect(checkPathExcludePattern('path/to/file.ts', ['*.min.js', 'dist'])).toBe(false)
  })

  it('returns false for empty pathname', () => {
    expect(checkPathExcludePattern('', ['*'])).toBe(false)
  })

  it('returns false for null pathname', () => {
    expect(checkPathExcludePattern(null as unknown as string, ['*'])).toBe(false)
  })

  it('returns false when patterns array is empty', () => {
    expect(checkPathExcludePattern('file.md', [])).toBe(false)
  })
})
