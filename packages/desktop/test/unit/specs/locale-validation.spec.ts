import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * Desktop locale validation.
 *
 * Ensures all JSON locale files stay consistent with the English source (en.json).
 * When this test fails, the error message tells you exactly what to fix and where.
 *
 * Checks:
 *   1. Key parity    — every locale must have the same nested keys as en.json
 *   2. Placeholders  — translated strings must preserve {variable} placeholders
 *   3. Tech terms    — product names (Front Matter, Mermaid, PlantUML, Vega) stay English
 *   4. No empties    — no leaf value may be an empty string
 *
 * How to fix failures:
 *   - Missing key:   Copy the key from en.json into <lang>.json and translate the value.
 *   - Extra key:     Remove the key from <lang>.json (it doesn't exist in en.json).
 *   - Placeholder:   Ensure the translated string contains the same {variable} tokens as en.json.
 *   - Tech term:     Keep the product name in English (e.g. "Front Matter", not "Métadonnées").
 *   - Empty value:   Add a translation (or copy the English value as fallback).
 *
 * Canonical spelling of product/standard names:
 *   - PlantUML   (not "Plantuml") — https://plantuml.com
 *   - Mermaid    — https://mermaid.js.org
 *   - Vega-Lite  (not "Vega Chart") — https://vega.github.io/vega-lite/
 *   - Front Matter — YAML metadata block (industry standard term)
 *   - KaTeX      (not "Katex") — https://katex.org
 *   - MathJax    (not "Mathjax") — https://www.mathjax.org
 */

const LOCALES_DIR = path.join(__dirname, '../../../static/locales')

const loadLocale = (lang: string): Record<string, unknown> =>
  JSON.parse(fs.readFileSync(path.join(LOCALES_DIR, `${lang}.json`), 'utf8'))

// Recursively collect all leaf keys as dot-separated paths
const collectKeys = (obj: unknown, prefix = ''): string[] => {
  if (obj === null || typeof obj !== 'object') return [prefix]
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const fullKey = prefix ? `${prefix}.${key}` : key
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      keys.push(...collectKeys(value, fullKey))
    } else {
      keys.push(fullKey)
    }
  }
  return keys
}

// Extract {placeholder} variables from a string
const extractPlaceholders = (str: string): string[] => {
  if (typeof str !== 'string') return []
  const matches = str.match(/\{[^}]+\}/g)
  return matches ? matches.sort() : []
}

// Get a nested value by dot-separated path
const getByPath = (obj: unknown, dotPath: string): unknown => {
  let current: unknown = obj
  for (const part of dotPath.split('.')) {
    if (current === null || typeof current !== 'object') return undefined
    current = (current as Record<string, unknown>)[part]
  }
  return current
}

// Technical terms that must stay in English for the locales listed in
// TERM_PRESERVING_LOCALES below. The others (ja, ko, zh-CN, zh-TW, tr)
// translate them by convention.
//
// Every path here must exist in en.json — `every technical term path exists in
// en.json` below enforces that, because a path that has gone stale is skipped
// silently by the `typeof value === 'string'` guard and the check it belongs to
// stops running (#5501). The quick-insert menu strings are NOT among these:
// they live in the engine's own locales, guarded by muya's
// localeCompleteness.spec.ts.
const TECHNICAL_TERMS: Array<{ path: string; mustContain: string }> = [
  { path: 'menu.paragraph.frontMatter', mustContain: 'Front Matter' },
  { path: 'commands.paragraph.frontMatter', mustContain: 'Front Matter' },
  { path: 'preferences.markdown.diagrams.plantumlServer.title', mustContain: 'PlantUML' },
]

// Not a script property — ru is Cyrillic and still keeps the English product
// names — so membership is per-locale convention, not per-alphabet.
const TERM_PRESERVING_LOCALES = ['de', 'es', 'fr', 'nl', 'pt', 'ru']

const getAvailableLocales = (): string[] =>
  fs.readdirSync(LOCALES_DIR)
    .filter(f => f.endsWith('.json') && !f.endsWith('.min.json') && f !== 'en.json')
    .map(f => f.replace('.json', ''))

