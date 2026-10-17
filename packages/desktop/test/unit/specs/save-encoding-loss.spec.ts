import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  findUnrepresentableChars,
  writeMarkdownFile
} from 'main_renderer/filesystem/markdown'

// #5614: `writeMarkdownFile` encoded with iconv-lite, which substitutes `?`
// for characters the target encoding cannot represent — with no round-trip
// check, so saving "Café 😀 ok" as cp1252 silently wrote "Café ?? ok",
// destroying data. The save now throws an EncodingLossError naming the
// lost characters, and both call sites (.then/.catch in file.ts) already
// route that message to the renderer save-failure notice.

const dirs: string[] = []
function tempDir(): string {
  const d = mkdtempSync(path.join(tmpdir(), 'mt-5614-'))
  dirs.push(d)
  return d
}

afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true })
})

function saveOpts(encoding: string) {
  return {
    adjustLineEndingOnSave: false,
    lineEnding: 'lf' as const,
    encoding: { encoding }
  }
}

describe('findUnrepresentableChars (#5614)', () => {
  it('flags emoji and CJK lost by cp1252', () => {
    const lost = findUnrepresentableChars('Café 😀 ok', 'cp1252')
    expect(lost).toContain('😀')
    expect(lost).not.toContain('C')
    expect(lost).not.toContain('é')
  })

  it('returns empty for content the encoding fully covers', () => {
    expect(findUnrepresentableChars('Café ok', 'cp1252')).toEqual([])
  })

  it('returns empty for utf8 (everything round-trips)', () => {
    expect(findUnrepresentableChars('Café 😀 日本語 ok', 'utf8')).toEqual([])
  })

  // Regression: iconv-lite strips a leading BOM on decode, so a literal
  // U+FEFF in the content used to round-trip to "" in utf8 and be falsely
  // reported as unrepresentable, blocking a save that would succeed.
  it('does not falsely flag a literal BOM character in utf8', () => {
    expect(findUnrepresentableChars('\uFEFFhello\uFEFF world', 'utf8')).toEqual([])
  })

  it('still flags a literal BOM character in cp1252', () => {
    const lost = findUnrepresentableChars('a\uFEFFb', 'cp1252')
    expect(lost).toContain('\uFEFF')
  })

  it('returns empty for empty content and unknown encodings', () => {
    expect(findUnrepresentableChars('', 'cp1252')).toEqual([])
    expect(findUnrepresentableChars('abc', 'no-such-encoding')).toEqual([])
  })

  it('caps the distinct sample so long-tail mixed scripts stay readable', () => {
    const lost = findUnrepresentableChars('a'.repeat(5000) + '😀😃😄😁😆😅🤣😂🙂', 'cp1252')
    expect(lost.length).toBeGreaterThan(0)
    expect(lost.length).toBeLessThanOrEqual(8)
  })
})

describe('writeMarkdownFile — encoding loss (#5614)', () => {
  it('throws EncodingLossError instead of writing ? (cp1252)', async() => {
    const target = path.join(tempDir(), 'note.md')
    await expect(writeMarkdownFile(target, 'Café 😀 ok', saveOpts('cp1252'))).rejects.toThrow(
      /Cannot save:.*cannot be represented in.*Windows 1252/i
    )
  })

  it('sets err.name so callers can distinguish it', async() => {
    const target = path.join(tempDir(), 'note.md')
    const err = await writeMarkdownFile(target, 'x😀', saveOpts('shiftjis')).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect((err as Error).name).toBe('EncodingLossError')
  })

  it('still writes cp1252-covered content without complaint', async() => {
    const target = path.join(tempDir(), 'note.md')
    await writeMarkdownFile(target, 'Café ok', saveOpts('cp1252'))
  })

  it('still writes utf8 content with emoji without complaint', async() => {
    const target = path.join(tempDir(), 'note.md')
    await writeMarkdownFile(target, 'Café 😀 ok', saveOpts('utf8'))
  })
})
