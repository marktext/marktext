import { createDefaultLayout } from './defaults'
import type {
  ApplicationState,
  DocumentSnapshot,
  ProjectViewState,
  RecoveryPreferences,
  RecoveryRecord,
  WindowLayoutState,
  WindowSnapshot,
  WorkspaceDescriptor,
  WorkspaceFileState
} from '../types/applicationState'

export type ExplicitTarget =
  | { kind: 'file'; pathname: string; readOnly: boolean }
  | { kind: 'folder'; workspace: WorkspaceDescriptor }

export interface PlanningPreferences extends RecoveryPreferences {
  tocPosition?: 'left' | 'right'
  sourceCodeModeEnabled?: boolean
}

export interface StartupPlanInput {
  state: ApplicationState
  preferences: PlanningPreferences
  request?: { kind: 'explicit'; targets: ExplicitTarget[] }
  configuredWorkspace?: WorkspaceDescriptor | null
  recoveryRecords?: ReadonlyMap<string, readonly RecoveryRecord[]>
}

export type StartupWindowPlan =
  | { kind: 'explicit'; targets: ExplicitTarget[] }
  | { kind: 'empty'; layout: WindowLayoutState; restoreGeometry: false }
  | {
    kind: 'restore'
    snapshot: WindowSnapshot
    layout: WindowLayoutState
    restoreGeometry: boolean
  }
  | {
    kind: 'workspace'
    workspace: WorkspaceDescriptor
    files: WorkspaceFileState[]
    activeFileKey: string | null
    projectView: ProjectViewState
    layout: WindowLayoutState
    restoreGeometry: false
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
    if (
      existing?.content.kind === 'recovery' &&
      existing.content.contentRevision > record.contentRevision
    )
      continue
    if (record.status === 'discarded') documents.delete(record.documentId)
    else documents.set(record.documentId, structuredClone(record.document))
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
        : { roots: [] },
    restoreGeometry: false
  }
}

export const buildStartupPlan = (input: StartupPlanInput): StartupWindowPlan[] => {
  const { state, preferences } = input
  const empty = (): Extract<StartupWindowPlan, { kind: 'empty' }> => ({
    kind: 'empty',
    restoreGeometry: false,
    layout:
      preferences.restoreLayoutState && state.recentEmptyWindowLayout
        ? structuredClone(state.recentEmptyWindowLayout.layout)
        : defaultLayout(preferences)
  })
  if (input.request?.kind === 'explicit') {
    return input.request.targets.length
      ? [{ kind: 'explicit', targets: structuredClone(input.request.targets) }]
      : [empty()]
  }
  if (preferences.startUpAction === 'blank') return [empty()]
  if (preferences.startUpAction === 'folder') {
    return input.configuredWorkspace
      ? [buildWorkspacePlan(input.configuredWorkspace, state, preferences)]
      : [empty()]
  }
  if (preferences.startUpAction === 'openLastFolder') {
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
  if (preferences.startUpAction === 'restoreLastWindow') {
    const active =
      windows.find((window) => window.id === state.session.activeWindowId) ??
      windows.reduce<WindowSnapshot | null>(
        (latest, window) =>
          !latest || window.lastActivatedAtMs > latest.lastActivatedAtMs ? window : latest,
        null
      )
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
      layout: snapshot.layout,
      restoreGeometry: preferences.restoreLayoutState
    })
  }
  return plans.length ? plans : [empty()]
}

export const unsavedDocuments = (snapshot: WindowSnapshot): DocumentSnapshot[] =>
  snapshot.documents.filter((document) => document.content.kind === 'recovery')
