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

// The dirs are built with path.join, so a Windows runner spells them with
// backslashes; the expectations have to be built the same way.
describe('extraPathDirs: where a user-level package manager puts its global bins (#5518)', () => {
  it('covers pnpm and ~/.local/bin on darwin', () => {
    const home = '/Users/someone'
    const dirs = extraPathDirs('darwin', { HOME: home })
    expect(dirs).toContain(path.join(home, 'Library', 'pnpm'))
    expect(dirs).toContain(path.join(home, '.local', 'bin'))
    expect(dirs).toContain('/opt/homebrew/bin')
  })

  it('covers pnpm and ~/.local/bin on linux', () => {
    const home = '/home/someone'
    const dirs = extraPathDirs('linux', { HOME: home })
    expect(dirs).toContain(path.join(home, '.local', 'share', 'pnpm'))
    expect(dirs).toContain(path.join(home, '.local', 'bin'))
  })

  it('covers the npm prefix the user configured', () => {
    const dirs = extraPathDirs('linux', { HOME: '/home/someone', npm_config_prefix: '/opt/node' })
    expect(dirs).toContain(path.join('/opt/node', 'bin'))
  })

  it('lists an npm prefix that is already covered only once', () => {
    // Its three common values are all dirs the lists above already carry.
    for (const prefix of ['/usr/local', '/opt/homebrew', '/home/someone/.npm-global']) {
      const dirs = extraPathDirs('linux', { HOME: '/home/someone', npm_config_prefix: prefix })
      const wanted = path.join(prefix, 'bin')
      expect(dirs.filter((dir) => dir === wanted), `duplicated ${wanted}`).toHaveLength(1)
    }
  })

  it('drops an npm prefix that no process can look in', () => {
    // npm leaves `~` unexpanded when it is set that way in .npmrc.
    const dirs = extraPathDirs('linux', { HOME: '/home/someone', npm_config_prefix: '~/.npm-glob' })
    expect(dirs.every((dir) => path.isAbsolute(dir))).toBe(true)
  })

  it('yields nothing without a home dir to anchor on', () => {
    const dirs = extraPathDirs('darwin', {})
    expect(dirs.every((dir) => path.isAbsolute(dir))).toBe(true)
    expect(dirs.some((dir) => dir.includes('undefined'))).toBe(false)
  })

  it('covers the Windows package-manager shim dirs, which are on no PATH', () => {
    const dirs = extraPathDirs('win32', {
      ProgramData: 'C:\\ProgramData',
      USERPROFILE: 'C:\\Users\\someone',
      LOCALAPPDATA: 'C:\\Users\\someone\\AppData\\Local'
    })
    expect(dirs).toContain(path.join('C:\\ProgramData', 'chocolatey', 'bin'))
    expect(dirs).toContain(path.join('C:\\Users\\someone', 'scoop', 'shims'))
    expect(dirs).toContain(
      path.join('C:\\Users\\someone\\AppData\\Local', 'Microsoft', 'WinGet', 'Links')
    )
  })

  it('yields nothing on win32 without the folders to anchor on', () => {
    expect(extraPathDirs('win32', {})).toEqual([])
  })
})
