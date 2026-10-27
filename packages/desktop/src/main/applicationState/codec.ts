import path from 'node:path'
import { createDefaultLayout } from '@shared/applicationState/defaults'
import type {
  ApplicationState,
  DiskBaseline,
  DocumentSnapshot,
  FileLocation,
  RecoveryRecord,
  WindowLayoutState,
  WindowSnapshot,
  WorkspaceDescriptor,
  WorkspaceRecentState,
  SourceSelection,
  SaveFormatState
} from '@shared/types/applicationState'
import { contentSha256 } from './identity'

type ObjectValue = Record<string, unknown>
const object = (value: unknown): value is ObjectValue =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
const finite = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)
const nonnegative = (value: unknown): value is number => finite(value) && value >= 0
export const validIdentity = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value)
const hash = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)

export class UnsupportedStateVersion extends Error {}

const version = (value: unknown): ObjectValue => {
  if (!object(value)) throw new Error('Invalid state object')
  if (value.schemaVersion !== 1) throw new UnsupportedStateVersion('Unsupported state version')
  return value
}

const location = (value: unknown): FileLocation | null => {
  if (
    !object(value) ||
    typeof value.path !== 'string' ||
    !path.isAbsolute(value.path) ||
    typeof value.canonicalPath !== 'string' ||
    !path.isAbsolute(value.canonicalPath) ||
    !hash(value.key) ||
    contentSha256(value.canonicalPath) !== value.key
  )
    return null
  return { path: value.path, canonicalPath: value.canonicalPath, key: value.key }
}

const workspace = (value: unknown): WorkspaceDescriptor | null => {
  if (!object(value) || !hash(value.id) || !Array.isArray(value.roots)) return null
  const roots: WorkspaceDescriptor['roots'] = []
  const seen = new Set<string>()
  for (const entry of value.roots) {
    if (!object(entry)) return null
    const resource = location(entry.location)
    if (!resource || entry.id !== resource.key || seen.has(entry.id)) return null
    seen.add(entry.id)
    roots.push({ id: entry.id, location: resource })
  }
  const expected = contentSha256(JSON.stringify(roots.map((root) => root.id).sort()))
  return roots.length > 0 && value.id === expected ? { id: value.id, roots } : null
}

const layout = (value: unknown): WindowLayoutState => {
  const result = createDefaultLayout()
  if (!object(value)) return result
  if (object(value.sidebar)) {
    const sidebar = value.sidebar
    if (typeof sidebar.visible === 'boolean') result.sidebar.visible = sidebar.visible
    if (sidebar.activeView === 'files' || sidebar.activeView === 'search')
      result.sidebar.activeView = sidebar.activeView
    if (finite(sidebar.preferredWidthPx))
      result.sidebar.preferredWidthPx = Math.max(220, sidebar.preferredWidthPx)
    if (object(sidebar.openedFiles)) {
      if (typeof sidebar.openedFiles.expanded === 'boolean')
        result.sidebar.openedFiles.expanded = sidebar.openedFiles.expanded
      if (nonnegative(sidebar.openedFiles.preferredHeightPx))
        result.sidebar.openedFiles.preferredHeightPx = sidebar.openedFiles.preferredHeightPx
    }
  }
  if (object(value.outline)) {
    if (typeof value.outline.visible === 'boolean') result.outline.visible = value.outline.visible
    if (value.outline.position === 'left' || value.outline.position === 'right')
      result.outline.position = value.outline.position
    if (finite(value.outline.preferredWidthPx))
      result.outline.preferredWidthPx = Math.max(180, Math.min(600, value.outline.preferredWidthPx))
  }
  if (object(value.tabBar) && typeof value.tabBar.visible === 'boolean')
    result.tabBar.visible = value.tabBar.visible
  if (object(value.modes)) {
    for (const key of ['sourceCode', 'focus', 'typewriter'] as const) {
      if (typeof value.modes[key] === 'boolean') result.modes[key] = value.modes[key]
    }
  }
  return result
}

