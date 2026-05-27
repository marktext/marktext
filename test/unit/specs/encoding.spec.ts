import { describe, it, expect } from 'vitest'
import { getEncodingName, ENCODING_NAME_MAP } from 'common/encoding'

describe('ENCODING_NAME_MAP', () => {
  it('is frozen (immutable)', () => {
    expect(Object.isFrozen(ENCODING_NAME_MAP)).toBe(true)
  })

  it('maps utf8 to UTF-8', () => {
    expect(ENCODING_NAME_MAP.utf8).toBe('UTF-8')
  })

  it('maps ascii to Western (ISO 8859-1)', () => {
    expect(ENCODING_NAME_MAP.ascii).toBe('Western (ISO 8859-1)')
  })

  it('maps shiftjis to Japanese (Shift JIS)', () => {
    expect(ENCODING_NAME_MAP.shiftjis).toBe('Japanese (Shift JIS)')
  })

  it('contains at least 30 entries', () => {
    expect(Object.keys(ENCODING_NAME_MAP).length).toBeGreaterThanOrEqual(30)
  })
})

describe('getEncodingName', () => {
  it('returns a human-readable name for utf8', () => {
    expect(getEncodingName({ encoding: 'utf8' })).toBe('UTF-8')
  })

  it('appends " with BOM" when isBom is true', () => {
    expect(getEncodingName({ encoding: 'utf8', isBom: true })).toBe('UTF-8 with BOM')
  })

  it('does not append BOM suffix when isBom is false', () => {
    expect(getEncodingName({ encoding: 'utf8', isBom: false })).toBe('UTF-8')
  })

  it('does not append BOM suffix when isBom is omitted', () => {
    expect(getEncodingName({ encoding: 'utf16le' })).toBe('UTF-16 LE')
  })

  it('falls back to the raw encoding string for unknown encodings', () => {
    expect(getEncodingName({ encoding: 'not-a-real-encoding' })).toBe('not-a-real-encoding')
  })

  it('appends " with BOM" to unknown encodings when isBom is true', () => {
    expect(getEncodingName({ encoding: 'custom-enc', isBom: true })).toBe('custom-enc with BOM')
  })

  it('handles every known encoding without throwing', () => {
    for (const key of Object.keys(ENCODING_NAME_MAP)) {
      expect(() => getEncodingName({ encoding: key })).not.toThrow()
    }
  })

  it('handles every known encoding with BOM flag without throwing', () => {
    for (const key of Object.keys(ENCODING_NAME_MAP)) {
      const name = getEncodingName({ encoding: key, isBom: true })
      expect(name).toContain('with BOM')
    }
  })

  it('covers CJK encodings', () => {
    expect(getEncodingName({ encoding: 'gb2312' })).toContain('Chinese')
    expect(getEncodingName({ encoding: 'shiftjis' })).toContain('Japanese')
    expect(getEncodingName({ encoding: 'euckr' })).toContain('Korean')
  })
})
