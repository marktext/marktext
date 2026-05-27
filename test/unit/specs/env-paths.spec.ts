import { describe, it, expect } from 'vitest'
import path from 'path'
import EnvPaths from 'common/envPaths'

const SEP = path.sep

describe('EnvPaths constructor', () => {
  it('throws when userDataPath is an empty string', () => {
    expect(() => new EnvPaths('')).toThrow('"userDataPath" is not set.')
  })

  it('does not throw for a valid path', () => {
    expect(() => new EnvPaths('/tmp/marktext-test')).not.toThrow()
  })
})

describe('EnvPaths accessors', () => {
  const root = ['', 'tmp', 'marktext-test'].join(SEP)
  let ep: EnvPaths

  // beforeEach is skipped — EnvPaths is stateless after construction.
  ep = new EnvPaths(root)

  it('electronUserDataPath equals the supplied root', () => {
    expect(ep.electronUserDataPath).toBe(root)
  })

  it('userDataPath equals the supplied root', () => {
    expect(ep.userDataPath).toBe(root)
  })

  it('preferencesPath equals the supplied root', () => {
    expect(ep.preferencesPath).toBe(root)
  })

  it('dataCenterPath equals the supplied root', () => {
    expect(ep.dataCenterPath).toBe(root)
  })

  it('preferencesFilePath lives inside the root', () => {
    expect(ep.preferencesFilePath.startsWith(root)).toBe(true)
  })

  it('preferencesFilePath ends with preference.json', () => {
    expect(ep.preferencesFilePath.endsWith('preference.json')).toBe(true)
  })

  it('editorBufferStorePath lives inside the root', () => {
    expect(ep.editorBufferStorePath.startsWith(root)).toBe(true)
  })

  it('editorBufferStorePath contains "editorStates" segment', () => {
    const parts = ep.editorBufferStorePath.split(SEP)
    expect(parts).toContain('editorStates')
  })

  it('logPath lives inside the root', () => {
    expect(ep.logPath.startsWith(root)).toBe(true)
  })

  it('logPath contains the current year', () => {
    expect(ep.logPath).toContain(String(new Date().getFullYear()))
  })
})

describe('EnvPaths with Windows-style absolute path', () => {
  it('handles a path that looks like a Windows drive letter path', () => {
    // path.join will normalise this correctly on all platforms
    const root = path.join('C:', 'Users', 'test', 'AppData', 'Roaming', 'marktext')
    const ep = new EnvPaths(root)
    expect(ep.userDataPath).toBe(root)
    expect(ep.preferencesFilePath).toContain('preference.json')
  })
})
