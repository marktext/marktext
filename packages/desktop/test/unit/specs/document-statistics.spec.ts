import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DOCUMENT_STATISTICS_METRIC_STORAGE_KEY,
  loadStatMetric,
  saveStatMetric
} from '@/components/titleBar/documentStatisticsPersistence'
import {
  formatCount,
  formatCountPair,
  formatTimestamp
} from '@/components/titleBar/documentStatisticsFormat'

describe('document statistics persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('defaults to words when no metric was saved', () => {
    expect(loadStatMetric()).toBe('word')
  })

  it('round-trips the selected metric through localStorage', () => {
    saveStatMetric('character')
    expect(localStorage.getItem(DOCUMENT_STATISTICS_METRIC_STORAGE_KEY)).toBe('character')
    expect(loadStatMetric()).toBe('character')
  })

  it('falls back to words for an unsupported stored value', () => {
    localStorage.setItem(DOCUMENT_STATISTICS_METRIC_STORAGE_KEY, 'lines')
    expect(loadStatMetric()).toBe('word')
  })

  it('does not throw when storage access fails', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
      throw new Error('storage unavailable')
    })

    expect(() => loadStatMetric()).not.toThrow()
    expect(loadStatMetric()).toBe('word')
  })
})

describe('document statistics formatting', () => {
  it('puts the selection before the document count', () => {
    expect(formatCountPair(5, 3, 'en')).toBe('3 / 5')
  })

  it('omits the selection when there is no selection', () => {
    expect(formatCountPair(5, undefined, 'en')).toBe('5')
  })

  it('localizes number grouping', () => {
    expect(formatCount(1024, 'en')).toBe('1,024')
    expect(formatCount(1024, 'de')).toBe('1.024')
  })

  it('formats a valid timestamp and rejects unavailable values', () => {
    const formatted = formatTimestamp(Date.UTC(2026, 9, 19, 10, 23), 'en')
    expect(formatted).toContain('2026')
    expect(formatTimestamp(0, 'en')).toBeNull()
    expect(formatTimestamp(Number.NaN, 'en')).toBeNull()
  })
})
