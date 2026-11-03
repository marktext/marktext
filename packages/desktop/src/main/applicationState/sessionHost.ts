import { app, BrowserWindow, dialog, ipcMain, screen, type WebContents } from 'electron'
import { readFile, stat, rename, readdir } from 'node:fs/promises'
import path from 'node:path'
import log from 'electron-log'
import debounce from 'lodash/debounce'
import type Preference from '../preferences'
import type AppMenu from '../menu'
import type EditorWindow from '../windows/editor'
import type WindowManager from '../app/windowManager'
import type { FileOpenOptions } from '../windows/editor'
import { loadMarkdownFile, loadCliMarkdownFile, writeMarkdownFile } from '../filesystem/markdown'
import { t } from '../i18n'
import { documentWrites } from '../filesystem/documentWrites'
import { createDefaultLayout } from '@shared/applicationState/defaults'
import { RecoveryStatus, SessionLifecycle } from '@shared/types/applicationState'
import { StartupAction } from '@shared/types/preferences'
import { activateSessionWindow } from '@shared/applicationState/session'
import {
  buildWorkspacePlan,
  buildStartupPlan,
  type StartupWindowPlan,
  type ExplicitTarget
} from '@shared/applicationState/startupPlan'
import type {
  ApplicationState,
  DocumentSnapshot,
  RecoveryRecord,
  WindowSnapshot,
  WindowInitialization,
  RuntimeWindowContext,
  WindowCheckpointRequest,
  PersistResult,
  ManagedSaveResult,
  ManagedDocumentPayload,
  RegisteredDocumentContent,
  PreparedSessionWindow
} from '@shared/types/applicationState'
import type { DiskBaseline, SaveFormatState } from '@shared/types/files'
import { ApplicationStateStore, RecoveryStore } from './storage'
import { CheckpointService } from './checkpointService'
import { CloseCoordinator } from './closeCoordinator'
import { createStateId, createFileLocation, createWorkspaceDescriptor } from './identity'
import { contentSha256 } from 'common/filesystem'
import { applyWindowGeometry, captureWindowGeometry } from './windowGeometry'
import type { SidebarMoveRequest, SidebarMoveResult } from '@shared/types/project'
import { confirmAndMoveSidebarItem } from '../filesystem/sidebarMove'
import { containsPath } from 'common/filesystem/paths'
import { relocateResourcePath, type ResourceMove } from 'common/filesystem/resourceMove'

export interface StartupPath extends FileOpenOptions {
  path: string
  isDir: boolean
}
/** One native request awaiting a renderer checkpoint with the same transaction identity. */
interface PendingCheckpoint {
  transactionId: string
  resolve(snapshot: WindowSnapshot): void
  reject(error: Error): void
  timeout: ReturnType<typeof setTimeout>
}
const displays = () =>
  screen.getAllDisplays().map((display) => ({ id: String(display.id), workArea: display.workArea }))
const primary = () => String(screen.getPrimaryDisplay().id)

/** Owns native editor lifetimes and checkpoints within the current application session. */
export class SessionHost {
  private readonly _metadata: ApplicationStateStore
  private readonly _recovery: RecoveryStore
  private readonly _loaded: Promise<ApplicationState>
  private _service: CheckpointService | null = null
  private readonly _editors = new Map<string, EditorWindow>()
  private readonly _contexts = new Map<string, RuntimeWindowContext>()
  private readonly _statuses = new Map<string, PreparedSessionWindow['statuses']>()
  private readonly _waiting = new Map<string, PendingCheckpoint>()
  // A renderer becomes ready only after applying initialization; reloads and crashes clear it.
  private readonly _readyRenderers = new Set<string>()
  private readonly _geometryWriters = new Map<string, ReturnType<typeof debounce<() => void>>>()
  private readonly _coordinator: CloseCoordinator
  private _quitAllowed = false
  private _quitting = false
  private _startupWarning: string | undefined
  private _startupActiveId: string | null = null
  private readonly _startupWindowIds = new Set<string>()
  private _tabClosePending = false
  private _startQueue: Promise<void> = Promise.resolve()
  private readonly _windowOperations = new Map<string, Promise<unknown>>()
  private readonly _checkpointQueues = new Map<string, Promise<WindowSnapshot>>()
  private readonly _previewRequests = new Map<string, number>()
  private readonly _previews = new Map<string, string>()
  private readonly _untitledNumbers = new Map<string, number>()

  constructor(private readonly _accessor: {
    preferences: Preference
    menu: Pick<AppMenu, 'removeWindowMenu' | 'addRecentlyUsedDocument' | 'relocateRecentlyUsedDocuments'>
    windowManager: Pick<WindowManager, 'withIgnoredFileDeletions'>
  }) {
    this._metadata = new ApplicationStateStore(app.getPath('userData'))
    this._recovery = new RecoveryStore(app.getPath('userData'))
    this._loaded = this._metadata.load().then((result) => result.value)
    this._coordinator = new CloseCoordinator({
      getSession: () => this._owner().getState().session,
      checkpoint: (id, transactionId) => this._requestCheckpoint(id, transactionId),
      choose: (snapshot) => this._choose(snapshot),
      save: async(snapshot) => {
        for (const document of snapshot.documents.filter(
          (document) => document.content.kind === 'recovery'
        )) {
          const result = await this.saveDocument(snapshot.id, document.id, false, true)
          if (result.status !== 'saved') return result.status === 'canceled' ? 'canceled' : 'failed'
        }
        return 'saved'
      },
      commit: (snapshots, windowId) => this._owner().closeWindows(snapshots, windowId),
      destroy: async(id) => {
        const editor = this._editors.get(id)
        if (!editor) return
        if (editor.id !== null) this._accessor.menu.removeWindowMenu(editor.id)
        editor.destroy()
        this._editors.delete(id)
        this._contexts.delete(id)
        this._readyRenderers.delete(id)
        this._statuses.delete(id)
        this._geometryWriters.get(id)?.cancel()
        this._geometryWriters.delete(id)
        this._windowOperations.delete(id)
        this._checkpointQueues.delete(id)
        this._previews.delete(id)
        this._previewRequests.delete(id)
        this._untitledNumbers.delete(id)
      }
    })
    this._registerIpc()
    app.on('before-quit', (event) => {
      if (this._quitAllowed || !this._service) return
      event.preventDefault()
      if (this._quitting) return
      this._quitting = true
      void this._coordinator
        .quit()
        .then(() => {
          if (this._owner().getState().session.lifecycle === SessionLifecycle.CLOSED && this._editors.size === 0) {
            this._quitAllowed = true
            app.quit()
          }
        })
        .catch((error) => this.report(error))
        .finally(() => {
          this._quitting = false
        })
    })
  }

  private _owner(): CheckpointService {
    if (!this._service) throw new Error('Session is not initialized')
    return this._service
  }

