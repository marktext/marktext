// @vitest-environment node
import iconv from 'iconv-lite'
import { describe, expect, it, vi } from 'vitest'

// CI installs with --ignore-scripts, so the native `ced` addon is not built there.
// Mock it with the answers the real `ced` gives for these samples ('ASCII' for
// Latin-1 text, 'SJS' for Shift JIS); those are what used to be mapped back to
// utf8, turning every non-UTF-8 byte into U+FFFD and corrupting the file on save.
// encoding-legacy-roundtrip.real-ced.spec.ts runs the same samples against the
// real `ced` wherever its binding is built, so these answers stay checked.
const ced = vi.hoisted(() => vi.fn<(buffer: Buffer) => string>())
vi.mock('ced', () => ({ default: ced }))

const { guessEncoding } = await import('main_renderer/filesystem/encoding')

const roundTrip = (text: string, sourceEncoding: string) => {
  const bytes = iconv.encode(text, sourceEncoding)
  const { encoding } = guessEncoding(bytes, true)
  const decoded = iconv.decode(bytes, encoding)
  return { encoding, decoded, saved: iconv.encode(decoded, encoding) }
}

describe('guessEncoding keeps legacy encodings byte-exact', () => {
  it.each([
    [
      'German Windows-1252',
      'Grüße aus München. Äpfel, Öl und Übermaß sind schön.\n'.repeat(20),
      'cp1252',
      'ASCII'
    ],
    ['sparse Latin-1', `${'plain english text line here\n'.repeat(30)}café\n`, 'latin1', 'ASCII'],
    ['Shift JIS', '日本語のテキストです。これはシフトJISのテストです。\n'.repeat(20), 'shiftjis', 'SJS']
  ])('%s', (_name, text, sourceEncoding, cedAnswer) => {
    ced.mockReturnValue(cedAnswer)
    const bytes = iconv.encode(text, sourceEncoding)
    const { encoding, decoded, saved } = roundTrip(text, sourceEncoding)

    expect(encoding).not.toBe('utf8')
    expect(decoded).toBe(text)
    expect(saved.equals(bytes)).toBe(true)
  })
})
