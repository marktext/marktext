import { describe, expect, it } from 'vitest'
import { getPandocReader, type PandocReaderExtensions } from 'main_renderer/utils/pandoc'

import defaultPreferences from '../../../static/preference.json'
import schema from 'main_renderer/preferences/schema.json'

describe('GitHub Alerts application integration', () => {
  it('keeps the migration allowlist and schema defaults consistent', () => {
    expect(defaultPreferences.githubAlerts).toBe(false)
    expect(schema.githubAlerts.default).toBe(false)
  })
  it.each([false, true])(
    'sets native reader flags for githubAlerts=%s, including the markdown fallback',
    (enabled) => {
      const extensions: PandocReaderExtensions = {
        gfm: new Map([['alerts', true]]),
        markdown: new Map([
          ['alerts', false],
          ['tex_math_single_backslash', false]
        ])
      }
      expect(getPandocReader({ superSubScript: false, githubAlerts: enabled }, extensions)).toBe(
        `gfm${enabled ? '+' : '-'}alerts`
      )
      const fallback = getPandocReader(
        { superSubScript: false, githubAlerts: enabled, texMathSingleBackslash: true },
        extensions
      )
      expect(fallback).toContain('markdown')
      expect(fallback.includes('+alerts')).toBe(enabled)
    }
  )

  it('does not send unknown extensions to older or unprobeable Pandoc installations', () => {
    const old: PandocReaderExtensions = { gfm: new Map(), markdown: new Map() }
    for (const extensions of [old, null]) {
      expect(getPandocReader({ superSubScript: false, githubAlerts: true }, extensions)).toBe('gfm')
    }
  })
})