  private _defaultFormat(): SaveFormatState {
    const preferences = this._accessor.preferences.getAll()
    const lineEnding = this._accessor.preferences.getPreferredEol()
    return {
      encoding: { encoding: preferences.defaultEncoding, isBom: false },
      lineEnding,
      adjustLineEndingOnSave: lineEnding === 'crlf',
      trimTrailingNewline: preferences.trimTrailingNewline
    }
  }

  private _blankDocument(markdown = '', title = 'Untitled-1'): DocumentSnapshot {
    return {
      id: createStateId(),
      title,
      resource: { kind: 'untitled' },
      content: markdown ? { kind: 'recovery', contentRevision: 1 } : { kind: 'empty' },
      readOnly: false,
      saveFormat: this._defaultFormat(),
      view: null
    }
  }

  private _blankWindow(): WindowSnapshot {
    const now = Date.now()
    return {
      id: createStateId(),
      updatedAtMs: now,
      lastActivatedAtMs: now,
      workspace: null,
      geometry: {
        normalBounds: { x: 0, y: 0, width: 1200, height: 800 },
        maximized: false,
        displayId: null
      },
      layout: createDefaultLayout(this._accessor.preferences.getAll()),
      projectView: { roots: [] },
      documents: [],
      activeDocumentId: null
    }
  }

  private async _readDocument(
    pathname: string,
    options: FileOpenOptions = {},
    id = createStateId()
  ): Promise<{ document: DocumentSnapshot; content: RegisteredDocumentContent }> {
    const preferences = this._accessor.preferences.getAll()
    const raw =
      options.allowMissing && !options.readOnly
        ? await loadCliMarkdownFile(
          pathname,
          preferences.defaultEncoding,
          this._accessor.preferences.getPreferredEol(),
          preferences.autoGuessEncoding,
          preferences.trimTrailingNewline,
          preferences.autoNormalizeLineEndings
        )
        : await loadMarkdownFile(
          pathname,
          this._accessor.preferences.getPreferredEol(),
          preferences.autoGuessEncoding,
          preferences.trimTrailingNewline,
          preferences.autoNormalizeLineEndings
        )
    const document: DocumentSnapshot = {
      id,
      title: raw.filename,
      resource: {
        kind: 'file',
        location: createFileLocation(raw.pathname),
        pendingCreation: !!raw.isPendingCreation
      },
      content: raw.isPendingCreation
        ? { kind: 'empty' }
        : { kind: 'disk', baseline: raw.rawBaseline },
      readOnly:
        options.readOnly ?? (!raw.isPendingCreation && preferences.defaultOpenMode === 'read'),
      saveFormat: {
        encoding: { encoding: raw.encoding.encoding, isBom: !!raw.encoding.isBom },
        lineEnding: raw.lineEnding,
        adjustLineEndingOnSave: raw.adjustLineEndingOnSave,
        trimTrailingNewline: raw.trimTrailingNewline as SaveFormatState['trimTrailingNewline']
      },
      view: null
    }
    return { document, content: { documentId: id, markdown: raw.markdown } }
  }

  start(paths: StartupPath[], create: (prepared: PreparedSessionWindow) => void, forceNewWindow = false): Promise<void> {
    const result = this._startQueue.then(() => this._startNow(paths, create, forceNewWindow))
    this._startQueue = result.catch(() => {})
    return result
  }

  private async _startNow(
    paths: StartupPath[],
    create: (prepared: PreparedSessionWindow) => void,
    forceNewWindow: boolean
  ): Promise<void> {
    if (this._service) {
      create(await this.prepareNewWindow(null, [], []))
      return
    }
    const previous = await this._loaded
    const preferences = this._accessor.preferences.getAll()
    let configuredWorkspace: WindowSnapshot['workspace'] = null
    try {
      if (
        preferences.startUpAction === StartupAction.FOLDER &&
        preferences.defaultDirectoryToOpen &&
        (await stat(preferences.defaultDirectoryToOpen)).isDirectory()
      ) {
        await readdir(preferences.defaultDirectoryToOpen)
        configuredWorkspace = createWorkspaceDescriptor([preferences.defaultDirectoryToOpen])
      }
    } catch (error) {
      log.warn(error)
    }
    if (!paths.length && preferences.startUpAction === StartupAction.FOLDER && !configuredWorkspace)
      this._startupWarning = `${t('sideBar.tree.unavailableFolder')}: ${preferences.defaultDirectoryToOpen}`
    const targets: ExplicitTarget[] = paths.flatMap((item): ExplicitTarget[] => {
      if (!item.isDir) return [{ kind: 'file', pathname: item.path, readOnly: !!item.readOnly }]
      const workspace = createWorkspaceDescriptor([item.path])
      return workspace ? [{ kind: 'folder', workspace }] : []
    })
    const input = {
      state: previous,
      preferences,
      configuredWorkspace,
      request: targets.length ? { kind: 'explicit' as const, targets, forceNewWindow } : undefined
    }
    const records = new Map<string, RecoveryRecord[]>()
    const selected = buildStartupPlan(input)
    for (const plan of selected) {
      if (plan.kind === 'restore') {
        try {
          records.set(plan.snapshot.id, await this._recovery.readWindow(plan.snapshot.id))
        } catch (error) {
          log.warn('Recovery directory unavailable', error)
          records.set(plan.snapshot.id, [])
        }
      }
    }
    const plans = buildStartupPlan({ ...input, recoveryRecords: records })
    const prepared: PreparedSessionWindow[] = []
    for (const plan of plans) {
      const window = await this._preparePlan(plan, paths, plan.kind === 'restore' ? records.get(plan.snapshot.id) : undefined)
      if (window.openable) prepared.push(window)
    }
    if (!prepared.length) prepared.push(await this.prepareNewWindow(null, [], []))
    const runtime: ApplicationState = {
      ...previous,
      session: {
        id: createStateId(),
        lifecycle: SessionLifecycle.RUNNING,
        windows: [],
        activeWindowId: null,
        lastWindow: null
      }
    }
    this._service = new CheckpointService(runtime, this._metadata, this._recovery, Date.now, (error) =>
      log.warn('Recovery cleanup will be retried', error)
    )
    for (const window of prepared) await this._attachPrepared(window)
    for (const window of prepared) this._startupWindowIds.add(window.snapshot.id)
    this._startupActiveId = prepared.some(
      (window) => window.snapshot.id === previous.session.activeWindowId
    )
      ? previous.session.activeWindowId
      : null
    for (const window of prepared) create(window)
  }

  isRendererInitialized(windowId: string): boolean {
    return this._readyRenderers.has(windowId)
  }

