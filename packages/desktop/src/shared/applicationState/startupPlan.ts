import { createDefaultLayout } from './defaults'
import { getActiveSessionWindow } from './session'
import { RecoveryStatus } from '../types/applicationState'
import type {
  ApplicationState,
  DocumentSnapshot,
  ProjectViewState,
  RecoveryRecord,
  WindowLayoutState,
  WindowSnapshot,
  WorkspaceDescriptor,
  WorkspaceFileState
} from '../types/applicationState'
import { StartupAction, type RecoveryPreferences, type UserPreferences } from '../types/preferences'

export type ExplicitTarget =
  | { kind: 'file'; pathname: string; readOnly: boolean }
  | { kind: 'folder'; workspace: WorkspaceDescriptor }

/** Only preferences that affect the pure startup decision; no filesystem access occurs here. */
export type PlanningPreferences = RecoveryPreferences &
  Partial<Pick<UserPreferences, 'tocPosition' | 'sourceCodeModeEnabled' | 'openFilesInNewWindow'>>

/** Optional explicit targets override stored startup choices, even when resolution yields none. */
export interface StartupPlanInput {
  state: ApplicationState
  preferences: PlanningPreferences
  request?: { kind: 'explicit'; targets: ExplicitTarget[]; forceNewWindow?: boolean }
  configuredWorkspace?: WorkspaceDescriptor | null
  recoveryRecords?: ReadonlyMap<string, readonly RecoveryRecord[]>
}

/** Native IO instructions; each variant carries only the data needed to open that window. */
export type StartupWindowPlan =
  | { kind: 'explicit'; targets: ExplicitTarget[] }
  | { kind: 'empty'; layout: WindowLayoutState }
  | {
    kind: 'restore'
    snapshot: WindowSnapshot
    restoreGeometry: boolean
  }
  | {
    kind: 'workspace'
    workspace: WorkspaceDescriptor
    files: WorkspaceFileState[]
    activeFileKey: string | null
    projectView: ProjectViewState
    layout: WindowLayoutState
  }

const defaultLayout = (preferences: PlanningPreferences): WindowLayoutState =>
  createDefaultLayout({
    tocPosition: preferences.tocPosition ?? 'left',
    sourceCodeModeEnabled: preferences.sourceCodeModeEnabled ?? false
  })

const mergeRecovery = (
  window: WindowSnapshot,
  records: readonly RecoveryRecord[]
): WindowSnapshot => {
  const snapshot = structuredClone(window)
  const documents = new Map(snapshot.documents.map((document) => [document.id, document]))
  for (const record of records) {
    if (record.ownerWindowId !== window.id) continue
    const existing = documents.get(record.documentId)
    if (record.status === RecoveryStatus.SAVED && !existing) continue
    if (
      existing?.content.kind === 'recovery' &&
      existing.content.contentRevision > record.contentRevision
    )
      continue
    if (record.status === RecoveryStatus.DISCARDED) documents.delete(record.documentId)
    else {
      const recovered = structuredClone(record.document)
      if (
        record.status === RecoveryStatus.DIRTY &&
        existing?.content.kind === 'recovery' &&
        existing.content.contentRevision === record.contentRevision &&
        record.updatedAtMs <= window.updatedAtMs
      ) {
        recovered.view = structuredClone(existing.view)
        recovered.readOnly = existing.readOnly
      }
      documents.set(record.documentId, recovered)
    }
  }
  snapshot.documents = [...documents.values()]
  if (!documents.has(snapshot.activeDocumentId ?? ''))
    snapshot.activeDocumentId = snapshot.documents[0]?.id ?? null
  return snapshot
}

export const buildWorkspacePlan = (
  workspace: WorkspaceDescriptor,
  state: ApplicationState,
  preferences: PlanningPreferences
): Extract<StartupWindowPlan, { kind: 'workspace' }> => {
  const recent = state.recentWorkspaces.find((entry) => entry.workspace.id === workspace.id)
  const files = preferences.restoreEditors && recent ? structuredClone(recent.files) : []
  if (!preferences.restoreViewState) for (const file of files) file.view = null
  return {
    kind: 'workspace',
    workspace: structuredClone(workspace),
    files,
    activeFileKey: files.some((file) => file.location.key === recent?.activeFileKey)
      ? (recent?.activeFileKey ?? null)
      : (files[0]?.location.key ?? null),
    layout:
      preferences.restoreLayoutState && recent
        ? structuredClone(recent.layout)
        : defaultLayout(preferences),
    projectView:
      preferences.restoreLayoutState && recent
        ? structuredClone(recent.projectView)
        : { roots: [] }
  }
}

export const buildStartupPlan = (input: StartupPlanInput): StartupWindowPlan[] => {
  const { state, preferences } = input
  const empty = (): Extract<StartupWindowPlan, { kind: 'empty' }> => ({
    kind: 'empty',
    layout:
      preferences.restoreLayoutState && state.recentEmptyWindowLayout
        ? structuredClone(state.recentEmptyWindowLayout.layout)
        : defaultLayout(preferences)
  })
  if (input.request?.kind === 'explicit') {
    const targets = structuredClone(input.request.targets)
    if (!targets.length) return [empty()]
    if (preferences.openFilesInNewWindow && !input.request.forceNewWindow)
      return targets.map(target => ({ kind: 'explicit', targets: [target] }))
    return [{ kind: 'explicit', targets }]
  }
  if (preferences.startUpAction === StartupAction.BLANK) return [empty()]
  if (preferences.startUpAction === StartupAction.FOLDER) {
    return input.configuredWorkspace
      ? [buildWorkspacePlan(input.configuredWorkspace, state, preferences)]
      : [empty()]
  }
  if (preferences.startUpAction === StartupAction.OPEN_LAST_FOLDER) {
    const recent =
      state.recentWorkspaces.find((entry) => entry.workspace.id === state.lastActiveWorkspaceId) ??
      state.recentWorkspaces[0]
    return recent ? [buildWorkspacePlan(recent.workspace, state, preferences)] : [empty()]
  }
  let windows = state.session.windows.length
    ? state.session.windows
    : state.session.lastWindow
      ? [state.session.lastWindow]
      : []
  if (preferences.startUpAction === StartupAction.RESTORE_LAST_WINDOW) {
    const active = getActiveSessionWindow(windows, state.session.activeWindowId)
    windows = active ? [active] : []
  }
  const plans: StartupWindowPlan[] = []
  for (const window of windows) {
    const snapshot = mergeRecovery(window, input.recoveryRecords?.get(window.id) ?? [])
    if (!preferences.restoreEditors)
      snapshot.documents = snapshot.documents.filter(
        (document) => document.content.kind === 'recovery'
      )
    if (!snapshot.workspace && snapshot.documents.length === 0) continue
    if (!preferences.restoreViewState)
      for (const document of snapshot.documents) document.view = null
    if (!preferences.restoreLayoutState) {
      snapshot.layout = defaultLayout(preferences)
      snapshot.projectView = { roots: [] }
    }
    if (!snapshot.documents.some((document) => document.id === snapshot.activeDocumentId))
      snapshot.activeDocumentId = snapshot.documents[0]?.id ?? null
    plans.push({
      kind: 'restore',
      snapshot,
      restoreGeometry: preferences.restoreLayoutState
    })
  }
  return plans.length ? plans : [empty()]
}

export const unsavedDocuments = (snapshot: WindowSnapshot): DocumentSnapshot[] =>
  snapshot.documents.filter((document) => document.content.kind === 'recovery')
