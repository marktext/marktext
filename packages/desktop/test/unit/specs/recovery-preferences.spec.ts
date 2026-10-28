// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { PreferenceFile, preferenceDefaults } from '../../../src/main/preferences/preferenceFile'

const profiles: string[] = []
const profile = () => {
  const path = mkdtempSync(join(tmpdir(), 'mt-preferences-'))
  profiles.push(path)
  return path
}
afterEach(() =>
  profiles.splice(0).forEach((path) => rmSync(path, { recursive: true, force: true }))
)

describe('tolerant preference persistence', () => {
  it('uses safe defaults without writing on load', () => {
    const directory = profile()
    const file = new PreferenceFile(directory)
    expect(file.get()).toMatchObject({
      startUpAction: 'restoreAll',
      restoreEditors: true,
      restoreViewState: true,
      restoreLayoutState: true
    })
    expect(() => readFileSync(join(directory, 'preferences.json'))).toThrow()
    expect(file.update({ startUpAction: 'restoreLastWindow' }).status).toBe('persisted')
    expect(
      JSON.parse(readFileSync(join(directory, 'preferences.json'), 'utf8')).startUpAction
    ).toBe('restoreLastWindow')
  })
  it('defaults invalid fields independently and keeps unknown keys without migrations', () => {
    const directory = profile()
    writeFileSync(
      join(directory, 'preferences.json'),
      JSON.stringify({
        startUpAction: 'lastState',
        fontSize: 'large',
        autoSave: true,
        tocPosition: 'right',
        legacy: { value: 4 }
      })
    )
    const file = new PreferenceFile(directory)
    expect(file.get()).toMatchObject({
      startUpAction: 'restoreAll',
      fontSize: 16,
      autoSave: true,
      tocPosition: 'right'
    })
    file.update({ restoreEditors: false })
    expect(JSON.parse(readFileSync(join(directory, 'preferences.json'), 'utf8')).legacy).toEqual({
      value: 4
    })
  })
  it.each(['{bad', '[]', 'null'])('protects malformed configuration: %s', (input) => {
    const directory = profile()
    const path = join(directory, 'preferences.json')
    writeFileSync(path, input)
    const file = new PreferenceFile(directory)
    expect(file.readOnly).toBe(true)
    expect(file.update({ autoSave: true })).toEqual({
      status: 'failed',
      reason: 'storage-unavailable'
    })
    expect(readFileSync(path, 'utf8')).toBe(input)
  })
  it('survives an unreadable path and rejects invalid writes without changing memory', () => {
    const directory = profile()
    mkdirSync(join(directory, 'preferences.json'))
    const file = new PreferenceFile(directory)
    expect(file.get()).toEqual(preferenceDefaults())
    expect(file.update({ restoreEditors: 'yes' })).toEqual({
      status: 'failed',
      reason: 'invalid-data'
    })
    expect(file.get().restoreEditors).toBe(true)
  })
  it('reports write failure without publishing changed preferences', () => {
    const file = new PreferenceFile(profile(), {
      write: () => {
        throw new Error('full')
      }
    })
    expect(file.update({ fontSize: 20 })).toEqual({
      status: 'failed',
      reason: 'storage-unavailable'
    })
    expect(file.get().fontSize).toBe(16)
  })
  it('returns detached objects and validates schema unions, arrays and number bounds', () => {
    const file = new PreferenceFile(profile())
    const first = file.get()
    first.searchExclusions.push('changed')
    expect(file.get().searchExclusions).toEqual([])
    expect(file.update({ tabSize: 'tab', searchExclusions: ['cache'], zoom: 1.5 }).status).toBe(
      'persisted'
    )
    for (const patch of [
      { zoom: 99 },
      { fontSize: NaN },
      { searchExclusions: [1] },
      { defaultEncoding: 'unknown' }
    ]) {
      expect(file.update(patch).status).toBe('failed')
    }
  })
})
