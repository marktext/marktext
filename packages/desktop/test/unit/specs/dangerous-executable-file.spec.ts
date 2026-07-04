import { describe, expect, it } from 'vitest'
import { isDangerousExecutableFile } from 'common/filesystem/paths'

// #3575 — clicking a markdown link to a co-located script/executable used to
// call shell.openPath() with no check, so a `.js`/`.vbs`/`.bat` next to an
// untrusted document ran code (WSH JScript) on Windows without confirmation.
// This guard flags those extensions so the handler can confirm before opening.

describe('#3575 — isDangerousExecutableFile', () => {
  it('flags Windows Script Host script files', () => {
    for (const ext of ['js', 'jse', 'vbs', 'vbe', 'wsf', 'wsh', 'ws', 'wsc', 'hta']) {
      expect(isDangerousExecutableFile(`payload.${ext}`)).toBe(true)
    }
  })

  it('flags native executables, installers and batch files', () => {
    for (const ext of ['exe', 'com', 'scr', 'pif', 'cpl', 'msi', 'msp', 'bat', 'cmd']) {
      expect(isDangerousExecutableFile(`payload.${ext}`)).toBe(true)
    }
  })

  it('flags PowerShell and shortcut/registry files', () => {
    for (const ext of ['ps1', 'psm1', 'lnk', 'reg', 'inf', 'scf', 'jar']) {
      expect(isDangerousExecutableFile(`payload.${ext}`)).toBe(true)
    }
  })

  it('is case-insensitive and tolerates an absolute path', () => {
    expect(isDangerousExecutableFile('C:\\Users\\a\\Update.JS')).toBe(true)
    expect(isDangerousExecutableFile('/tmp/run.VBS')).toBe(true)
  })

  it('does not flag documents, images or markdown', () => {
    for (const name of ['note.md', 'photo.png', 'data.json', 'readme.txt', 'archive.zip', 'index.html']) {
      expect(isDangerousExecutableFile(name)).toBe(false)
    }
  })

  it('does not flag a file with no extension or an empty input', () => {
    expect(isDangerousExecutableFile('Makefile')).toBe(false)
    expect(isDangerousExecutableFile('')).toBe(false)
  })
})