const baseline = (value: unknown): DiskBaseline | null => {
  if (!object(value)) return null
  if (value.exists === false) return { exists: false }
  if (
    value.exists === true &&
    nonnegative(value.sizeBytes) &&
    nonnegative(value.mtimeMs) &&
    hash(value.rawSha256)
  ) {
    return {
      exists: true,
      sizeBytes: value.sizeBytes,
      mtimeMs: value.mtimeMs,
      rawSha256: value.rawSha256
    }
  }
  return null
}

const strings = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

const relativePaths = (value: unknown): string[] =>
  strings(value).filter((entry) => !path.isAbsolute(entry) && !entry.split(/[\\/]/).includes('..'))

const projectView = (value: unknown): WindowSnapshot['projectView'] => ({
  roots:
    object(value) && Array.isArray(value.roots)
      ? value.roots.flatMap((entry) =>
        object(entry) && hash(entry.rootId)
          ? [{ rootId: entry.rootId, collapsedPaths: relativePaths(entry.collapsedPaths) }]
          : []
      )
      : []
})

const sourcePosition = (value: unknown): boolean =>
  object(value) &&
  Number.isInteger(value.line) &&
  nonnegative(value.line) &&
  Number.isInteger(value.ch) &&
  nonnegative(value.ch)
const blockPath = (value: unknown): boolean =>
  Array.isArray(value) &&
  value.every(
    (entry) =>
      (Number.isInteger(entry) && nonnegative(entry)) ||
      (typeof entry === 'string' && !['__proto__', 'constructor', 'prototype'].includes(entry))
  )
const endpoint = (value: unknown): boolean =>
  object(value) && blockPath(value.path) && nonnegative(value.offset)
const tablePosition = (value: unknown): boolean =>
  object(value) &&
  Number.isInteger(value.row) &&
  nonnegative(value.row) &&
  Number.isInteger(value.column) &&
  nonnegative(value.column)

const view = (value: unknown): DocumentSnapshot['view'] => {
  if (
    !object(value) ||
    !hash(value.contentSha256) ||
    !nonnegative(value.sourceScrollTopPx) ||
    !nonnegative(value.renderedScrollTopPx)
  )
    return null
  const source = value.sourceSelection
  if (
    source !== null &&
    (!object(source) || !sourcePosition(source.anchor) || !sourcePosition(source.focus))
  )
    return null
  const muya = value.muyaSelection
  if (muya !== null) {
    if (!object(muya)) return null
    if (muya.kind === 'text') {
      if (!endpoint(muya.anchor) || !endpoint(muya.focus)) return null
    } else if (muya.kind === 'image') {
      if (
        !blockPath(muya.path) ||
        !object(muya.range) ||
        !nonnegative(muya.range.start) ||
        !nonnegative(muya.range.end) ||
        muya.range.end < muya.range.start ||
        typeof muya.raw !== 'string'
      )
        return null
    } else if (muya.kind === 'table') {
      if (!blockPath(muya.tablePath) || !tablePosition(muya.anchor) || !tablePosition(muya.focus))
        return null
    } else return null
  }
  return {
    contentSha256: value.contentSha256,
    sourceSelection: source as SourceSelection | null,
    muyaSelection: muya as NonNullable<DocumentSnapshot['view']>['muyaSelection'],
    sourceScrollTopPx: value.sourceScrollTopPx,
    renderedScrollTopPx: value.renderedScrollTopPx,
    collapsedOutlineKeys: strings(value.collapsedOutlineKeys)
  }
}

const saveFormat = (value: unknown): SaveFormatState | null => {
  if (!object(value) || !object(value.encoding)) return null
  if (
    typeof value.encoding.encoding !== 'string' ||
    typeof value.encoding.isBom !== 'boolean' ||
    (value.lineEnding !== 'lf' && value.lineEnding !== 'crlf') ||
    typeof value.adjustLineEndingOnSave !== 'boolean' ||
    typeof value.trimTrailingNewline !== 'number' ||
    ![0, 1, 2, 3].includes(value.trimTrailingNewline)
  )
    return null
  return {
    encoding: { encoding: value.encoding.encoding, isBom: value.encoding.isBom },
    lineEnding: value.lineEnding,
    adjustLineEndingOnSave: value.adjustLineEndingOnSave,
    trimTrailingNewline: value.trimTrailingNewline as 0 | 1 | 2 | 3
  }
}

