// @vitest-environment node
import iconv from 'iconv-lite'
import { describe, expect, it } from 'vitest'
import { guessEncoding } from 'main_renderer/filesystem/encoding'

// Uses the real `ced`: its answers for these samples ('ASCII' for Latin-1 text,
// 'SJS' for Shift JIS) are what used to be mapped back to utf8, turning every
// non-UTF-8 byte into U+FFFD and corrupting the file on the next save.
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
      'cp1252'
    ],
    ['sparse Latin-1', `${'plain english text line here\n'.repeat(30)}café\n`, 'latin1'],
    ['Shift JIS', '日本語のテキストです。これはシフトJISのテストです。\n'.repeat(20), 'shiftjis']
  ])('%s', (_name, text, sourceEncoding) => {
    const bytes = iconv.encode(text, sourceEncoding)
    const { encoding, decoded, saved } = roundTrip(text, sourceEncoding)

    expect(encoding).not.toBe('utf8')
    expect(decoded).toBe(text)
    expect(saved.equals(bytes)).toBe(true)
  })
})
