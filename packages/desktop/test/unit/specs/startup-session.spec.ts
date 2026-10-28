import { describe, expect, it } from 'vitest'
import {
  createDefaultLayout,
  createEmptyApplicationState
} from '../../../src/shared/applicationState/defaults'
import {
  activateSessionWindow,
  closeSessionWindow,
  finishSession,
  getActiveSessionWindow,
  updateSessionWindow
} from '../../../src/shared/applicationState/session'
import { buildStartupPlan } from '../../../src/shared/applicationState/startupPlan'
import type {
  ApplicationState,
  DocumentSnapshot,
  WindowSnapshot,
  WorkspaceDescriptor,
  RecoveryRecord
} from '../../../src/shared/types/applicationState'
import type { RecoveryPreferences } from '../../../src/shared/types/preferences'

const preferences: RecoveryPreferences = {
  startUpAction: 'restoreAll',
  defaultDirectoryToOpen: '',
  restoreLayoutState: true,
  restoreEditors: true,
  restoreViewState: true
}
const workspace: WorkspaceDescriptor = {
  id: 'workspace',
  roots: [{ id: 'root', location: { path: '/notes', canonicalPath: '/notes', key: 'root' } }]
}
const document = (id: string, dirty = false): DocumentSnapshot => ({
  id,
  title: id,
  resource: dirty
    ? { kind: 'untitled' }
    : {
      kind: 'file',
      pendingCreation: false,
      location: { path: '/notes/a.md', canonicalPath: '/notes/a.md', key: 'file' }
    },
  content: dirty
    ? { kind: 'recovery', contentRevision: 1 }
    : {
      kind: 'disk',
      baseline: { exists: true, sizeBytes: 1, mtimeMs: 1, rawSha256: 'a'.repeat(64) }
    },
  readOnly: false,
  saveFormat: {
    encoding: { encoding: 'utf8', isBom: false },
    lineEnding: 'lf',
    adjustLineEndingOnSave: false,
    trimTrailingNewline: 2
  },
  view: null
})
const window = (id: string, documents = [document(`${id}-file`)]): WindowSnapshot => ({
  id,
  updatedAtMs: 1,
  lastActivatedAtMs: 1,
  workspace,
  geometry: {
    normalBounds: { x: 0, y: 0, width: 1200, height: 800 },
    maximized: false,
    displayId: null
  },
  layout: createDefaultLayout(),
  projectView: { roots: [] },
  documents,
  activeDocumentId: documents[0]?.id ?? null
})
const state = (...windows: WindowSnapshot[]): ApplicationState => ({
  ...createEmptyApplicationState('session', 1),
  session: {
    id: 'session',
    lifecycle: 'running',
    windows,
    activeWindowId: windows.at(-1)?.id ?? null,
    lastWindow: null
  }
})

describe('latest session membership', () => {
  it('removes a separately closed window but keeps the remaining one for quit', () => {
    const original = state(window('a'), window('b')).session
    const closed = closeSessionWindow(original, 'a')
    expect(finishSession(closed).windows.map((entry) => entry.id)).toEqual(['b'])
    expect(original.windows).toHaveLength(2)
    expect(closed.lastWindow).toBeNull()
  })

  it('captures every window before quit and keeps only one last-window fallback', () => {
    const original = state(window('a'), window('b')).session
    expect(finishSession(original).windows.map((entry) => entry.id)).toEqual(['a', 'b'])
    const last = closeSessionWindow(closeSessionWindow(original, 'a'), 'b')
    expect(last.windows).toEqual([])
    expect(last.lastWindow?.id).toBe('b')
    expect(last.id).toBe(original.id)
  })

  it('updates a window without duplicating or sharing the incoming snapshot', () => {
    const snapshot = window('a')
    const original = state(window('a'), window('b')).session
    const session = updateSessionWindow(original, snapshot)
    snapshot.layout.sidebar.visible = true
    expect(session.windows.map((entry) => entry.id)).toEqual(['a', 'b'])
    expect(session.windows[0].layout.sidebar.visible).toBe(false)
  })

  it('updates activation without mutating the previous session', () => {
    const original = state(window('a'), window('b')).session
    const session = activateSessionWindow(original, 'a', 50)
    expect(original.windows[0].lastActivatedAtMs).toBe(1)
    expect(session.windows[0].lastActivatedAtMs).toBe(50)
    expect(session.activeWindowId).toBe('a')
    expect(activateSessionWindow(original, 'missing', 50)).toBe(original)
  })

  it('uses the same active-window fallback for closing and startup planning', () => {
    const first = window('a')
    const latest = { ...window('b'), lastActivatedAtMs: 50 }
    expect(getActiveSessionWindow([first, latest], 'a')).toBe(first)
    expect(getActiveSessionWindow([first, latest], 'missing')).toBe(latest)
    expect(getActiveSessionWindow([], null)).toBeNull()
  })
})

