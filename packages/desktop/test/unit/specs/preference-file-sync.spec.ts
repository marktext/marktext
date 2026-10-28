import { describe, expect, it } from 'vitest'
import fs from 'fs'
import path from 'path'

const DEFAULTS_PATH = path.join(__dirname, '../../../static/preference.json')
const SCHEMA_PATH = path.join(__dirname, '../../../src/shared/preferences/schema.json')

interface SchemaEntry {
  type?: string
  default?: unknown
}

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, 'utf8')) as Record<string, SchemaEntry>
const defaults = JSON.parse(fs.readFileSync(DEFAULTS_PATH, 'utf8')) as Record<string, unknown>

const typeOf = (value: unknown): string => {
  if (Array.isArray(value)) return 'array'
  if (value === null) return 'null'
  return typeof value
}

// Only the keys added since are held to the sync rules: the file and the schema have
// drifted on their own for a while, and repairing that is not this change's business.
describe.each(['showPandocConvert', 'fancyLists'])('static/preference.json stays in sync with the preference schema for %s', (KEY) => {
  it('lists the switch, so it is not dropped on restart', () => {
    expect(defaults, `add ${KEY} to static/preference.json`).toHaveProperty(KEY)
  })

  it('gives the switch the type the schema declares', () => {
    const entry = schema[KEY]
    expect(typeOf(defaults[KEY])).toBe(entry?.type)
  })

  it('gives the switch the value the schema calls its default', () => {
    expect(defaults[KEY]).toEqual(schema[KEY]?.default)
  })
})
