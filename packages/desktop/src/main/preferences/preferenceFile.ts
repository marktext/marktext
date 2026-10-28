import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { sync as writeAtomic } from 'write-file-atomic'
import {
  RECOVERY_DEFAULTS,
  type PreferenceSchemaEntry,
  type PreferenceSchemaRule as Rule,
  type PreferenceUpdateResult,
  type UserPreferences
} from '@shared/types/preferences'
import bundled from '../../../static/preference.json'
import schema from '@shared/preferences/schema.json'

const schemaEntries: Record<string, PreferenceSchemaEntry> = schema
const rules: Record<string, Rule> = schemaEntries
const object = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value)
const accepts = (value: unknown, rule: Rule): boolean => {
  if (rule.anyOf) return rule.anyOf.some((item) => accepts(value, item))
  if ('const' in rule) return value === rule.const
  if (rule.enum && !rule.enum.includes(value)) return false
  if (rule.type && (rule.type === 'array' ? !Array.isArray(value) : typeof value !== rule.type))
    return false
  if (
    typeof value === 'number' &&
    (!Number.isFinite(value) ||
      value < (rule.minimum ?? -Infinity) ||
      value > (rule.maximum ?? Infinity))
  )
    return false
  if (typeof value === 'string' && rule.pattern && !new RegExp(rule.pattern).test(value))
    return false
  const itemRule = rule.items
  if (Array.isArray(value) && itemRule && !value.every((item) => accepts(item, itemRule)))
    return false
  return true
}

export const preferenceDefaults = (dark = false): UserPreferences & Record<string, unknown> => {
  const defaults: Record<string, unknown> = {}
  for (const [key, rule] of Object.entries(rules))
    if ('default' in rule) defaults[key] = structuredClone(rule.default)
  Object.assign(defaults, structuredClone(bundled), RECOVERY_DEFAULTS, { language: '' })
  if (dark) defaults.theme = 'dark'
  return defaults as UserPreferences & Record<string, unknown>
}

/** Invalid files are kept read-only; valid files retain unknown keys without interpreting them. */
export class PreferenceFile {
  readonly exists: boolean
  readonly readOnly: boolean
  private readonly _pathname: string
  private _value: UserPreferences & Record<string, unknown>
  private _raw: Record<string, unknown> = {}
  private readonly _write: (pathname: string, contents: string) => void

  constructor(
    directory: string,
    options: { dark?: boolean; write?: (pathname: string, contents: string) => void } = {}
  ) {
    this._pathname = path.join(directory, 'preferences.json')
    this.exists = existsSync(this._pathname)
    this._value = preferenceDefaults(options.dark)
    this._write =
      options.write ??
      ((pathname, contents) => writeAtomic(pathname, contents, { encoding: 'utf8', mode: 0o600 }))
    let readOnly = false
    try {
      const input: unknown = JSON.parse(readFileSync(this._pathname, 'utf8'))
      if (!object(input)) throw new Error('Invalid preferences')
      this._raw = input
      for (const [key, rule] of Object.entries(rules)) {
        if (accepts(input[key], rule) && input[key] !== undefined)
          this._value[key] = structuredClone(input[key])
      }
    } catch (error) {
      readOnly = (error as NodeJS.ErrnoException).code !== 'ENOENT'
    }
    this.readOnly = readOnly
  }

  get(): UserPreferences & Record<string, unknown> {
    return structuredClone(this._value)
  }

  update(patch: unknown): PreferenceUpdateResult {
    if (
      !object(patch) ||
      Object.entries(patch).some(
        ([key, value]) => !Object.hasOwn(rules, key) || !accepts(value, rules[key])
      )
    )
      return { status: 'failed', reason: 'invalid-data' }
    if (this.readOnly) return { status: 'failed', reason: 'storage-unavailable' }
    const next = { ...this._value, ...structuredClone(patch) }
    try {
      mkdirSync(path.dirname(this._pathname), { recursive: true })
      this._write(this._pathname, JSON.stringify({ ...this._raw, ...next }, null, 2))
    } catch {
      return { status: 'failed', reason: 'storage-unavailable' }
    }
    this._value = next
    return { status: 'persisted', preferences: this.get() }
  }
}
