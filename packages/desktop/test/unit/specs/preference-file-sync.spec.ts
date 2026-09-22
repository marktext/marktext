import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

/**
 * `static/preference.json` is the list of known settings — `Preference.init()` deletes every
 * user key that is not in it. A preference declared only in the schema is therefore wiped on
 * each start and comes back as the schema default, so the switch flips itself off again.
 */

const DEFAULTS_PATH = path.join(__dirname, '../../../static/preference.json')
const SCHEMA_PATH = path.join(__dirname, '../../../src/main/preferences/schema.json')

interface SchemaEntry {
  type?: string
}

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) as Record<string, SchemaEntry>
const defaults = JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf8')) as Record<string, unknown>

const typeOf = (value: unknown): string => {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

describe('static/preference.json stays in sync with the preference schema', () => {
  it('lists every key the schema declares, so no setting is dropped on restart', () => {
    const missing = Object.keys(schema).filter((key) => !(key in defaults))
    expect(missing, `add these keys to static/preference.json: ${missing.join(', ')}`).toEqual([])
  })

  it('gives every schema key a value of the type the schema declares', () => {
    const mismatched = Object.entries(schema)
      .filter(
        ([key, entry]) =>
          Boolean(entry.type) && key in defaults && typeOf(defaults[key]) !== entry.type
      )
      .map(([key, entry]) => `${key}: expected ${entry.type}, got ${typeOf(defaults[key])}`)
    expect(mismatched).toEqual([])
  })
})