export const parseDocument = (value: unknown): DocumentSnapshot | null => {
  if (
    !object(value) ||
    !validIdentity(value.id) ||
    typeof value.title !== 'string' ||
    typeof value.readOnly !== 'boolean' ||
    !object(value.resource) ||
    !object(value.content)
  )
    return null
  const format = saveFormat(value.saveFormat)
  if (!format) return null
  let resource: DocumentSnapshot['resource']
  if (value.resource.kind === 'untitled') resource = { kind: 'untitled' }
  else if (value.resource.kind === 'file' && typeof value.resource.pendingCreation === 'boolean') {
    const target = location(value.resource.location)
    if (!target) return null
    resource = { kind: 'file', location: target, pendingCreation: value.resource.pendingCreation }
  } else return null
  let content: DocumentSnapshot['content']
  if (value.content.kind === 'empty') content = { kind: 'empty' }
  else if (
    value.content.kind === 'recovery' &&
    Number.isInteger(value.content.contentRevision) &&
    nonnegative(value.content.contentRevision)
  ) {
    content = { kind: 'recovery', contentRevision: value.content.contentRevision }
  } else if (value.content.kind === 'disk') {
    const base = baseline(value.content.baseline)
    if (!base?.exists || resource.kind !== 'file' || resource.pendingCreation) return null
    content = { kind: 'disk', baseline: base }
  } else return null
  return {
    id: value.id,
    title: value.title,
    resource,
    content,
    readOnly: value.readOnly,
    saveFormat: format,
    view: view(value.view)
  }
}

export const parseWindowSnapshot = (value: unknown): WindowSnapshot | null => {
  if (
    !object(value) ||
    !validIdentity(value.id) ||
    !nonnegative(value.updatedAtMs) ||
    !nonnegative(value.lastActivatedAtMs) ||
    !Array.isArray(value.documents) ||
    !object(value.geometry) ||
    !object(value.geometry.normalBounds)
  )
    return null
  const bounds = value.geometry.normalBounds
  if (![bounds.x, bounds.y, bounds.width, bounds.height].every(finite)) return null
  const documents = value.documents
    .map(parseDocument)
    .filter((entry): entry is DocumentSnapshot => entry !== null)
  const seen = new Set<string>()
  const unique: DocumentSnapshot[] = []
  for (const document of documents) {
    if (!seen.has(document.id)) {
      seen.add(document.id)
      unique.push(document)
    }
  }
  return {
    id: value.id,
    updatedAtMs: value.updatedAtMs,
    lastActivatedAtMs: value.lastActivatedAtMs,
    workspace: workspace(value.workspace),
    layout: layout(value.layout),
    projectView: projectView(value.projectView),
    geometry: {
      normalBounds: {
        x: bounds.x as number,
        y: bounds.y as number,
        width: Math.max(550, bounds.width as number),
        height: Math.max(350, bounds.height as number)
      },
      maximized: value.geometry.maximized === true,
      displayId: typeof value.geometry.displayId === 'string' ? value.geometry.displayId : null
    },
    documents: unique,
    activeDocumentId: unique.some((document) => document.id === value.activeDocumentId)
      ? (value.activeDocumentId as string)
      : (unique[0]?.id ?? null)
  }
}

