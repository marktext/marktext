import type { FileWordCount } from '@shared/types/files'

export type StatMetric = keyof FileWordCount

export const DOCUMENT_STATISTICS_METRIC_STORAGE_KEY = 'document-statistics-metric'
export const DEFAULT_STAT_METRIC: StatMetric = 'word'

const STAT_METRICS: readonly StatMetric[] = ['word', 'character', 'paragraph', 'all']

export const isStatMetric = (value: unknown): value is StatMetric =>
  typeof value === 'string' && (STAT_METRICS as readonly string[]).includes(value)

export const loadStatMetric = (): StatMetric => {
  try {
    const value = localStorage.getItem(DOCUMENT_STATISTICS_METRIC_STORAGE_KEY)
    return isStatMetric(value) ? value : DEFAULT_STAT_METRIC
  } catch {
    return DEFAULT_STAT_METRIC
  }
}

export const saveStatMetric = (metric: StatMetric): void => {
  try {
    localStorage.setItem(DOCUMENT_STATISTICS_METRIC_STORAGE_KEY, metric)
  } catch {
    // Storage can be unavailable in private mode or when the quota is full.
    // The chosen metric still applies for this session.
  }
}