describe('desktop locale validation', () => {
  const en = loadLocale('en')
  const enKeys = collectKeys(en).sort()
  const locales = getAvailableLocales()

  describe('key parity with en.json', () => {
    for (const lang of locales) {
      it(`${lang}.json has the same keys as en.json`, () => {
        const locale = loadLocale(lang)
        const localeKeys = new Set(collectKeys(locale))
        const missing = enKeys.filter(k => !localeKeys.has(k))
        const extra = [...localeKeys].filter(k => !enKeys.includes(k))

        const hints: string[] = []
        if (missing.length) {
          hints.push(
            `\n  MISSING (${missing.length}) — copy these from en.json into ${lang}.json and translate:`,
            ...missing.map(k => `    "${k}": ${JSON.stringify(getByPath(en, k))}`)
          )
        }
        if (extra.length) {
          hints.push(
            `\n  EXTRA (${extra.length}) — remove these from ${lang}.json (not in en.json):`,
            ...extra.map(k => `    "${k}"`)
          )
        }

        expect(
          missing.length + extra.length,
          hints.join('\n')
        ).toBe(0)
      })
    }
  })

  describe('placeholder variables', () => {
    for (const lang of locales) {
      it(`${lang}.json preserves all {variable} placeholders`, () => {
        const locale = loadLocale(lang)
        const localeKeys = new Set(collectKeys(locale))
        const issues: string[] = []

        for (const key of enKeys) {
          if (!localeKeys.has(key)) continue
          const enValue = getByPath(en, key) as string
          const localeValue = getByPath(locale, key) as string
          if (typeof enValue !== 'string' || typeof localeValue !== 'string') continue

          const enPh = extractPlaceholders(enValue)
          const localePh = extractPlaceholders(localeValue)
          if (enPh.length > 0 && JSON.stringify(enPh) !== JSON.stringify(localePh)) {
            issues.push(
              `  "${key}":` +
              `\n    en.json:       ${JSON.stringify(enValue)}` +
              `\n    ${lang}.json:  ${JSON.stringify(localeValue)}` +
              `\n    expected placeholders: ${enPh.join(' ')}` +
              `\n    found placeholders:    ${localePh.join(' ') || '(none)'}` +
              `\n    → Add the missing {variables} to the ${lang} translation.\n`
            )
          }
        }

        expect(issues.length, `\n  Placeholder issues in ${lang}.json:\n\n${issues.join('\n')}`).toBe(0)
      })
    }
  })

  describe('technical terms stay in English', () => {
    it('every technical term path exists in en.json', () => {
      const stale = TECHNICAL_TERMS.filter(({ path: keyPath }) => typeof getByPath(en, keyPath) !== 'string')
        .map(({ path: keyPath }) => keyPath)

      expect(
        stale,
        '\n  These TECHNICAL_TERMS paths are not in en.json, so the checks below' +
        `\n  skip them and enforce nothing. Repoint or remove them:\n    ${stale.join('\n    ')}\n`
      ).toEqual([])
    })

    const termLocales = locales.filter(l => TERM_PRESERVING_LOCALES.includes(l))
    for (const lang of termLocales) {
      it(`${lang}.json keeps product names untranslated`, () => {
        const locale = loadLocale(lang)
        const violations: string[] = []

        for (const { path: keyPath, mustContain } of TECHNICAL_TERMS) {
          const value = getByPath(locale, keyPath)
          if (typeof value === 'string' && !value.includes(mustContain)) {
            violations.push(
              `  "${keyPath}": "${value}"` +
              `\n    → Must contain "${mustContain}" (it's a product name, not a translatable word).`
            )
          }
        }

        expect(
          violations.length,
          `\n  Technical terms incorrectly translated in ${lang}.json:\n\n${violations.join('\n\n')}`
        ).toBe(0)
      })
    }
  })

  // vue-i18n compiles every message before displaying it, and its compiler
  // reads `\\` as an escaped backslash and collapses it to one. A label that
  // told two preferences apart by backslash count alone therefore rendered
  // identically — `texMathSingleBackslash` and `texMathDoubleBackslash` shipped
  // that way. Locale values here are plain labels, never templates that need
  // escaping, so the safe rule is to keep backslashes out of them entirely.
  // Unlike the checks above this one is not a comparison against en.json, so
  // it has to cover en.json as well.
  describe('no backslashes in translated values', () => {
    for (const lang of ['en', ...locales]) {
      it(`${lang}.json keeps backslashes out of its values`, () => {
        const locale = loadLocale(lang)
        const offenders = collectKeys(locale).filter(k => {
          const val = getByPath(locale, k)
          return typeof val === 'string' && val.includes('\\')
        })

        expect(
          offenders.length,
          `\n  Backslashes in ${lang}.json — vue-i18n collapses them, so the\n` +
          '  rendered text will not be what you typed. Describe the syntax in\n' +
          '  words instead:\n' +
          offenders.map(k => `    "${k}": ${JSON.stringify(getByPath(locale, k))}`).join('\n')
        ).toBe(0)
      })
    }
  })

  describe('no empty values', () => {
    for (const lang of locales) {
      it(`${lang}.json has no empty strings`, () => {
        const locale = loadLocale(lang)
        const allKeys = collectKeys(locale)
        const empty = allKeys.filter(k => {
          const val = getByPath(locale, k)
          return typeof val === 'string' && val.trim() === ''
        })

        expect(
          empty.length,
          `\n  Empty values in ${lang}.json (add a translation or copy from en.json):\n` +
          empty.map(k => `    "${k}": ${JSON.stringify(getByPath(en, k))}`).join('\n')
        ).toBe(0)
      })
    }
  })
})
