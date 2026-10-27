// @vitest-environment node
import { afterEach, describe, expect, it } from 'vitest'
import { mkdtempSync, mkdirSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import {
  createFileLocation,
  createStateId,
  createWorkspaceDescriptor
} from '../../../src/main/applicationState/identity'
import {
  createDefaultLayout,
  createEmptyApplicationState
} from '../../../src/shared/applicationState/defaults'
import type { DocumentSnapshot, WindowSnapshot } from '../../../src/shared/types/applicationState'

const directories: string[] = []
const temporaryDirectory = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'marktext-state-contract-'))
  directories.push(directory)
  return directory
}

afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true })
})

describe('startup state identities', () => {
  it('does not turn an empty configured path into the current working directory', () => {
    expect(() => createFileLocation('')).toThrow(/empty/i)
  })

  it('keeps workspace identity when roots are reordered, preserving each display order', () => {
    const root = temporaryDirectory()
    const a = join(root, 'a')
    const b = join(root, 'b')
    mkdirSync(a)
    mkdirSync(b)
    const first = createWorkspaceDescriptor([a, b])
    const reversed = createWorkspaceDescriptor([b, a])
    expect(first?.id).toBe(reversed?.id)
    expect(first?.roots.map((entry) => entry.location.path)).toEqual([a, b])
    expect(reversed?.roots.map((entry) => entry.location.path)).toEqual([b, a])
    expect(createWorkspaceDescriptor([a])?.id).not.toBe(first?.id)
    expect(createWorkspaceDescriptor([])).toBeNull()
  })

  it('deduplicates roots that reach the same directory through a symlink', () => {
    const root = temporaryDirectory()
    const actual = join(root, 'actual')
    const alias = join(root, 'alias')
    mkdirSync(actual)
    symlinkSync(actual, alias, process.platform === 'win32' ? 'junction' : 'dir')
    expect(createFileLocation(alias).key).toBe(createFileLocation(actual).key)
    const workspace = createWorkspaceDescriptor([alias, actual])
    expect(workspace?.roots).toHaveLength(1)
    expect(workspace?.roots[0].location.path).toBe(alias)
  })

  it('resolves a missing child through its existing parent without requiring creation', () => {
    const root = temporaryDirectory()
    const actual = join(root, 'actual')
    const alias = join(root, 'alias')
    mkdirSync(actual)
    symlinkSync(actual, alias, process.platform === 'win32' ? 'junction' : 'dir')
    const missing = createFileLocation(join(alias, 'missing', 'note.md'))
    expect(missing.canonicalPath).toBe(
      join(createFileLocation(actual).canonicalPath, 'missing', 'note.md')
    )
    expect(missing.path).toBe(resolve(alias, 'missing', 'note.md'))
    expect(missing.key).toMatch(/^[a-f0-9]{64}$/)
  })

  it('allocates independent document instances even when their resource is the same', () => {
    const resource = createFileLocation(join(temporaryDirectory(), 'note.md'))
    const first = createStateId()
    const second = createStateId()
    expect(first).toMatch(/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/)
    expect(second).not.toBe(first)
    expect(createFileLocation(resource.path)).toEqual(resource)
  })
})

describe('window defaults and contract fixtures', () => {
  it('keeps global defaults separate from independently mutable window layouts', () => {
    const preferences = { tocPosition: 'right' as const, sourceCodeModeEnabled: true }
    const first = createDefaultLayout(preferences)
    const second = createDefaultLayout(preferences)
    first.sidebar.visible = true
    first.outline.preferredWidthPx = 400
    expect(second.sidebar.visible).toBe(false)
    expect(second.outline.preferredWidthPx).toBe(220)
    expect(second.outline.position).toBe('right')
    expect(second.modes.sourceCode).toBe(true)
    expect(preferences).toEqual({ tocPosition: 'right', sourceCodeModeEnabled: true })
  })

  it('represents two windows in one workspace without sharing document identities', () => {
    const root = temporaryDirectory()
    const workspace = createWorkspaceDescriptor([root])
    const location = createFileLocation(join(root, 'note.md'))
    const document = (id: string): DocumentSnapshot => ({
      id,
      title: 'note.md',
      resource: { kind: 'file', location, pendingCreation: true },
      content: { kind: 'empty' },
      readOnly: false,
      saveFormat: {
        encoding: { encoding: 'utf8', isBom: false },
        lineEnding: 'lf',
        adjustLineEndingOnSave: false,
        trimTrailingNewline: 2
      },
      view: null
    })
    const window = (id: string, tab: DocumentSnapshot): WindowSnapshot => ({
      id,
      updatedAtMs: 10,
      lastActivatedAtMs: 10,
      workspace,
      geometry: {
        normalBounds: { x: 0, y: 0, width: 1200, height: 800 },
        maximized: false,
        displayId: null
      },
      layout: createDefaultLayout(),
      projectView: { roots: [] },
      documents: [tab],
      activeDocumentId: tab.id
    })
    const state = createEmptyApplicationState(createStateId(), 10)
    const first = window(createStateId(), document(createStateId()))
    const second = window(createStateId(), document(createStateId()))
    state.session.windows = [first, second]
    state.session.activeWindowId = second.id
    first.layout.sidebar.visible = true
    expect(second.layout.sidebar.visible).toBe(false)
    expect(first.documents[0].id).not.toBe(second.documents[0].id)
    expect(first.workspace?.id).toBe(second.workspace?.id)
    expect(state.session.lastWindow).toBeNull()
    expect(JSON.parse(JSON.stringify(state))).toEqual(state)
  })
})