describe('startup planning without filesystem or Electron effects', () => {
  it('gives explicit input priority, including an explicit request that failed to resolve', () => {
    const previous = state(window('old'))
    expect(
      buildStartupPlan({ state: previous, preferences, request: { kind: 'explicit', targets: [] } })
    ).toMatchObject([{ kind: 'empty' }])
    const targets = [{ kind: 'file' as const, pathname: '/new.md', readOnly: false }]
    expect(
      buildStartupPlan({ state: previous, preferences, request: { kind: 'explicit', targets } })
    ).toEqual([{ kind: 'explicit', targets }])
  })

  it('selects only the last active window when requested', () => {
    const previous = state(window('a'), window('b'))
    expect(
      buildStartupPlan({
        state: previous,
        preferences: { ...preferences, startUpAction: 'restoreLastWindow' }
      })
    ).toMatchObject([{ kind: 'restore', snapshot: { id: 'b' } }])
  })

  it('filters saved files without removing the selected window’s unsaved document', () => {
    const previous = state(window('a', [document('saved'), document('dirty', true)]))
    const result = buildStartupPlan({
      state: previous,
      preferences: { ...preferences, restoreEditors: false }
    })
    expect(result).toMatchObject([{ kind: 'restore', snapshot: { documents: [{ id: 'dirty' }] } }])
    expect(previous.session.windows[0].documents).toHaveLength(2)
  })

  it('does not open many file-only empty windows after filtering ordinary tabs', () => {
    const first = { ...window('a'), workspace: null }
    const second = { ...window('b'), workspace: null }
    const result = buildStartupPlan({
      state: state(first, second),
      preferences: { ...preferences, restoreEditors: false }
    })
    expect(result).toMatchObject([{ kind: 'empty' }])
  })

  it('uses only selected-window recovery records and preserves newer metadata revisions', () => {
    const dirty = document('dirty', true)
    dirty.content = { kind: 'recovery', contentRevision: 2 }
    const previous = state(window('a', [dirty]))
    const discarded: RecoveryRecord = {
      schemaVersion: 1,
      status: 'discarded',
      ownerWindowId: 'a',
      documentId: dirty.id,
      contentRevision: 1,
      updatedAtMs: 1
    }
    const older = buildStartupPlan({
      state: previous,
      preferences,
      recoveryRecords: new Map([['a', [discarded]]])
    })
    expect(older).toMatchObject([
      {
        kind: 'restore',
        snapshot: { documents: [{ id: 'dirty', content: { contentRevision: 2 } }] }
      }
    ])
    const removed = buildStartupPlan({
      state: previous,
      preferences,
      recoveryRecords: new Map([
        ['a', [{ ...discarded, contentRevision: 2 }]],
        ['closed-window', [{ ...discarded, ownerWindowId: 'closed-window' }]]
      ])
    })
    expect(removed).toMatchObject([{ kind: 'restore', snapshot: { id: 'a', documents: [] } }])
    expect(previous.session.windows[0].documents).toHaveLength(1)
  })

  it('restores only the last-window fallback and reuses only empty-window layout in blank mode', () => {
    const previous = state()
    previous.session.lastWindow = window('last')
    expect(buildStartupPlan({ state: previous, preferences })).toMatchObject([
      { kind: 'restore', snapshot: { id: 'last' } }
    ])
    const remembered = createDefaultLayout()
    remembered.outline.position = 'right'
    previous.recentEmptyWindowLayout = { updatedAtMs: 1, layout: remembered }
    expect(
      buildStartupPlan({ state: previous, preferences: { ...preferences, startUpAction: 'blank' } })
    ).toMatchObject([{ kind: 'empty', layout: { outline: { position: 'right' } } }])
    expect(
      buildStartupPlan({
        state: previous,
        preferences: { ...preferences, startUpAction: 'blank', restoreLayoutState: false }
      })
    ).toMatchObject([{ kind: 'empty', layout: { outline: { position: 'left' } } }])
  })

  it('does not resurrect a closed tab from an unreferenced saved marker', () => {
    const saved = document('closed')
    const marker: RecoveryRecord = {
      schemaVersion: 1,
      status: 'saved',
      ownerWindowId: 'a',
      documentId: saved.id,
      contentRevision: 1,
      updatedAtMs: 1,
      document: saved
    }
    expect(
      buildStartupPlan({
        state: state(window('a', [])),
        preferences,
        recoveryRecords: new Map([['a', [marker]]])
      })
    ).toMatchObject([{ kind: 'restore', snapshot: { documents: [] } }])
  })

  it('keeps newer metadata reading state without rewriting the unchanged recovery body', () => {
    const dirty = document('dirty', true)
    dirty.view = {
      contentSha256: 'a'.repeat(64),
      sourceSelection: null,
      muyaSelection: null,
      sourceScrollTopPx: 200,
      renderedScrollTopPx: 100,
      collapsedOutlineKeys: ['heading']
    }
    const snapshot = window('a', [dirty])
    snapshot.updatedAtMs = 20
    const marker: RecoveryRecord = {
      schemaVersion: 1,
      status: 'dirty',
      ownerWindowId: 'a',
      documentId: dirty.id,
      contentRevision: 1,
      updatedAtMs: 10,
      document: { ...dirty, view: null },
      markdown: 'Draft',
      contentSha256: 'a'.repeat(64),
      baseline: null
    }
    expect(
      buildStartupPlan({
        state: state(snapshot),
        preferences,
        recoveryRecords: new Map([['a', [marker]]])
      })
    ).toMatchObject([{ kind: 'restore', snapshot: { documents: [{ view: dirty.view }] } }])
  })

  it('uses a saved marker to complete an interrupted Save As of a known document', () => {
    const dirty = document('dirty', true)
    const saved = { ...document(dirty.id), title: 'Saved As.md' }
    const marker: RecoveryRecord = {
      schemaVersion: 1,
      status: 'saved',
      ownerWindowId: 'a',
      documentId: dirty.id,
      contentRevision: 1,
      updatedAtMs: 2,
      document: saved
    }
    expect(
      buildStartupPlan({
        state: state(window('a', [dirty])),
        preferences,
        recoveryRecords: new Map([['a', [marker]]])
      })
    ).toMatchObject([{ kind: 'restore', snapshot: { documents: [saved] } }])
  })

  for (const action of [
    'restoreAll',
    'restoreLastWindow',
    'openLastFolder',
    'folder',
    'blank'
  ] as const) {
    for (const restoreEditors of [true, false]) {
      for (const restoreLayoutState of [true, false]) {
        for (const restoreViewState of [true, false]) {
          it(`${action}: editors=${restoreEditors}, layout=${restoreLayoutState}, view=${restoreViewState}`, () => {
            const previous = state(window('a'))
            previous.session.windows[0].layout.sidebar.visible = true
            const reading = {
              contentSha256: 'a'.repeat(64),
              sourceSelection: { anchor: { line: 5, ch: 2 }, focus: { line: 5, ch: 2 } },
              muyaSelection: null,
              sourceScrollTopPx: 100,
              renderedScrollTopPx: 120,
              collapsedOutlineKeys: ['heading']
            }
            previous.session.windows[0].documents[0].view = reading
            previous.recentWorkspaces = [
              {
                workspace,
                updatedAtMs: 1,
                sourceWindowId: 'a',
                layout: previous.session.windows[0].layout,
                projectView: { roots: [] },
                files: [
                  {
                    location: { path: '/notes/a.md', canonicalPath: '/notes/a.md', key: 'file' },
                    readOnly: false,
                    saveFormat: previous.session.windows[0].documents[0].saveFormat,
                    view: reading
                  }
                ],
                activeFileKey: 'file'
              }
            ]
            previous.lastActiveWorkspaceId = workspace.id
            const plan = buildStartupPlan({
              state: previous,
              preferences: {
                ...preferences,
                startUpAction: action,
                restoreEditors,
                restoreLayoutState,
                restoreViewState
              },
              configuredWorkspace: workspace
            })
            expect(plan).toHaveLength(1)
            if (plan[0].kind !== 'explicit')
              expect((plan[0].kind === 'restore' ? plan[0].snapshot.layout : plan[0].layout).sidebar.visible).toBe(restoreLayoutState && action !== 'blank')
            const entries =
              plan[0].kind === 'restore'
                ? plan[0].snapshot.documents
                : plan[0].kind === 'workspace'
                  ? plan[0].files
                  : []
            expect(entries).toHaveLength(action === 'blank' || !restoreEditors ? 0 : 1)
            if (entries.length) expect(entries[0].view).toEqual(restoreViewState ? reading : null)
            expect(previous.session.windows[0].documents[0].view).toEqual(reading)
          })
        }
      }
    }
  }
})
