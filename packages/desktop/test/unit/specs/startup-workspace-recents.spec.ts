import { describe, expect, it } from 'vitest'
import {
  createDefaultLayout,
  createEmptyApplicationState
} from '../../../src/shared/applicationState/defaults'
import { rememberWindowContext } from '../../../src/shared/applicationState/workspaceRecents'
import type {
  ApplicationState,
  DocumentSnapshot,
  WindowSnapshot
} from '../../../src/shared/types/applicationState'

const file = (name: string): DocumentSnapshot => ({
  id: `document-${name}`,
  title: name,
  resource: {
    kind: 'file',
    pendingCreation: false,
    location: { path: `/notes/${name}.md`, canonicalPath: `/notes/${name}.md`, key: `file-${name}` }
  },
  content: {
    kind: 'disk',
    baseline: { exists: true, sizeBytes: 1, mtimeMs: 1, rawSha256: 'a'.repeat(64) }
  },
  saveFormat: {
    encoding: { encoding: 'utf8', isBom: false },
    lineEnding: 'lf',
    adjustLineEndingOnSave: false,
    trimTrailingNewline: 2
  },
  readOnly: false,
  view: null
})
const window = (id: string, context = 'notes', documents = [file('a')]): WindowSnapshot => ({
  id,
  updatedAtMs: 10,
  lastActivatedAtMs: 10,
  workspace: {
    id: context,
    roots: [
      { id: context, location: { path: `/${context}`, canonicalPath: `/${context}`, key: context } }
    ]
  },
  layout: createDefaultLayout(),
  projectView: { roots: [] },
  geometry: {
    normalBounds: { x: 0, y: 0, width: 1200, height: 800 },
    maximized: false,
    displayId: null
  },
  documents,
  activeDocumentId: documents[0]?.id ?? null
})
const active = (state: ApplicationState, windowId: string): ApplicationState => ({
  ...state,
  session: { ...state.session, activeWindowId: windowId }
})
const initial = (): ApplicationState => createEmptyApplicationState('session', 1)

