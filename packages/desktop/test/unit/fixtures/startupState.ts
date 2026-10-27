import { createStateId, contentSha256 } from '../../../src/main/applicationState/identity'
import {
  createDefaultLayout,
  createEmptyApplicationState
} from '../../../src/shared/applicationState/defaults'
import type {
  ApplicationState,
  DirtyRecoveryRecord,
  WindowSnapshot
} from '../../../src/shared/types/applicationState'

export const windowSnapshot = (): WindowSnapshot => ({
  id: createStateId(),
  updatedAtMs: 10,
  lastActivatedAtMs: 10,
  workspace: null,
  geometry: {
    normalBounds: { x: 0, y: 0, width: 1200, height: 800 },
    maximized: false,
    displayId: null
  },
  layout: createDefaultLayout(),
  projectView: { roots: [] },
  documents: [],
  activeDocumentId: null
})

export const applicationState = (windows: WindowSnapshot[] = []): ApplicationState => ({
  ...createEmptyApplicationState(createStateId(), 10),
  session: {
    id: createStateId(),
    lifecycle: 'running',
    windows,
    activeWindowId: windows[0]?.id ?? null,
    lastWindow: null
  }
})

export const dirtyRecord = (
  ownerWindowId = createStateId(),
  markdown = 'Latest draft\n'
): DirtyRecoveryRecord => {
  const documentId = createStateId()
  return {
    schemaVersion: 1,
    status: 'dirty',
    ownerWindowId,
    documentId,
    contentRevision: 1,
    updatedAtMs: 10,
    markdown,
    contentSha256: contentSha256(markdown),
    baseline: null,
    document: {
      id: documentId,
      title: 'Untitled-1',
      resource: { kind: 'untitled' },
      content: { kind: 'recovery', contentRevision: 1 },
      readOnly: false,
      saveFormat: {
        encoding: { encoding: 'utf8', isBom: false },
        lineEnding: 'lf',
        adjustLineEndingOnSave: false,
        trimTrailingNewline: 2
      },
      view: null
    }
  }
}
