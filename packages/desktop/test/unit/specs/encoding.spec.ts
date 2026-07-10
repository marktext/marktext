import { describe, expect, it, vi } from 'vitest'

// `ced` (compact_enc_det) occasionally misdetects a valid UTF-8 file as a legacy
// double-byte encoding, mojibaking multi-byte text — e.g. Greek µ/κ/α become CJK
// 碌/魏/伪 (#3151). Simulate that by forcing `ced` to always answer GBK; the fix
// must override it whenever the bytes are valid UTF-8.
vi.mock('ced', () => ({ default: vi.fn(() => 'GB') }))

const { guessEncoding } = await import('main_renderer/filesystem/encoding')

describe('guessEncoding — prefer UTF-8 over a ced misdetection (#3151)', () => {
  it('returns utf8 for a valid UTF-8 buffer even when ced guesses GBK', () => {
    const buffer = Buffer.from('# Notes\n\nµ = 0.5, κ, α — Greek letters.\n', 'utf8')
    expect(guessEncoding(buffer, true).encoding).toBe('utf8')
  })

  it('still falls back to ced for a genuinely non-UTF-8 buffer', () => {
    // `0xC2` is a UTF-8 lead byte; the following space is not a continuation
    // byte, so the buffer is not valid UTF-8 and ced's guess stands.
    const buffer = Buffer.from([0x68, 0x69, 0xc2, 0x20, 0x6f, 0x6b])
    expect(guessEncoding(buffer, true).encoding).toBe('gb2312')
  })

  it('does not force utf8 for a buffer containing NUL (binary / BOM-less UTF-16)', () => {
    const buffer = Buffer.from([0x68, 0x00, 0x65, 0x00, 0x6c, 0x00])
    expect(guessEncoding(buffer, true).encoding).not.toBe('utf8')
  })

  it('honours a UTF-8 BOM and never reaches ced', () => {
    const buffer = Buffer.from([0xef, 0xbb, 0xbf, 0x68, 0x69])
    const result = guessEncoding(buffer, true)
    expect(result.encoding).toBe('utf8')
    expect(result.isBom).toBe(true)
  })
})
