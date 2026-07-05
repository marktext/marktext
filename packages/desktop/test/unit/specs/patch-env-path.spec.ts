import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { patchEnvPath } from 'main_renderer/app/envPath'

const origPlatform = process.platform
const origPath = process.env.PATH

const setPlatform = (value: string): void => {
  Object.defineProperty(process, 'platform', { value, configurable: true })
}

afterEach(() => {
  setPlatform(origPlatform)
  process.env.PATH = origPath
})

describe('patchEnvPath (#2751)', () => {
  it('adds Homebrew and standard bin dirs on darwin when missing', () => {
    setPlatform('darwin')
    process.env.PATH = '/usr/bin'
    patchEnvPath()
    const dirs = (process.env.PATH ?? '').split(path.delimiter)
    expect(dirs).toContain('/opt/homebrew/bin')
    expect(dirs).toContain('/usr/local/bin')
    expect(dirs).toContain('/Library/TeX/texbin')
  })

  it('adds standard bin dirs on linux', () => {
    setPlatform('linux')
    process.env.PATH = '/snap/bin'
    patchEnvPath()
    expect((process.env.PATH ?? '').split(path.delimiter)).toContain('/usr/local/bin')
  })

  it('does not duplicate an entry that is already present', () => {
    setPlatform('darwin')
    process.env.PATH = ['/opt/homebrew/bin', '/usr/bin'].join(path.delimiter)
    patchEnvPath()
    const homebrew = (process.env.PATH ?? '')
      .split(path.delimiter)
      .filter(d => d === '/opt/homebrew/bin')
    expect(homebrew).toHaveLength(1)
  })

  it('leaves PATH untouched on win32', () => {
    setPlatform('win32')
    process.env.PATH = 'C:\\Windows'
    patchEnvPath()
    expect(process.env.PATH).toBe('C:\\Windows')
  })
})
