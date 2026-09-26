import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// The NSIS script cannot be executed here, so assert the properties that keep
// the Windows Markdown association alive across an update (#4966).
// electron-builder runs the previous version's uninstaller with `--updated`
// before it installs, and electron-updater runs the new installer with `/S`.
// Registering behind a prompt while unregistering unconditionally therefore
// left the ProgId deleted after every update: an "Open with" choice pinned to
// it pointed at nothing and Explorer's double-click silently did nothing.

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const script = readFileSync(
  path.resolve(__dirname, '../../../build/windows/installer.nsh'),
  'utf8'
)

const EXTENSIONS = ['.md', '.markdown', '.mmd', '.mdown', '.mdtxt', '.mdtext', '.mdx']

const macroBody = (name: string): string => {
  const start = script.indexOf(`!macro ${name}`)
  expect(start, `the ${name} macro is missing`).toBeGreaterThan(-1)
  const end = script.indexOf('!macroend', start)
  expect(end, `the ${name} macro is not terminated`).toBeGreaterThan(start)
  return script.slice(start, end)
}

const customInstall = macroBody('customInstall')
const customUnInstall = macroBody('customUnInstall')

describe('Windows Markdown file association (build/windows/installer.nsh)', () => {
  it('keeps the ProgId name an existing "Open with" choice points at', () => {
    expect(script).toMatch(/!define\s+MT_PROGID\s+"MarkText\.Document"/)
  })

  it('registers without prompting, so an update run with /S still restores it', () => {
    expect(customInstall).not.toMatch(/MessageBox/)
  })

  it('claims every Markdown extension for the ProgId', () => {
    for (const ext of EXTENSIONS) {
      expect(customInstall, `${ext} is not associated`).toContain(`"${ext}"`)
    }
    expect(customInstall).toContain('MT_PROGID')
  })

  it('offers the ProgId in the "Open with" dialog, which is what a UserChoice pins', () => {
    expect(script).toContain('OpenWithProgids')
  })

  it('quotes the executable path in every open command it writes', () => {
    const commands = script.match(/shell\\open\\command[\s\S]*?marktext\.exe/g) ?? []
    expect(commands.length, 'no open command is written').toBeGreaterThan(0)
    for (const command of commands) {
      // Unquoted, `C:\Program Files\...\marktext.exe "%1"` runs `C:\Program`.
      expect(command).toContain('"$INSTDIR\\marktext.exe')
    }
  })

  it('keeps the association when the uninstaller runs as part of an update', () => {
    const guardStart = customUnInstall.search(/\$\{ifNot\}\s+\$\{isUpdated\}/)
    expect(guardStart, 'the removal is not guarded by isUpdated').toBeGreaterThan(-1)
    const guarded = customUnInstall.slice(guardStart)
    const guardEnd = guarded.search(/\$\{endIf\}/i)
    expect(guardEnd, 'the isUpdated guard is not closed').toBeGreaterThan(-1)
    const guardedBody = guarded.slice(0, guardEnd)
    expect(guardedBody).toContain('MT_PROGID')
    for (const ext of EXTENSIONS) {
      expect(guardedBody, `${ext} is unregistered outside the guard`).toContain(`"${ext}"`)
    }
  })

  it('does not delete the extension keys themselves on uninstall', () => {
    // They also hold the OpenWithProgids entries of every other Markdown
    // editor the user has installed.
    for (const ext of EXTENSIONS) {
      expect(customUnInstall, `${ext} is deleted wholesale`).not.toMatch(
        new RegExp(`DeleteRegKey[^\\n]*Classes\\\\\\${ext}"`)
      )
    }
  })
})