  private async _preparePlan(
    plan: StartupWindowPlan,
    paths: StartupPath[],
    records: readonly RecoveryRecord[] = []
  ): Promise<PreparedSessionWindow> {
    if (plan.kind === 'explicit') {
      const folders = plan.targets.flatMap((target) =>
        target.kind === 'folder' ? target.workspace.roots.map((root) => root.location.path) : []
      )
      const files = plan.targets.flatMap((target) =>
        target.kind === 'file' ? [target.pathname] : []
      )
      const options = Object.fromEntries(paths.map((item) => [item.path, item]))
      const workspace = createWorkspaceDescriptor(folders)
      const prepared = workspace
        ? await this._prepareExplicitWorkspace(workspace, files, options)
        : await this.prepareNewWindow(null, files, [], options)
      prepared.rememberPaths = [...folders, ...files]
      return prepared
    }
    if (plan.kind === 'empty') {
      const prepared = await this.prepareNewWindow(null, [], [])
      prepared.snapshot.layout = plan.layout
      return prepared
    }
    if (plan.kind === 'workspace') {
      const prepared = await this.prepareNewWindow(
        null,
        plan.files.map((file) => file.location.path),
        [],
        Object.fromEntries(
          plan.files.map((file) => [file.location.path, { readOnly: file.readOnly }])
        )
      )
      prepared.rememberPaths = []
      prepared.snapshot.workspace = plan.workspace
      prepared.snapshot.layout = plan.layout
      prepared.snapshot.projectView = plan.projectView
      for (const document of prepared.snapshot.documents) {
        const file = plan.files.find(
          (file) =>
            document.resource.kind === 'file' &&
            file.location.key === document.resource.location.key
        )
        if (file) document.view = file.view
        if (
          document.resource.kind === 'file' &&
          document.resource.location.key === plan.activeFileKey
        )
          prepared.snapshot.activeDocumentId = document.id
      }
      return prepared
    }
    const snapshot = structuredClone(plan.snapshot)
    const contents: RegisteredDocumentContent[] = []
    const documents: DocumentSnapshot[] = []
    const statuses: PreparedSessionWindow['statuses'] = []
    for (const document of snapshot.documents) {
      if (document.content.kind === 'recovery') {
        const revision = document.content.contentRevision
        const record = records.find(
          (record) =>
            record.status === RecoveryStatus.DIRTY &&
              record.documentId === document.id &&
              record.contentRevision === revision
        )
        if (!record || record.status !== RecoveryStatus.DIRTY) {
          log.warn('Recovery content unavailable', document.id)
          continue
        }
        const content: RegisteredDocumentContent = {
          documentId: document.id,
          markdown: record.markdown,
          baseline: record.baseline
        }
        let diskMissing = false
        let diskConflict = false
        if (document.resource.kind === 'file') {
          try {
            const disk = await this._readDocument(
              document.resource.location.path,
              { readOnly: document.readOnly },
              document.id
            )
            const baseline =
              disk.document.content.kind === 'disk' ? disk.document.content.baseline : null
            diskConflict = record.baseline?.exists
              ? !baseline?.exists || record.baseline.rawSha256 !== baseline.rawSha256
              : !!baseline?.exists
            if (!document.resource.pendingCreation)
              content.saved = { snapshot: disk.document, markdown: disk.content.markdown }
          } catch {
            diskMissing = true
          }
        }
        documents.push(document)
        contents.push(content)
        statuses.push({ documentId: document.id, diskMissing, diskConflict })
      } else if (document.content.kind === 'empty') {
        documents.push(document)
        contents.push({ documentId: document.id, markdown: '' })
      } else if (document.resource.kind === 'file') {
        try {
          const loaded = await this._readDocument(
            document.resource.location.path,
            { readOnly: document.readOnly },
            document.id
          )
          loaded.document.view = document.view
          documents.push(loaded.document)
          contents.push(loaded.content)
        } catch (error) {
          log.warn('Ordinary file unavailable during restoration', error)
        }
      }
    }
    const openable = documents.length > 0 || snapshot.workspace !== null
    if (documents.length === 0) {
      const document = this._blankDocument()
      documents.push(document)
      contents.push({ documentId: document.id, markdown: '' })
    }
    snapshot.documents = documents
    if (!documents.some((document) => document.id === snapshot.activeDocumentId))
      snapshot.activeDocumentId = documents[0].id
    return { snapshot, contents, restoreGeometry: plan.restoreGeometry, statuses, openable }
  }

  async prepareNewWindow(
    root: string | null,
    files: string[],
    markdown: string[],
    options: Record<string, FileOpenOptions> = {}
  ): Promise<PreparedSessionWindow> {
    if (root) {
      const workspace = createWorkspaceDescriptor([root])
      if (workspace) return this._prepareExplicitWorkspace(workspace, files, options)
    }
    const snapshot = this._blankWindow()
    const contents: RegisteredDocumentContent[] = []
    for (const pathname of files) {
      try {
        const loaded = await this._readDocument(pathname, options[pathname])
        if (
          snapshot.documents.some(
            (document) =>
              document.resource.kind === 'file' &&
              loaded.document.resource.kind === 'file' &&
              document.resource.location.key === loaded.document.resource.location.key
          )
        )
          continue
        snapshot.documents.push(loaded.document)
        contents.push(loaded.content)
      } catch (error) {
        log.warn(error)
      }
    }
    for (const text of markdown) {
      const document = this._blankDocument(text, `Untitled-${snapshot.documents.length + 1}`)
      snapshot.documents.push(document)
      contents.push({ documentId: document.id, markdown: text })
    }
    if (snapshot.documents.length === 0) {
      const document = this._blankDocument()
      snapshot.documents.push(document)
      contents.push({ documentId: document.id, markdown: '' })
    }
    snapshot.activeDocumentId = snapshot.documents[0].id
    return {
      snapshot,
      contents,
      restoreGeometry: false,
      statuses: [],
      openable: true,
      rememberPaths: files
    }
  }

  private async _prepareExplicitWorkspace(
    workspace: NonNullable<WindowSnapshot['workspace']>,
    files: string[],
    options: Record<string, FileOpenOptions>
  ): Promise<PreparedSessionWindow> {
    const plan = buildWorkspacePlan(
      workspace,
      this._service?.getState() ?? (await this._loaded),
      this._accessor.preferences.getAll()
    )
    const prepared = await this._preparePlan(plan, [])
    const readOnlyOverrides = new Map<string, boolean>()
    for (const [pathname, optionsForFile] of Object.entries(options)) {
      if (optionsForFile.readOnly !== undefined)
        readOnlyOverrides.set(createFileLocation(pathname).key, optionsForFile.readOnly)
    }
    for (const document of prepared.snapshot.documents) {
      if (document.resource.kind !== 'file') continue
      const readOnly = readOnlyOverrides.get(document.resource.location.key)
      if (readOnly !== undefined) document.readOnly = readOnly
    }
    for (const pathname of files) {
      try {
        const loaded = await this._readDocument(pathname, options[pathname])
        const existing = prepared.snapshot.documents.find(
          (document) =>
            document.resource.kind === 'file' &&
            loaded.document.resource.kind === 'file' &&
            document.resource.location.key === loaded.document.resource.location.key
        )
        if (existing) {
          prepared.snapshot.activeDocumentId = existing.id
          continue
        }
        prepared.snapshot.documents = prepared.snapshot.documents.filter(
          (document) => document.content.kind !== 'empty' || document.resource.kind !== 'untitled'
        )
        prepared.contents = prepared.contents.filter((content) =>
          prepared.snapshot.documents.some((document) => document.id === content.documentId)
        )
        prepared.snapshot.documents.push(loaded.document)
        prepared.contents.push(loaded.content)
        prepared.snapshot.activeDocumentId = loaded.document.id
      } catch (error) {
        log.warn(error)
      }
    }
    prepared.rememberPaths = [...workspace.roots.map((root) => root.location.path), ...files]
    return prepared
  }