describe('workspace reopening templates', () => {
  it('captures ordinary metadata without draft identities, bodies or recovery references', () => {
    const saved = { ...file('a'), id: 'SECRET_DOCUMENT_ID', markdown: 'SECRET_BODY' }
    const draft: DocumentSnapshot = {
      ...file('draft'),
      resource: { kind: 'untitled' },
      content: { kind: 'recovery', contentRevision: 2 }
    }
    const pending: DocumentSnapshot = {
      ...file('pending'),
      resource: {
        kind: 'file',
        location: { path: '/pending.md', canonicalPath: '/pending.md', key: 'pending' },
        pendingCreation: true
      },
      content: { kind: 'empty' }
    }
    const snapshot = window('a', 'notes', [saved, draft, pending])
    const result = rememberWindowContext(active(initial(), 'a'), snapshot)
    expect(result.recentWorkspaces[0].files.map((entry) => entry.location.key)).toEqual(['file-a'])
    expect(JSON.stringify(result.recentWorkspaces)).not.toMatch(
      /SECRET_BODY|SECRET_DOCUMENT_ID|contentRevision/
    )
    expect(result.lastActiveWorkspaceId).toBe('notes')
    expect(snapshot.documents).toHaveLength(3)
  })

  it('uses confirmed disk format for a modified file, not its unsaved format change', () => {
    const saved = file('a')
    const dirty: DocumentSnapshot = structuredClone(saved)
    dirty.content = { kind: 'recovery', contentRevision: 2 }
    dirty.saveFormat.encoding.encoding = 'ascii'
    const result = rememberWindowContext(active(initial(), 'a'), window('a', 'notes', [dirty]), {
      savedDocuments: new Map([[saved.id, saved]])
    })
    expect(result.recentWorkspaces[0].files[0].saveFormat.encoding.encoding).toBe('utf8')
    const unknown = rememberWindowContext(active(initial(), 'a'), window('a', 'notes', [dirty]))
    expect(unknown.recentWorkspaces[0].files).toEqual([])
  })

  it('keeps the most recently active window as owner of the same workspace template', () => {
    let state = rememberWindowContext(active(initial(), 'a'), window('a'))
    const second = window('b')
    second.layout.sidebar.visible = true
    state = rememberWindowContext(active(state, 'b'), second)
    const delayed = window('a')
    delayed.updatedAtMs = 100
    const result = rememberWindowContext(state, delayed)
    expect(result.recentWorkspaces[0].sourceWindowId).toBe('b')
    expect(result.recentWorkspaces[0].layout.sidebar.visible).toBe(true)
  })

  it('refreshes a background owner without moving its workspace ahead of the active one', () => {
    let state = rememberWindowContext(active(initial(), 'a'), window('a', 'first'))
    state = rememberWindowContext(active(state, 'b'), window('b', 'second'))
    const background = window('a', 'first')
    background.updatedAtMs = 100
    background.layout.outline.position = 'right'
    const result = rememberWindowContext(state, background)
    expect(result.recentWorkspaces.map((entry) => entry.workspace.id)).toEqual(['second', 'first'])
    expect(result.recentWorkspaces[1].layout.outline.position).toBe('right')
    expect(result.lastActiveWorkspaceId).toBe('second')
  })

  it('bounds ordinary templates without changing live windows or their document arrays', () => {
    const windows = [window('a', 'first'), window('b', 'second'), window('c', 'third')]
    let state = initial()
    state.session.windows = windows
    for (const snapshot of windows) {
      state = rememberWindowContext(active(state, snapshot.id), snapshot, {
        limits: { recentWorkspaces: 2 }
      })
    }
    expect(state.recentWorkspaces.map((entry) => entry.workspace.id)).toEqual(['third', 'second'])
    expect(state.session.windows).toHaveLength(3)
    expect(state.session.windows.every((entry) => entry.documents.length === 1)).toBe(true)
  })

  it('keeps the active ordinary file when applying the template file limit', () => {
    const documents = [file('a'), file('b'), file('c'), file('d')]
    const snapshot = window('a', 'notes', documents)
    snapshot.activeDocumentId = documents[3].id
    const result = rememberWindowContext(active(initial(), 'a'), snapshot, {
      limits: { filesPerRecentWorkspace: 2 }
    })
    expect(result.recentWorkspaces[0].files.map((entry) => entry.location.key)).toEqual([
      'file-a',
      'file-d'
    ])
    expect(result.recentWorkspaces[0].activeFileKey).toBe('file-d')
    expect(snapshot.documents).toHaveLength(4)
  })

  it('remembers empty-window layout separately without clearing the last active workspace', () => {
    const previous = rememberWindowContext(active(initial(), 'a'), window('a'))
    const empty = { ...window('empty'), workspace: null, documents: [], activeDocumentId: null }
    empty.layout.outline.position = 'right'
    const result = rememberWindowContext(active(previous, 'empty'), empty)
    expect(result.recentEmptyWindowLayout?.layout.outline.position).toBe('right')
    expect(result.lastActiveWorkspaceId).toBe('notes')
    expect(result.recentWorkspaces).toEqual(previous.recentWorkspaces)
    expect(rememberWindowContext(previous, empty).recentEmptyWindowLayout).toBeNull()
  })

  it('does not share mutable layout or encoding objects with the input window', () => {
    const snapshot = window('a')
    const state = active(initial(), 'a')
    const result = rememberWindowContext(state, snapshot)
    snapshot.layout.sidebar.visible = true
    snapshot.documents[0].saveFormat.encoding.encoding = 'ascii'
    expect(result.recentWorkspaces[0].layout.sidebar.visible).toBe(false)
    expect(result.recentWorkspaces[0].files[0].saveFormat.encoding.encoding).toBe('utf8')
    expect(state.recentWorkspaces).toEqual([])
  })

  it('keeps only valid root-relative collapse paths and bounds ordinary view caches', () => {
    const snapshot = window('a')
    snapshot.projectView.roots = [
      { rootId: 'notes', collapsedPaths: ['a', 'a', '../outside', '/outside', 'b', 'c'] },
      { rootId: 'unknown', collapsedPaths: ['other'] }
    ]
    const result = rememberWindowContext(active(initial(), 'a'), snapshot, {
      limits: { collapsedPathsPerRoot: 2 }
    })
    expect(result.recentWorkspaces[0].projectView.roots).toEqual([
      { rootId: 'notes', collapsedPaths: ['a', 'b'] }
    ])
  })
})
