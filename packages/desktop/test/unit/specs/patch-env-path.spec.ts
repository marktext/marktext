import path from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { extraPathDirs, patchEnvPath } from 'main_renderer/app/envPath'

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

describe('extraPathDirs: where a user-level package manager puts its global bins (#5518)', () => {
  it('covers pnpm and ~/.local/bin on darwin', () => {
    const dirs = extraPathDirs('darwin', { HOME: '/Users/someone' })
    expect(dirs).toContain('/Users/someone/Library/pnpm')
    expect(dirs).toContain('/Users/someone/.local/bin')
    expect(dirs).toContain('/opt/homebrew/bin')
  })

  it('covers pnpm and ~/.local/bin on linux', () => {
    const dirs = extraPathDirs('linux', { HOME: '/home/someone' })
    expect(dirs).toContain('/home/someone/.local/share/pnpm')
    expect(dirs).toContain('/home/someone/.local/bin')
  })

  it('covers the npm prefix the user configured', () => {
    const dirs = extraPathDirs('linux', { HOME: '/home/someone', npm_config_prefix: '/opt/node' })
    expect(dirs).toContain('/opt/node/bin')
  })

  it('yields nothing without a home dir to anchor on', () => {
    expect(extraPathDirs('darwin', {}).every((dir) => path.isAbsolute(dir))).toBe(true)
    expect(extraPathDirs('darwin', {})).not.toContain('undefined/Library/pnpm')
  })

  it('is empty on win32, whose GUI apps do inherit the user PATH', () => {
    expect(extraPathDirs('win32', { HOME: 'C:\\Users\\someone' })).toEqual([])
  })
})