  private async _attachPrepared(prepared: PreparedSessionWindow): Promise<void> {
    const id = prepared.snapshot.id
    const context = await this._owner().attachWindow(prepared.snapshot, prepared.contents)
    this._contexts.set(id, context)
    this._statuses.set(id, prepared.statuses)
  }

  registerEditor(editor: EditorWindow): void {
    const native = editor.browserWindow
    const id = editor.sessionStateId
    if (!native || !id) throw new Error('Missing editor identity')
    this._editors.set(id, editor)
    const ownerId = native.webContents.id
    native.webContents.once('destroyed', () => documentWrites.clearOwner(ownerId))
  }

  async bindEditor(editor: EditorWindow, prepared: PreparedSessionWindow): Promise<void> {
    const id = prepared.snapshot.id
    const native = editor.browserWindow
    if (!native) throw new Error('Missing native window')
    if (!this._contexts.has(id)) await this._attachPrepared(prepared)
    if (prepared.restoreGeometry)
      applyWindowGeometry(native, prepared.snapshot.geometry, displays(), primary())
    editor.projectRoots.restore(
      prepared.snapshot.workspace?.roots.map((root) => ({
        pathname: root.location.path
      })) ?? []
    )
    for (const document of prepared.snapshot.documents) {
      if (document.resource.kind === 'file' && !document.resource.pendingCreation)
        editor.addToOpenedFiles(document.resource.location.path)
    }
    for (const pathname of prepared.rememberPaths ?? [])
      this._accessor.menu.addRecentlyUsedDocument(pathname)
    let geometry = prepared.restoreGeometry ? prepared.snapshot.geometry : undefined
    const updateGeometry = (): void => {
      if (native.isDestroyed() || !this._owner().getWindow(id)) return
      const captured = captureWindowGeometry(native, displays(), primary(), geometry)
      geometry = captured
      void this._owner()
        .commitState((state) => ({
          ...state,
          session: {
            ...state.session,
            windows: state.session.windows.map((window) =>
              window.id === id ? { ...window, geometry: captured } : window
            )
          }
        }))
        .catch((error) => this.report(error, id))
    }
    const scheduleGeometry = debounce(updateGeometry, 200)
    this._geometryWriters.set(id, scheduleGeometry)
    native.on('move', scheduleGeometry)
    native.on('resize', scheduleGeometry)
    // A completed manual resize must survive even if native zoom starts before the debounce.
    native.on('resized', updateGeometry)
    native.on('maximize', scheduleGeometry)
    native.on('unmaximize', scheduleGeometry)
    native.on('focus', () => {
      if (this._quitting || !this._owner().getWindow(id)) return
      void this._owner()
        .commitState((state) => ({
          ...state,
          session: activateSessionWindow(state.session, id, Date.now())
        }))
        .catch((error) => this.report(error, id))
    })
    updateGeometry()
    const result = await this._owner().flush(id, this._contexts.get(id)!.contextToken)
    if (result.status !== 'persisted')
      log.warn('Window initialized with unavailable recovery storage', id)
  }

  private async _initialization(editor: EditorWindow): Promise<WindowInitialization> {
    await editor.sessionReady
    const id = editor.sessionStateId
    if (!id) throw new Error('Unmanaged window')
    const context = this._contexts.get(id)
    if (!context) throw new Error('Missing renderer context')
    // Keep the published token valid during IO; publish its replacement without another IO gap.
    const result = await this._owner().flush(id, context.contextToken)
    const initialized = await this._owner().initializeRenderer(id)
    this._readyRenderers.delete(id)
    this._contexts.set(id, initialized.context)
    return {
      ...initialized,
      preferences: this._accessor.preferences.getAll(),
      projectRoots: editor.projectRoots.snapshot(),
      documentStatuses: this._statuses.get(id),
      persistenceAvailable: result.status === 'persisted',
      startupWarning: this._startupWarning
    }
  }

  private _contextMatches(windowId: string, token: string): boolean {
    return !!this._owner().getWindow(windowId) && this._contexts.get(windowId)?.contextToken === token
  }

  private _native(windowId: string): BrowserWindow {
    const window = this._editors.get(windowId)?.browserWindow
    if (!window || window.isDestroyed()) throw new Error('Window unavailable')
    return window
  }

  // Root contexts and document membership must reach the renderer before the next operation checkpoints them.
  private _enqueueWindowOperation<T>(id: string, operation: () => Promise<T>): Promise<T> {
    const result = (this._windowOperations.get(id) ?? Promise.resolve())
      .catch(() => {})
      .then(operation)
    this._windowOperations.set(id, result)
    return result
  }

  openFile(
    editor: EditorWindow,
    pathname: string,
    options: FileOpenOptions,
    selected: boolean
  ): Promise<void> {
    const id = editor.sessionStateId
    if (!id) return Promise.resolve()
    if (typeof options.requestId === 'number') this._previewRequests.set(id, options.requestId)
    return this._enqueueWindowOperation(id, async() => {
      await editor.sessionReady
      const obsolete = () =>
        options.preview &&
          typeof options.requestId === 'number' &&
          this._previewRequests.get(id) !== options.requestId
      if (obsolete()) return
      await this._requestCheckpoint(id)
      if (obsolete()) return
      const location = createFileLocation(pathname)
      const existing = this._owner()
        .getWindow(id)
        ?.documents.find(
          (document) =>
            document.resource.kind === 'file' && document.resource.location.key === location.key
        )
      if (existing) {
        this._native(id).webContents.send(
          'mt::switch-tab-by-file_path',
          existing.resource.kind === 'file' ? existing.resource.location.path : pathname,
          options
        )
        return
      }
      const loaded = await this._readDocument(pathname, options)
      if (obsolete()) return
      await this._requestCheckpoint(id)
      if (obsolete()) return
      const snapshot = this._owner().getWindow(id)!
      const preview = options.preview && this._accessor.preferences.getAll().openFilesInPreviewMode
      const retire = snapshot.documents.filter(
        (document) =>
          (preview &&
              this._previews.get(id) === document.id &&
              document.content.kind === 'disk') ||
            (selected &&
              document.id === snapshot.activeDocumentId &&
              document.resource.kind === 'untitled' &&
              document.content.kind === 'empty')
      )
      if (retire.length > 0) {
        const ended = await this._endDocuments(id, retire, false, false)
        if (ended.status !== 'persisted') throw new Error('Preview replacement was not committed')
      }
      const result = await this._owner().addDocument(id, loaded.document, loaded.content.markdown)
      if (result.status !== 'persisted')
        this.report(new Error('Recovery storage unavailable'), id)
      if (preview) this._previews.set(id, loaded.document.id)
      if (loaded.document.resource.kind === 'file' && !loaded.document.resource.pendingCreation)
        editor.addToOpenedFiles(pathname)
      this._accessor.menu.addRecentlyUsedDocument(pathname)
      const payload: ManagedDocumentPayload = {
        document: loaded.document,
        markdown: loaded.content.markdown,
        contentRevision: 0,
        selected,
        options,
        replacedDocumentIds: retire.map((document) => document.id)
      }
      this._native(id).webContents.send('mt::state::document-opened', payload)
    })
  }

