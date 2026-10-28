import { STATE_LIMITS } from '../types/applicationState'
import type {
  ApplicationState,
  DocumentSnapshot,
  PersistenceLimits,
  WindowSnapshot,
  WorkspaceFileState,
  WorkspaceRecentState
} from '../types/applicationState'
import type { DocumentViewState } from '../types/files'

/** Optional verified disk snapshots retain saved formats while live documents are dirty. */
export interface WorkspaceCaptureOptions {
  savedDocuments?: ReadonlyMap<string, DocumentSnapshot>
  limits?: Partial<PersistenceLimits>
}

const limit = (value: number | undefined, fallback: number): number =>
  value !== undefined && Number.isFinite(value) ? Math.max(1, Math.floor(value)) : fallback

const view = (state: DocumentViewState | null, maxKeys: number): DocumentViewState | null =>
  state
    ? {
      ...structuredClone(state),
      collapsedOutlineKeys: [...new Set(state.collapsedOutlineKeys)].slice(0, maxKeys)
    }
    : null

const ordinaryFiles = (
  snapshot: WindowSnapshot,
  previous: WorkspaceRecentState | undefined,
  options: WorkspaceCaptureOptions,
  maxFiles: number,
  maxOutlineKeys: number
): WorkspaceFileState[] => {
  const seen = new Set<string>()
  const files: WorkspaceFileState[] = []
  for (const document of snapshot.documents) {
    if (document.resource.kind !== 'file' || document.resource.pendingCreation) continue
    const location = document.resource.location
    if (seen.has(location.key)) continue
    let savedFormat: DocumentSnapshot['saveFormat'] | undefined
    if (document.content.kind === 'disk' && document.content.baseline.exists)
      savedFormat = document.saveFormat
    else {
      const saved = options.savedDocuments?.get(document.id)
      if (
        saved?.resource.kind === 'file' &&
        !saved.resource.pendingCreation &&
        saved.resource.location.key === location.key &&
        saved.content.kind === 'disk' &&
        saved.content.baseline.exists
      ) {
        savedFormat = saved.saveFormat
      } else
        savedFormat = previous?.files.find((file) => file.location.key === location.key)?.saveFormat
    }
    if (!savedFormat) continue
    seen.add(location.key)
    files.push({
      location: structuredClone(location),
      readOnly: document.readOnly,
      saveFormat: structuredClone(savedFormat),
      view: view(document.view, maxOutlineKeys)
    })
  }
  if (files.length <= maxFiles) return files
  const active = snapshot.documents.find((document) => document.id === snapshot.activeDocumentId)
  const activeKey = active?.resource.kind === 'file' ? active.resource.location.key : null
  const activeIndex = files.findIndex((file) => file.location.key === activeKey)
  if (activeIndex < maxFiles) return files.slice(0, maxFiles)
  return [...files.slice(0, maxFiles - 1), files[activeIndex]]
}

export const rememberWindowContext = (
  state: ApplicationState,
  snapshot: WindowSnapshot,
  options: WorkspaceCaptureOptions = {}
): ApplicationState => {
  const isActive = state.session.activeWindowId === snapshot.id
  if (!snapshot.workspace || snapshot.workspace.roots.length === 0) {
    return isActive
      ? {
        ...state,
        recentEmptyWindowLayout: {
          updatedAtMs: snapshot.updatedAtMs,
          layout: structuredClone(snapshot.layout)
        }
      }
      : state
  }
  const existing = state.recentWorkspaces.find(
    (entry) => entry.workspace.id === snapshot.workspace?.id
  )
  if (existing && !isActive && existing.sourceWindowId !== snapshot.id) return state
  if (existing?.sourceWindowId === snapshot.id && existing.updatedAtMs > snapshot.updatedAtMs)
    return state
  const maxFiles = limit(
    options.limits?.filesPerRecentWorkspace,
    STATE_LIMITS.filesPerRecentWorkspace
  )
  const maxWorkspaces = limit(options.limits?.recentWorkspaces, STATE_LIMITS.recentWorkspaces)
  const maxPaths = limit(options.limits?.collapsedPathsPerRoot, STATE_LIMITS.collapsedPathsPerRoot)
  const maxOutline = limit(
    options.limits?.collapsedOutlineKeysPerDocument,
    STATE_LIMITS.collapsedOutlineKeysPerDocument
  )
  const files = ordinaryFiles(snapshot, existing, options, maxFiles, maxOutline)
  const active = snapshot.documents.find((document) => document.id === snapshot.activeDocumentId)
  const activeKey = active?.resource.kind === 'file' ? active.resource.location.key : null
  const rootIds = new Set(snapshot.workspace.roots.map((root) => root.id))
  const entry: WorkspaceRecentState = {
    workspace: structuredClone(snapshot.workspace),
    sourceWindowId: snapshot.id,
    updatedAtMs: snapshot.updatedAtMs,
    layout: structuredClone(snapshot.layout),
    files,
    activeFileKey: files.some((file) => file.location.key === activeKey)
      ? activeKey
      : (files[0]?.location.key ?? null),
    projectView: {
      roots: snapshot.projectView.roots
        .filter((root) => rootIds.has(root.rootId))
        .map((root) => ({
          rootId: root.rootId,
          collapsedPaths: [...new Set(root.collapsedPaths)]
            .filter(
              (path) =>
                !/^(?:[/\\]|[a-zA-Z]:[/\\])/.test(path) && !path.split(/[/\\]/).includes('..')
            )
            .slice(0, maxPaths)
        }))
    }
  }
  let recents: WorkspaceRecentState[]
  if (isActive)
    recents = [
      entry,
      ...state.recentWorkspaces.filter((item) => item.workspace.id !== entry.workspace.id)
    ]
  else if (existing)
    recents = state.recentWorkspaces.map((item) =>
      item.workspace.id === entry.workspace.id ? entry : item
    )
  else recents = [...state.recentWorkspaces, entry]
  recents = recents.slice(0, maxWorkspaces)
  const preferred = isActive ? entry.workspace.id : state.lastActiveWorkspaceId
  return {
    ...state,
    recentWorkspaces: recents,
    lastActiveWorkspaceId: recents.some((item) => item.workspace.id === preferred)
      ? preferred
      : (recents[0]?.workspace.id ?? null)
  }
}