export const parseApplicationState = (input: unknown): ApplicationState => {
  const value = version(input)
  if (
    !object(value.session) ||
    !validIdentity(value.session.id) ||
    !Array.isArray(value.session.windows) ||
    !Number.isInteger(value.revision) ||
    !nonnegative(value.revision) ||
    !nonnegative(value.updatedAtMs)
  ) {
    throw new Error('Invalid application state')
  }
  const session = value.session
  const windowValues = value.session.windows
  const seen = new Set<string>()
  const windows: WindowSnapshot[] = []
  for (const item of windowValues) {
    const entry = parseWindowSnapshot(item)
    if (entry && !seen.has(entry.id)) {
      seen.add(entry.id)
      windows.push(entry)
    }
  }
  const recentWorkspaces: WorkspaceRecentState[] = []
  if (Array.isArray(value.recentWorkspaces)) {
    for (const entry of value.recentWorkspaces) {
      if (
        !object(entry) ||
        !nonnegative(entry.updatedAtMs) ||
        !validIdentity(entry.sourceWindowId) ||
        !Array.isArray(entry.files)
      )
        continue
      const context = workspace(entry.workspace)
      if (!context || recentWorkspaces.some((item) => item.workspace.id === context.id)) continue
      const files: WorkspaceRecentState['files'] = []
      for (const file of entry.files) {
        if (!object(file)) continue
        const target = location(file.location)
        const format = saveFormat(file.saveFormat)
        if (
          target &&
          format &&
          typeof file.readOnly === 'boolean' &&
          !files.some((item) => item.location.key === target.key)
        ) {
          files.push({
            location: target,
            readOnly: file.readOnly,
            saveFormat: format,
            view: view(file.view)
          })
        }
      }
      recentWorkspaces.push({
        workspace: context,
        updatedAtMs: entry.updatedAtMs,
        sourceWindowId: entry.sourceWindowId,
        layout: layout(entry.layout),
        projectView: projectView(entry.projectView),
        files,
        activeFileKey: files.some((file) => file.location.key === entry.activeFileKey)
          ? (entry.activeFileKey as string)
          : (files[0]?.location.key ?? null)
      })
    }
  }
  const empty = value.recentEmptyWindowLayout
  return {
    schemaVersion: 1,
    revision: value.revision,
    updatedAtMs: value.updatedAtMs,
    session: {
      id: session.id as string,
      lifecycle: session.lifecycle === 'closed' ? 'closed' : 'running',
      windows,
      activeWindowId: windows.some((window) => window.id === session.activeWindowId)
        ? (session.activeWindowId as string)
        : (windows[0]?.id ?? null),
      lastWindow: windows.length === 0 ? parseWindowSnapshot(session.lastWindow) : null
    },
    recentWorkspaces,
    lastActiveWorkspaceId: recentWorkspaces.some(
      (entry) => entry.workspace.id === value.lastActiveWorkspaceId
    )
      ? (value.lastActiveWorkspaceId as string)
      : (recentWorkspaces[0]?.workspace.id ?? null),
    recentEmptyWindowLayout:
      object(empty) && nonnegative(empty.updatedAtMs)
        ? { updatedAtMs: empty.updatedAtMs, layout: layout(empty.layout) }
        : null
  }
}

export const parseRecoveryRecord = (input: unknown): RecoveryRecord => {
  const value = version(input)
  if (
    !validIdentity(value.ownerWindowId) ||
    !validIdentity(value.documentId) ||
    !Number.isInteger(value.contentRevision) ||
    !nonnegative(value.contentRevision) ||
    !nonnegative(value.updatedAtMs)
  )
    throw new Error('Invalid recovery identity')
  const common = {
    schemaVersion: 1 as const,
    ownerWindowId: value.ownerWindowId,
    documentId: value.documentId,
    contentRevision: value.contentRevision,
    updatedAtMs: value.updatedAtMs
  }
  if (value.status === 'discarded') return { ...common, status: 'discarded' }
  const document = parseDocument(value.document)
  if (!document || document.id !== value.documentId) throw new Error('Invalid recovery document')
  if (value.status === 'saved' && document.content.kind === 'disk')
    return { ...common, status: 'saved', document }
  if (
    value.status !== 'dirty' ||
    typeof value.markdown !== 'string' ||
    !hash(value.contentSha256) ||
    contentSha256(value.markdown) !== value.contentSha256 ||
    document.content.kind !== 'recovery' ||
    document.content.contentRevision !== value.contentRevision
  )
    throw new Error('Invalid recovery content')
  const base = value.baseline === null ? null : baseline(value.baseline)
  if (value.baseline !== null && !base) throw new Error('Invalid recovery baseline')
  return {
    ...common,
    status: 'dirty',
    document,
    markdown: value.markdown,
    contentSha256: value.contentSha256,
    baseline: base
  }
}