  cancelPreview(windowId: string, requestId: number): void {
    if (this._previewRequests.get(windowId) === requestId) this._previewRequests.delete(windowId)
  }

  newDocument(
    windowId: string,
    title: string,
    markdown = '',
    selected = true
  ): Promise<DocumentSnapshot> {
    return this._enqueueWindowOperation(windowId, () =>
      this._registerDocument(windowId, title, markdown, selected)
    )
  }

  private async _registerDocument(
    windowId: string,
    title: string,
    markdown: string,
    selected: boolean
  ): Promise<DocumentSnapshot> {
    const snapshot = this._owner().getWindow(windowId)
    if (!snapshot) throw new Error('Unknown window')
    const maximum = snapshot.documents.reduce(
      (maximum, document) => {
        const match = /^Untitled-(\d+)$/.exec(document.title)
        return Math.max(maximum, match ? Number(match[1]) : 0)
      },
      this._untitledNumbers.get(windowId) ?? 0
    )
    this._untitledNumbers.set(windowId, maximum + 1)
    const document = this._blankDocument(markdown, title || `Untitled-${maximum + 1}`)
    const result = await this._owner().addDocument(windowId, document, markdown)
    if (result.status !== 'persisted')
      this.report(new Error('Recovery storage unavailable'), windowId)
    this._native(windowId).webContents.send('mt::state::document-opened', {
      document,
      markdown,
      contentRevision: document.content.kind === 'recovery' ? document.content.contentRevision : 0,
      selected
    } satisfies ManagedDocumentPayload)
    return document
  }

  async changeFolder(editor: EditorWindow, pathname: string, replace: boolean): Promise<void> {
    await editor.sessionReady
    const id = editor.sessionStateId
    if (!id) return
    await this._enqueueWindowOperation(id, async() => {
      await this._requestCheckpoint(id)
      editor.projectRoots.add(pathname, replace)
      await this._synchronizeRoots(editor)
    })
  }

  async removeRoot(editor: EditorWindow, key: string): Promise<boolean> {
    await editor.sessionReady
    return this._enqueueWindowOperation(editor.sessionStateId!, async() => {
      if (!editor.projectRoots.roots.some((root) => root.key === key)) return false
      await this._requestCheckpoint(editor.sessionStateId!)
      editor.projectRoots.remove(key)
      await this._synchronizeRoots(editor)
      return true
    })
  }

  private async _synchronizeRoots(editor: EditorWindow): Promise<void> {
    const id = editor.sessionStateId!
    const workspace = createWorkspaceDescriptor(
      editor.projectRoots.roots.map((root) => root.pathname)
    )
    await this._owner().commitState((state) => ({
      ...state,
      session: {
        ...state.session,
        windows: state.session.windows.map((window) =>
          window.id === id
            ? {
              ...window,
              workspace,
              projectView: {
                roots: window.projectView.roots.filter((view) =>
                  workspace?.roots.some((root) => root.id === view.rootId)
                )
              }
            }
            : window
        )
      }
    }))
    const initialized = await this._initialization(editor)
    this._native(id).webContents.send('mt::state::context-changed', initialized)
  }

  private _requestCheckpoint(
    windowId: string,
    transactionId = createStateId()
  ): Promise<WindowSnapshot> {
    const result = (this._checkpointQueues.get(windowId) ?? Promise.resolve())
      .catch(() => {})
      .then(() => this._checkpointNow(windowId, transactionId))
    this._checkpointQueues.set(windowId, result)
    return result
  }

