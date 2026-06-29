// @vitest-environment happy-dom

import { beforeEach, describe, expect, it } from 'vitest'
import {
  EXPORT_SETTINGS_STORAGE_KEY,
  loadExportSettings,
  saveExportSettings
} from '@/components/exportSettings/persistence'

// #2287 — export options (font, margins, page size, theme, …) reset to default
// on every restart because the dialog never persisted them. These pin the
// persistence layer: a save→load round-trip survives, missing/corrupt storage
// falls back to {} (so the component keeps its defaults) and never throws.

describe('#2287 — export settings persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips saved settings through localStorage', () => {
    saveExportSettings({ pageSize: 'A3', fontSize: 18, pageMarginTop: 30, theme: 'liber' })
    expect(loadExportSettings()).toEqual({ pageSize: 'A3', fontSize: 18, pageMarginTop: 30, theme: 'liber' })
  })

  it('returns an empty object when nothing was saved', () => {
    expect(loadExportSettings()).toEqual({})
  })

  it('returns an empty object (no throw) when stored JSON is corrupt', () => {
    localStorage.setItem(EXPORT_SETTINGS_STORAGE_KEY, '{not json')
    expect(() => loadExportSettings()).not.toThrow()
    expect(loadExportSettings()).toEqual({})
  })

  it('persists under a stable, namespaced key', () => {
    saveExportSettings({ fontSize: 12 })
    expect(localStorage.getItem(EXPORT_SETTINGS_STORAGE_KEY)).toContain('fontSize')
  })
})
