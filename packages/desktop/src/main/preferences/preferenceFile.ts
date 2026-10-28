import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { sync as writeAtomic } from 'write-file-atomic'
import {
  RECOVERY_DEFAULTS,
  type PreferenceUpdateResult,
  type UserPreferences
} from '@shared/types/preferences'
import bundled from '../../../static/preference.json'
import schema from './schema.json'

interface Rule {
  type?: string
  enum?: unknown[]
  const?: unknown
  minimum?: number
  maximum?: number
  pattern?: string
  anyOf?: Rule[]
  items?: Rule
  default?: unknown
}
const retiredWindowKeys = new Set([
  'lastOpenedFolder',
  'tocVisibility',
  'sideBarVisibility',
  'tabBarVisibility'
])
const rules: Record<string, Rule> = Object.fromEntries(
  Object.entries(schema).filter(([key]) => !retiredWindowKeys.has(key))
)
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
  for (const key of retiredWindowKeys) delete defaults[key]
  if (dark) defaults.theme = 'dark'
  return defaults as UserPreferences & Record<string, unknown>
}

/** Invalid files are kept read-only; valid files retain unknown keys without interpreting them. */
export class PreferenceFile {
  readonly exists: boolean
  readonly readOnly: boolean
  private readonly pathname: string
  private value: UserPreferences & Record<string, unknown>
  private raw: Record<string, unknown> = {}
  private readonly write: (pathname: string, contents: string) => void

  constructor(
    directory: string,
    options: { dark?: boolean; write?: (pathname: string, contents: string) => void } = {}
  ) {
    this.pathname = path.join(directory, 'preferences.json')
    this.exists = existsSync(this.pathname)
    this.value = preferenceDefaults(options.dark)
    this.write =
      options.write ??
      ((pathname, contents) => writeAtomic(pathname, contents, { encoding: 'utf8', mode: 0o600 }))
    let readOnly = false
    try {
      const input: unknown = JSON.parse(readFileSync(this.pathname, 'utf8'))
      if (!object(input)) throw new Error('Invalid preferences')
      this.raw = input
      for (const [key, rule] of Object.entries(rules)) {
        if (accepts(input[key], rule) && input[key] !== undefined)
          this.value[key] = structuredClone(input[key])
      }
    } catch (error) {
      readOnly = (error as NodeJS.ErrnoException).code !== 'ENOENT'
    }
    this.readOnly = readOnly
  }

  get(): UserPreferences & Record<string, unknown> {
    return structuredClone(this.value)
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
    const next = { ...this.value, ...structuredClone(patch) }
    try {
      mkdirSync(path.dirname(this.pathname), { recursive: true })
      this.write(this.pathname, JSON.stringify({ ...this.raw, ...next }, null, 2))
    } catch {
      return { status: 'failed', reason: 'storage-unavailable' }
    }
    this.value = next
    return { status: 'persisted', preferences: this.get() }
  }
}