  private async _checkpointNow(
    windowId: string,
    transactionId: string,
  ): Promise<WindowSnapshot> {
    this._geometryWriters.get(windowId)?.flush()
    if (!this.isRendererInitialized(windowId)) {
      const context = this._contexts.get(windowId)
      if (!context) throw new Error('Missing renderer context')
      const result = await this._owner().flush(windowId, context.contextToken)
      const snapshot = this._owner().getWindow(windowId)
      if (result.status !== 'persisted' || !snapshot) throw new Error('Initial checkpoint unavailable')
      return snapshot
    }
    const existing = this._waiting.get(windowId)
    if (existing) throw new Error('Another window checkpoint is pending')
    await this._owner().beginCloseCheckpoint(windowId, transactionId)
    const context = this._contexts.get(windowId)
    if (!context) throw new Error('Missing renderer context')
    return new Promise<WindowSnapshot>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this._waiting.delete(windowId)
        void this._owner().cancelCloseCheckpoint(windowId, transactionId)
        reject(new Error('The editor did not finish its recovery checkpoint'))
      }, 10000)
      this._waiting.set(windowId, { transactionId, resolve, reject, timeout })
      this._native(windowId).webContents.send('mt::state::prepare-close', {
        contextToken: context.contextToken,
        transactionId
      })
    })
  }

  async closeWindow(editor: EditorWindow): Promise<void> {
    await editor.sessionReady
    if (editor.sessionStateId) await this._coordinator.closeWindow(editor.sessionStateId)
    if (this._editors.size === 0 && process.platform !== 'darwin') app.quit()
  }

  rendererGone(editor: EditorWindow): void {
    const id = editor.sessionStateId
    if (!id) return
    this._readyRenderers.delete(id)
    const pending = this._waiting.get(id)
    if (pending) {
      clearTimeout(pending.timeout)
      this._waiting.delete(id)
      pending.reject(new Error('The renderer stopped before completing its checkpoint'))
    }
  }

  private async _choose(snapshot: WindowSnapshot): Promise<'save' | 'discard' | 'cancel'> {
    const documents = snapshot.documents.filter((document) => document.content.kind === 'recovery')
    const documentLabels = documents.map((document) =>
      document.resource.kind === 'file' ? document.resource.location.path : document.title
    )
    const { response } = await dialog.showMessageBox(this._native(snapshot.id), {
      type: 'warning',
      buttons: [
        t(
          documents.some((document) => document.readOnly) ? 'readingMode.closeSave' : 'dialog.save'
        ),
        t('dialog.dontSave'),
        t('dialog.cancel')
      ],
      defaultId: 0,
      cancelId: 2,
      noLink: true,
      message: t('dialog.saveChanges'),
      detail: `${documentLabels.join('\n')}\n\n${t('dialog.changesWillBeLost')}`
    })
    if (response === 0) return 'save'
    if (response === 1) return 'discard'
    return 'cancel'
  }

  private async _diskBaseline(pathname: string): Promise<DiskBaseline> {
    try {
      const bytes = await readFile(pathname)
      const info = await stat(pathname)
      return {
        exists: true,
        rawSha256: contentSha256(bytes),
        sizeBytes: bytes.byteLength,
        mtimeMs: info.mtimeMs
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { exists: false }
      throw error
    }
  }

  async saveDocument(
    windowId: string,
    documentId: string,
    saveAs = false,
    allowReadOnly = false
  ): Promise<ManagedSaveResult> {
    const document = this._owner()
      .getWindow(windowId)
      ?.documents.find((document) => document.id === documentId)
    if (!document || (document.readOnly && !allowReadOnly)) return { status: 'failed' }
    let previousPath = ''
    let savedMarkdown = ''
    let savedFormat = document.saveFormat
    const sender = this._native(windowId).webContents
    if (allowReadOnly && document.readOnly)
      await documentWrites.setReadOnly(sender.id, documentId, false)
    try {
      const result = await this._owner().saveDocument(windowId, documentId, async(capture) => {
        const epoch = documentWrites.capture(sender.id, documentId)
        if (epoch === null) throw new Error('Document is read-only')
        const native = this._native(windowId)
        const resource = capture.snapshot.resource
        // A preceding queued Save As may have rebound the resource since the request arrived.
        previousPath = resource.kind === 'file' ? resource.location.path : ''
        let destination = resource.kind === 'file' ? resource.location.path : ''
        if (saveAs || !destination) {
          const choice = await dialog.showSaveDialog(native, {
            defaultPath:
              destination || path.join(app.getPath('documents'), `${capture.snapshot.title}.md`)
          })
          if (choice.canceled || !choice.filePath) return null
          destination = choice.filePath
        } else {
          const current = await this._diskBaseline(destination)
          const baseline = capture.baseline
          const changed = baseline?.exists
            ? current.exists &&
              (current.rawSha256 !== baseline.rawSha256 ||
                (resource.kind === 'file' &&
                  createFileLocation(destination).key !== resource.location.key))
            : current.exists
          if (changed) {
            const choice = await dialog.showMessageBox(native, {
              type: 'warning',
              buttons: [t('dialog.replace'), t('dialog.cancel')],
              defaultId: 1,
              cancelId: 1,
              message: t('dialog.fileExists', { filename: destination })
            })
            if (choice.response !== 0) return null
          }
        }
        const written = await documentWrites.write(sender.id, documentId, epoch, async() => {
          await writeMarkdownFile(destination, capture.markdown, capture.snapshot.saveFormat)
          return true
        })
        if (!written) throw new Error('Document became read-only before the save completed')
        savedMarkdown = capture.markdown
        savedFormat = capture.snapshot.saveFormat
        const baseline = await this._diskBaseline(destination)
        const snapshot: DocumentSnapshot = {
          ...capture.snapshot,
          title: path.basename(destination),
          resource: {
            kind: 'file',
            location: createFileLocation(destination),
            pendingCreation: false
          },
          content: { kind: 'disk', baseline }
        }
        return { snapshot, markdown: capture.markdown }
      })
      if (result.status === 'cancelled') return { status: 'canceled' }
      if (result.status !== 'persisted') {
        this.report(new Error('Recovery metadata unavailable after save'), windowId)
        if (result.reason !== 'storage-unavailable') return { status: 'failed' }
      }
      const saved = this._owner().getDocument(documentId)
      this._statuses.set(
        windowId,
        (this._statuses.get(windowId) ?? []).filter((status) => status.documentId !== documentId)
      )
      if (saved.resource.kind === 'file') {
        const editor = this._editors.get(windowId)
        if (previousPath && previousPath !== saved.resource.location.path)
          editor?.changeOpenedFilePath(saved.resource.location.path, previousPath)
        else editor?.addToOpenedFiles(saved.resource.location.path)
        this._accessor.menu.addRecentlyUsedDocument(saved.resource.location.path)
        ipcMain.emit('window-file-saved', this._native(windowId).id, saved.resource.location.path)
      }
      const response: Extract<ManagedSaveResult, { status: 'saved' }> = {
        status: 'saved',
        document: saved,
        savedMarkdown,
        savedFormat,
        metadataRevision: this._owner().getState().revision
      }
      this._native(windowId).webContents.send('mt::state::document-saved', response)
      return response
    } catch (error) {
      this._native(windowId).webContents.send(
        'mt::tab-save-failure',
        documentId,
        error instanceof Error ? error.message : String(error)
      )
      this.report(error, windowId)
      return { status: 'failed' }
    } finally {
      if (allowReadOnly && document.readOnly) {
        const current = this._owner()
          .getWindow(windowId)
          ?.documents.find((document) => document.id === documentId)
        if (current?.readOnly) await documentWrites.setReadOnly(sender.id, documentId, true)
      }
    }
  }

  moveSidebarItem(windowId: string, request: SidebarMoveRequest): Promise<SidebarMoveResult> {
    return this._enqueueWindowOperation(windowId, async() => {
      const root = this._editors.get(windowId)?.projectRoots.roots.find(root => root.key === request.rootKey)
      if (!root || root.status !== 'ready') return { status: 'failed', message: t('sideBar.move.invalidTarget') }
      return confirmAndMoveSidebarItem(this._native(windowId), request, {
        root: root.pathname,
        checkAvailable: (source, destination) => {
          if (root.status !== 'ready' || !this._editors.get(windowId)?.projectRoots.roots.includes(root)) {
            throw new Error(t('sideBar.move.invalidTarget'))
          }
          for (const win of this._owner().getState().session.windows) {
            for (const document of win.documents) {
              if (document.resource.kind !== 'file') continue
              const pathname = document.resource.location.canonicalPath
              if (win.id !== windowId && containsPath(source, pathname)) {
                throw new Error(t('sideBar.move.openElsewhere'))
              }
              if (containsPath(destination, pathname)) throw new Error(t('sideBar.move.destinationOpen'))
            }
          }
        },
        move: (_source, destination, write) => this._moveResourceNow(windowId, {
          source: createFileLocation(request.source),
          destination: createFileLocation(destination)
        }, write)
      })
    })
  }

  moveResource(
    windowId: string,
    source: string,
    target: string,
    move: () => Promise<void>
  ): Promise<void> {
    return this._enqueueWindowOperation(windowId, () =>
      this._moveResourceNow(windowId, {
        source: createFileLocation(source), destination: createFileLocation(target)
      }, move)
    )
  }

  private async _moveResourceNow(
    windowId: string,
    relocation: ResourceMove,
    move: () => Promise<void>
  ): Promise<void> {
    const affected =
      this._owner()
        .getWindow(windowId)
        ?.documents.flatMap((document) => {
          if (document.resource.kind !== 'file') return []
          const destination = relocateResourcePath(document.resource.location.canonicalPath, relocation)
          return destination === null ? [] : [{ document, destination }]
        }) ?? []
    if (!affected.length) {
      await move()
      this._accessor.menu.relocateRecentlyUsedDocuments(relocation)
      return
    }
    await this._requestCheckpoint(windowId)
    if (affected.some(({ document }) => this._owner().hasPendingSave(document.id)))
      throw new Error('Cannot move a document while saving')
    const senderId = this._native(windowId).webContents.id
    await documentWrites.withBlockedWrites(
      senderId,
      affected.map(({ document }) => document.id),
      async() => {
        if (affected.some(({ document }) => this._owner().hasPendingSave(document.id)))
          throw new Error('Cannot move a document while saving')
        const oldPaths = affected.flatMap(({ document }) => document.resource.kind === 'file'
          ? [document.resource.location.path, document.resource.location.canonicalPath]
          : [])
        await this._accessor.windowManager.withIgnoredFileDeletions(this._native(windowId), oldPaths, async() => {
          await move()
          await this._owner().settlePendingSaves(affected.map(({ document }) => document.id))
          for (const { document, destination } of affected) {
            const previous = document.resource.kind === 'file' ? document.resource.location.path : ''
            const result = await this._owner().relocateDocument(
              windowId,
              document.id,
              createFileLocation(destination),
              path.basename(destination)
            )
            this._editors.get(windowId)?.changeOpenedFilePath(destination, previous)
            this._native(windowId).webContents.send(
              'mt::state::document-relocated',
              this._owner().getDocument(document.id),
              this._owner().getState().revision
            )
            if (result.status !== 'persisted')
              this.report(new Error('Recovery metadata unavailable after move'), windowId)
          }
        })
      }
    )
    this._accessor.menu.relocateRecentlyUsedDocuments(relocation)
  }

  async renameDocument(windowId: string, documentId: string, destination: string): Promise<void> {
    await this._requestCheckpoint(windowId)
    const document = this._owner()
      .getWindow(windowId)
      ?.documents.find((document) => document.id === documentId)
    if (
      !document ||
      document.resource.kind !== 'file' ||
      document.resource.pendingCreation ||
      typeof destination !== 'string'
    )
      return
    const source = document.resource.location.path
    const target = path.resolve(destination)
    if (source === target) return
    const existing = await this._diskBaseline(target)
    if (existing.exists) {
      const choice = await dialog.showMessageBox(this._native(windowId), {
        type: 'warning',
        buttons: [t('dialog.replace'), t('dialog.cancel')],
        defaultId: 1,
        cancelId: 1,
        message: t('dialog.fileExists', { filename: target })
      })
      if (choice.response !== 0) return
    }
    await this.moveResource(windowId, source, target, () => rename(source, target))
    const moved = this._owner().getDocument(documentId)
    if (moved.resource.kind === 'file') this._accessor.menu.addRecentlyUsedDocument(moved.resource.location.path)
  }

  async moveDocument(windowId: string, documentId: string): Promise<void> {
    const document = this._owner()
      .getWindow(windowId)
      ?.documents.find((document) => document.id === documentId)
    if (!document || document.resource.kind !== 'file') return
    const result = await dialog.showSaveDialog(this._native(windowId), {
      buttonLabel: 'Move to',
      defaultPath: document.resource.location.path
    })
    if (!result.canceled && result.filePath)
      await this.renameDocument(windowId, documentId, result.filePath)
  }

  private async _endDocuments(
    windowId: string,
    documents: DocumentSnapshot[],
    discard: boolean,
    notify = true
  ): Promise<PersistResult> {
    const result = await this._owner().endDocuments(windowId, documents, discard)
    if (result.status !== 'persisted') return result
    const ids = new Set(documents.map((document) => document.id))
    this._statuses.set(
      windowId,
      (this._statuses.get(windowId) ?? []).filter((status) => !ids.has(status.documentId))
    )
    for (const document of documents) {
      if (document.resource.kind === 'file')
        this._editors.get(windowId)?.removeFromOpenedFiles(document.resource.location.path)
    }
    if (notify) this._native(windowId).webContents.send('mt::state::documents-ended', [...ids])
    return result
  }

  async observeFile(
    windowId: string,
    payload: {
      type: string
      change: { pathname: string; data?: Awaited<ReturnType<typeof loadMarkdownFile>> }
    }
  ): Promise<void> {
    const document = this._owner()
      .getWindow(windowId)
      ?.documents.find(
        (document) =>
          document.resource.kind === 'file' &&
          (path.resolve(document.resource.location.path) ===
            path.resolve(payload.change.pathname) ||
            path.resolve(document.resource.location.canonicalPath) ===
              path.resolve(payload.change.pathname))
      )
    if (!document) return
    if (payload.type === 'unlink') {
      const statuses = (this._statuses.get(windowId) ?? []).filter(
        (status) => status.documentId !== document.id
      )
      this._statuses.set(windowId, [
        ...statuses,
        { documentId: document.id, diskMissing: true, diskConflict: false }
      ])
      const result = await this._owner().observeDisk(windowId, document.id, null)
      if (result.status !== 'persisted')
        this.report(new Error('Deleted file recovery was not persisted'), windowId)
    } else if (payload.change.data) {
      const raw = payload.change.data
      const saved: DocumentSnapshot = {
        ...document,
        resource: {
          kind: 'file',
          location: createFileLocation(raw.pathname),
          pendingCreation: false
        },
        content: { kind: 'disk', baseline: raw.rawBaseline },
        saveFormat: {
          encoding: { encoding: raw.encoding.encoding, isBom: !!raw.encoding.isBom },
          lineEnding: raw.lineEnding,
          adjustLineEndingOnSave: raw.adjustLineEndingOnSave,
          trimTrailingNewline: raw.trimTrailingNewline as SaveFormatState['trimTrailingNewline']
        }
      }
      const result = await this._owner().observeDisk(windowId, document.id, saved, raw.markdown)
      if (result.status !== 'persisted')
        this.report(new Error('External file state was not persisted'), windowId)
    }
  }

  private async _closeDocuments(
    windowId: string,
    ids: string[]
  ): Promise<{ status: 'closed' | 'canceled' | 'failed' }> {
    if (this._tabClosePending) return { status: 'canceled' }
    this._tabClosePending = true
    try {
      const initial = await this._requestCheckpoint(windowId)
      const selected = initial.documents.filter((document) => ids.includes(document.id))
      if (selected.length !== new Set(ids).size) return { status: 'failed' }
      const snapshot = { ...initial, documents: selected }
      const dirty = selected.filter((document) => document.content.kind === 'recovery')
      const choice = dirty.length ? await this._choose(snapshot) : 'discard'
      if (choice === 'cancel') return { status: 'canceled' }
      if (choice === 'save') {
        for (const document of dirty) {
          const result = await this.saveDocument(windowId, document.id, false, true)
          if (result.status !== 'saved')
            return { status: result.status === 'canceled' ? 'canceled' : 'failed' }
        }
      }
      const latest = await this._requestCheckpoint(windowId)
      for (const document of latest.documents.filter((document) => ids.includes(document.id))) {
        const before = selected.find((item) => item.id === document.id)
        if (
          document.content.kind === 'recovery' &&
          (choice === 'save' ||
            before?.content.kind !== 'recovery' ||
            before.content.contentRevision !== document.content.contentRevision)
        )
          return { status: 'canceled' }
      }
      const prepared = latest.documents.filter((document) => ids.includes(document.id))
      if (prepared.length !== new Set(ids).size) return { status: 'canceled' }
      const result = await this._endDocuments(windowId, prepared, choice === 'discard')
      if (result.status === 'persisted') return { status: 'closed' }
      if (result.reason === 'stale-sequence') return { status: 'canceled' }
      throw new Error('Document close was not committed')
    } catch (error) {
      this.report(error, windowId)
      return { status: 'failed' }
    } finally {
      this._tabClosePending = false
    }
  }

  report(error: unknown, windowId?: string): void {
    log.error('Session recovery operation failed', error)
    const native = windowId
      ? this._editors.get(windowId)?.browserWindow
      : [...this._editors.values()][0]?.browserWindow
    if (native && !native.isDestroyed())
      native.webContents.send('mt::show-notification', {
        title: t('sideBar.tree.sessionSaveFailed'),
        type: 'error',
        message: 'Keep this window open and save your documents before quitting.'
      })
  }

  private _findEditor(sender: WebContents): EditorWindow | undefined {
    return [...this._editors.values()].find(editor => editor.browserWindow?.webContents === sender)
  }

  private _registerIpc(): void {
    const editorFor = (sender: WebContents): EditorWindow => {
      const editor = this._findEditor(sender)
      if (!editor) throw new Error('Unrecognized editor window')
      return editor
    }
    ipcMain.on('mt::window-initialized', (event) => {
      const editor = this._findEditor(event.sender)
      if (editor?.sessionStateId) {
        this._readyRenderers.add(editor.sessionStateId)
        if (editor?.browserWindow && !editor.browserWindow.isVisible()) editor.bringToFront()
        if (
          this._startupWindowIds.size &&
          [...this._startupWindowIds].every((id) => this.isRendererInitialized(id))
        ) {
          if (this._startupActiveId) this._editors.get(this._startupActiveId)?.bringToFront()
          this._startupWindowIds.clear()
          this._startupActiveId = null
        }
      }
    })
    ipcMain.handle('mt::state::get-window-initialization', (event) => {
      const editor = editorFor(event.sender)
      if (this.isRendererInitialized(editor.sessionStateId)) {
        // A replacement renderer needs the initial directory scan, not only future changes.
        editor.projectRoots.restore(editor.projectRoots.roots.map(({ pathname }) => ({ pathname })))
      }
      return this._initialization(editor)
    })
    ipcMain.handle('mt::preferences::get', () => this._accessor.preferences.getAll())
    ipcMain.handle('mt::preferences::update', (_event, patch) => {
      const result = this._accessor.preferences.update(patch)
      if (result.status === 'persisted')
        for (const window of BrowserWindow.getAllWindows())
          window.webContents.send('mt::preferences::changed', result.preferences)
      return result
    })
    ipcMain.handle('mt::preferences::choose-directory', async(event) => {
      const window = BrowserWindow.fromWebContents(event.sender)
      if (!window) return null
      const result = await dialog.showOpenDialog(window, { properties: ['openDirectory'] })
      return result.canceled ? null : (result.filePaths[0] ?? null)
    })
    ipcMain.handle(
      'mt::state::register-untitled',
      async(
        event,
        request: { contextToken: string; title: string; markdown?: string; selected?: boolean }
      ) => {
        const editor = editorFor(event.sender)
        const id = editor.sessionStateId!
        if (!this._contextMatches(id, request.contextToken))
          return { status: 'failed', reason: 'stale-context' }
        if (
          typeof request.title !== 'string' ||
          (request.markdown !== undefined && typeof request.markdown !== 'string')
        )
          return { status: 'failed', reason: 'invalid-data' }
        const document = await this.newDocument(
          id,
          request.title,
          request.markdown ?? '',
          request.selected ?? true
        )
        return { status: 'registered', document }
      }
    )
    ipcMain.handle(
      'mt::state::checkpoint',
      async(event, request: WindowCheckpointRequest): Promise<PersistResult> => {
        const editor = editorFor(event.sender)
        const id = editor.sessionStateId!
        const result = await this._owner().checkpoint(id, request)
        if (result.status === 'persisted') {
          if (
            request.previewDocumentId &&
            this._owner()
              .getWindow(id)
              ?.documents.some((document) => document.id === request.previewDocumentId)
          )
            this._previews.set(id, request.previewDocumentId)
          else this._previews.delete(id)
        }
        const pending = this._waiting.get(id)
        if (pending && request?.closeTransactionId === pending.transactionId) {
          clearTimeout(pending.timeout)
          this._waiting.delete(id)
          await this._owner().cancelCloseCheckpoint(id, pending.transactionId)
          const snapshot = this._owner().getWindow(id)
          if (result.status === 'persisted' && snapshot) pending.resolve(snapshot)
          else pending.reject(new Error('Final checkpoint was not persisted'))
        }
        return result
      }
    )
    ipcMain.handle(
      'mt::state::save-document',
      async(event, token: string, id: string, saveAs: boolean) => {
        const editor = editorFor(event.sender)
        if (!this._contextMatches(editor.sessionStateId!, token)) return { status: 'failed' }
        return this.saveDocument(editor.sessionStateId!, id, saveAs)
      }
    )
    ipcMain.handle('mt::state::close-documents', (event, token: string, ids: string[]) => {
      const editor = editorFor(event.sender)
      if (
        !this._contextMatches(editor.sessionStateId!, token) ||
        !Array.isArray(ids) ||
        ids.some((id) => typeof id !== 'string')
      )
        return { status: 'failed' }
      return this._closeDocuments(editor.sessionStateId!, ids)
    })
  }
}
