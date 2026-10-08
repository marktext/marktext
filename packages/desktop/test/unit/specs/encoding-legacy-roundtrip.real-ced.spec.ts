// @vitest-environment node
import iconv from 'iconv-lite'
import { describe, expect, it } from 'vitest'

// Same samples as encoding-legacy-roundtrip.spec.ts, but against the real `ced`,
// so a change in what `ced` answers for Latin-1 / Shift JIS is caught. CI installs
// with --ignore-scripts and has no compiled `ced` binding, so this suite is
// skipped there (and says why); it runs wherever the native addon is built.
let cedLoadError: string | null = null
try {
  await import('ced')
} catch (error) {
  cedLoadError = error instanceof Error ? error.message.split('\n')[0] : String(error)
}

const suiteName = cedLoadError
  ? `guessEncoding with the real ced (skipped: native binding unavailable: ${cedLoadError})`
  : 'guessEncoding with the real ced keeps legacy encodings byte-exact'

describe.skipIf(cedLoadError !== null)(suiteName, () => {
  it.each([
    [
      'German Windows-1252',
      'Grüße aus München. Äpfel, Öl und Übermaß sind schön.\n'.repeat(20),
      'cp1252'
    ],
    ['sparse Latin-1', `${'plain english text line here\n'.repeat(30)}café\n`, 'latin1'],
    ['Shift JIS', '日本語のテキストです。これはシフトJISのテストです。\n'.repeat(20), 'shiftjis']
  ])('%s', async(_name, text, sourceEncoding) => {
    const { guessEncoding } = await import('main_renderer/filesystem/encoding')
    const bytes = iconv.encode(text, sourceEncoding)
    const { encoding } = guessEncoding(bytes, true)
    const decoded = iconv.decode(bytes, encoding)

    expect(encoding).not.toBe('utf8')
    expect(decoded).toBe(text)
    expect(iconv.encode(decoded, encoding).equals(bytes)).toBe(true)
  })
})
