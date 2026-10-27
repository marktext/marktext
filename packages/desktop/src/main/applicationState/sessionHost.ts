import { app, BrowserWindow, dialog, ipcMain, screen, type WebContents } from 'electron'
import { readFile, stat, rename } from 'node:fs/promises'
import path from 'node:path'
import log from 'electron-log'
import debounce from 'lodash/debounce'
import type Accessor from '../app/accessor'
import type EditorWindow from '../windows/editor'
import type { FileOpenOptions } from '../windows/editor'
import { loadMarkdownFile, loadCliMarkdownFile, writeMarkdownFile } from '../filesystem/markdown'
import { t } from '../i18n'
import { documentWrites } from '../filesystem/documentWrites'
import { createDefaultLayout } from '@shared/applicationState/defaults'
import {
  buildStartupPlan,
  type StartupWindowPlan,
  type ExplicitTarget
} from '@shared/applicationState/startupPlan'
import type {
  ApplicationState,
  DocumentSnapshot,
  DiskBaseline,
  RecoveryRecord,
  WindowSnapshot,
  WindowInitialization,
  RuntimeWindowContext,
  WindowCheckpointRequest,
  PersistResult,
  ManagedSaveResult,
  ManagedDocumentPayload,
  SaveFormatState
} from '@shared/types/applicationState'
import { ApplicationStateStore, RecoveryStore } from './storage'
import { CheckpointService, type RegisteredDocumentContent } from './checkpointService'
import { CloseCoordinator } from './closeCoordinator'
import {
  createStateId,
  contentSha256,
  createFileLocation,
  createWorkspaceDescriptor
} from './identity'
import { applyWindowGeometry, captureWindowGeometry } from './windowGeometry'
import { getManagedOwner, registerManagedOwner } from './sessionHostAccess'

export interface StartupPath extends FileOpenOptions {
  path: string
  isDir: boolean
}
export interface PreparedSessionWindow {
  snapshot: WindowSnapshot
  contents: RegisteredDocumentContent[]
  restoreGeometry: boolean
  statuses: NonNullable<WindowInitialization['documentStatuses']>
  openable: boolean
}
interface PendingCheckpoint {
  transactionId: string
  resolve(snapshot: WindowSnapshot): void
  reject(error: Error): void
  timeout: ReturnType<typeof setTimeout>
}
const displays = () =>
  screen.getAllDisplays().map((display) => ({ id: String(display.id), workArea: display.workArea }))
const primary = () => String(screen.getPrimaryDisplay().id)

/** Connects the new state owner to native windows; the production entry is switched in part 10. */
export class SessionHost {
  private readonly metadata: ApplicationStateStore
  private readonly recovery: RecoveryStore
  private readonly loaded: Promise<ApplicationState>
  private service: CheckpointService | null = null
  private readonly editors = new Map<string, EditorWindow>()
  private readonly contexts = new Map<string, RuntimeWindowContext>()
  private readonly records = new Map<string, RecoveryRecord[]>()
  private readonly statuses = new Map<string, PreparedSessionWindow['statuses']>()
  private readonly waiting = new Map<string, PendingCheckpoint>()
  private readonly attached = new Set<string>()
  private readonly rendererReady = new Set<string>()
  private readonly geometryWriters = new Map<string, ReturnType<typeof debounce<() => void>>>()
  private readonly rendererUnavailable = new Set<string>()
  private readonly coordinator: CloseCoordinator
  private quitAllowed = false
  private tabClosePending = false
  private startQueue: Promise<void> = Promise.resolve()
  private readonly fileQueues = new Map<string, Promise<void>>()
  private readonly checkpointQueues = new Map<string, Promise<WindowSnapshot>>()
  private readonly previewRequests = new Map<string, number>()
  private readonly previews = new Map<string, string>()

  constructor(private readonly accessor: Accessor) {
    this.metadata = new ApplicationStateStore(app.getPath('userData'))
    this.recovery = new RecoveryStore(app.getPath('userData'))
    this.loaded = this.metadata.load().then((result) => result.value)
    this.coordinator = new CloseCoordinator({
      getSession: () => this.owner().getState().session,
      checkpoint: (id, transactionId) => this.requestCheckpoint(id, transactionId),
      choose: (snapshot) => this.choose(snapshot),
      save: async(snapshot) => {
        for (const document of snapshot.documents.filter(
          (document) => document.content.kind === 'recovery'
        )) {
          const result = await this.saveDocument(snapshot.id, document.id, false, true)
          if (result.status !== 'saved') return result.status === 'canceled' ? 'canceled' : 'failed'
        }
        return 'saved'
      },
      discard: async(id, ids) => {
        for (const documentId of ids) await this.endDocument(id, documentId, true)
      },
      commit: (session) => this.owner().commitState((state) => ({ ...state, session })),
      destroy: async(id) => {
        const editor = this.editors.get(id)
        if (!editor) return
        if (editor.id !== null) this.accessor.menu.removeWindowMenu(editor.id)
        editor.destroy()
        this.editors.delete(id)
        this.contexts.delete(id)
        this.rendererReady.delete(id)
        this.rendererUnavailable.delete(id)
        this.attached.delete(id)
        this.statuses.delete(id)
        this.geometryWriters.get(id)?.cancel()
        this.geometryWriters.delete(id)
        this.fileQueues.delete(id)
        this.checkpointQueues.delete(id)
        this.previews.delete(id)
        this.previewRequests.delete(id)
      }
    })
    this.registerIpc()
    app.on('before-quit', (event) => {
      if (this.quitAllowed || !this.service) return
      event.preventDefault()
      void this.coordinator
        .quit()
        .then(() => {
          if (this.owner().getState().session.lifecycle === 'closed' && this.editors.size === 0) {
            this.quitAllowed = true
            app.quit()
          }
        })
        .catch((error) => this.report(error))
    })
  }

  private owner(): CheckpointService {
    if (!this.service) throw new Error('Session is not initialized')
    return this.service
  }

  private defaultFormat(): SaveFormatState {
    const preferences = this.accessor.preferences.getAll()
    const lineEnding = this.accessor.preferences.getPreferredEol()
    return {
      encoding: { encoding: preferences.defaultEncoding, isBom: false },
      lineEnding,
      adjustLineEndingOnSave: lineEnding === 'crlf',
      trimTrailingNewline: preferences.trimTrailingNewline
    }
  }

  private blankDocument(markdown = '', title = 'Untitled-1'): DocumentSnapshot {
    return {
      id: createStateId(),
      title,
      resource: { kind: 'untitled' },
      content: markdown ? { kind: 'recovery', contentRevision: 1 } : { kind: 'empty' },
      readOnly: false,
      saveFormat: this.defaultFormat(),
      view: null
    }
  }

  private blankWindow(): WindowSnapshot {
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
      layout: createDefaultLayout(this.accessor.preferences.getAll()),
      projectView: { roots: [] },
      documents: [],
      activeDocumentId: null
    }
  }

  private async readDocument(
    pathname: string,
    options: FileOpenOptions = {},
    id = createStateId()
  ): Promise<{ document: DocumentSnapshot; content: RegisteredDocumentContent }> {
    const preferences = this.accessor.preferences.getAll()
    const raw =
      options.allowMissing && !options.readOnly
        ? await loadCliMarkdownFile(
          pathname,
          preferences.defaultEncoding,
          this.accessor.preferences.getPreferredEol(),
          preferences.autoGuessEncoding,
          preferences.trimTrailingNewline,
          preferences.autoNormalizeLineEndings
        )
        : await loadMarkdownFile(
          pathname,
          this.accessor.preferences.getPreferredEol(),
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

  start(paths: StartupPath[], create: (prepared: PreparedSessionWindow) => void): Promise<void> {
    const result = this.startQueue.then(() => this.startNow(paths, create))
    this.startQueue = result.catch(() => {})
    return result
  }

  private async startNow(
    paths: StartupPath[],
    create: (prepared: PreparedSessionWindow) => void
  ): Promise<void> {
    if (this.service) {
      create(await this.prepareNewWindow(null, [], []))
      return
    }
    const previous = await this.loaded
    const preferences = this.accessor.preferences.getAll()
    let configuredWorkspace: WindowSnapshot['workspace'] = null
    try {
      if (
        preferences.defaultDirectoryToOpen &&
        (await stat(preferences.defaultDirectoryToOpen)).isDirectory()
      )
        configuredWorkspace = createWorkspaceDescriptor([preferences.defaultDirectoryToOpen])
    } catch (error) {
      log.warn(error)
    }
    const targets: ExplicitTarget[] = paths.flatMap((item): ExplicitTarget[] => {
      if (!item.isDir) return [{ kind: 'file', pathname: item.path, readOnly: !!item.readOnly }]
      const workspace = createWorkspaceDescriptor([item.path])
      return workspace ? [{ kind: 'folder', workspace }] : []
    })
    const input = {
      state: previous,
      preferences,
      configuredWorkspace,
      request: targets.length ? { kind: 'explicit' as const, targets } : undefined
    }
    const selected = buildStartupPlan(input).slice(0, 1)
    for (const plan of selected) {
      if (plan.kind === 'restore') {
        try {
          this.records.set(plan.snapshot.id, await this.recovery.readWindow(plan.snapshot.id))
        } catch (error) {
          log.warn('Recovery directory unavailable', error)
          this.records.set(plan.snapshot.id, [])
        }
      }
    }
    const plans = buildStartupPlan({ ...input, recoveryRecords: this.records }).slice(0, 1)
    const prepared: PreparedSessionWindow[] = []
    for (const plan of plans) prepared.push(await this.preparePlan(plan, paths))
    this.records.clear()
    const runtime: ApplicationState = {
      ...previous,
      session: {
        id: createStateId(),
        lifecycle: 'running',
        windows: [],
        activeWindowId: null,
        lastWindow: null
      }
    }
    this.service = new CheckpointService(runtime, this.metadata, this.recovery, Date.now, (error) =>
      log.warn('Recovery cleanup will be retried', error)
    )
    for (const window of prepared) await this.attachPrepared(window)
    for (const window of prepared) create(window)
  }

  private async preparePlan(
    plan: StartupWindowPlan,
    paths: StartupPath[]
  ): Promise<PreparedSessionWindow> {
    if (plan.kind === 'explicit') {
      const folders = plan.targets.flatMap((target) =>
        target.kind === 'folder' ? target.workspace.roots.map((root) => root.location.path) : []
      )
      const files = plan.targets.flatMap((target) =>
        target.kind === 'file' ? [target.pathname] : []
      )
      const options = Object.fromEntries(paths.map((item) => [item.path, item]))
      const prepared = await this.prepareNewWindow(null, files, [], options)
      if (folders.length) prepared.snapshot.workspace = createWorkspaceDescriptor(folders)
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
    snapshot.layout = plan.layout
    const contents: RegisteredDocumentContent[] = []
    const documents: DocumentSnapshot[] = []
    const statuses: PreparedSessionWindow['statuses'] = []
    for (const document of snapshot.documents) {
      if (document.content.kind === 'recovery') {
        const revision = document.content.contentRevision
        const record = this.records
          .get(snapshot.id)
          ?.find(
            (record) =>
              record.status === 'dirty' &&
              record.documentId === document.id &&
              record.contentRevision === revision
          )
        if (!record || record.status !== 'dirty') {
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
            const disk = await this.readDocument(
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
          const loaded = await this.readDocument(
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
      const document = this.blankDocument()
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
    const snapshot = this.blankWindow()
    if (root) snapshot.workspace = createWorkspaceDescriptor([root])
    const contents: RegisteredDocumentContent[] = []
    for (const pathname of files) {
      try {
        const loaded = await this.readDocument(pathname, options[pathname])
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
      const document = this.blankDocument(text, `Untitled-${snapshot.documents.length + 1}`)
      snapshot.documents.push(document)
      contents.push({ documentId: document.id, markdown: text })
    }
    if (snapshot.documents.length === 0) {
      const document = this.blankDocument()
      snapshot.documents.push(document)
      contents.push({ documentId: document.id, markdown: '' })
    }
    snapshot.activeDocumentId = snapshot.documents[0].id
    return { snapshot, contents, restoreGeometry: false, statuses: [], openable: true }
  }

  private async attachPrepared(prepared: PreparedSessionWindow): Promise<void> {
    const id = prepared.snapshot.id
    const context = await this.owner().attachWindow(prepared.snapshot, prepared.contents)
    this.contexts.set(id, context)
    this.statuses.set(id, prepared.statuses)
    this.attached.add(id)
  }

  registerEditor(editor: EditorWindow): void {
    const native = editor.browserWindow
    const id = editor.sessionStateId
    if (!native || !id) throw new Error('Missing editor identity')
    this.editors.set(id, editor)
    registerManagedOwner(native.webContents, this, id)
    const ownerId = native.webContents.id
    native.webContents.once('destroyed', () => documentWrites.clearOwner(ownerId))
  }

  async bindEditor(editor: EditorWindow, prepared: PreparedSessionWindow): Promise<void> {
    const id = prepared.snapshot.id
    const native = editor.browserWindow
    if (!native) throw new Error('Missing native window')
    if (!this.attached.has(id)) await this.attachPrepared(prepared)
    if (prepared.restoreGeometry)
      applyWindowGeometry(native, prepared.snapshot.geometry, displays(), primary())
    editor.projectRoots.restore(
      prepared.snapshot.workspace?.roots.map((root) => ({
        pathname: root.location.path,
        collapsedPaths: []
      })) ?? []
    )
    for (const document of prepared.snapshot.documents) {
      if (document.resource.kind === 'file' && !document.resource.pendingCreation)
        editor.addToOpenedFiles(document.resource.location.path)
    }
    const updateGeometry = (): void => {
      if (native.isDestroyed() || !this.owner().getWindow(id)) return
      const geometry = captureWindowGeometry(native, displays(), primary())
      void this.owner()
        .commitState((state) => ({
          ...state,
          session: {
            ...state.session,
            windows: state.session.windows.map((window) =>
              window.id === id ? { ...window, geometry } : window
            )
          }
        }))
        .catch((error) => this.report(error, id))
    }
    const scheduleGeometry = debounce(updateGeometry, 200)
    this.geometryWriters.set(id, scheduleGeometry)
    native.on('move', scheduleGeometry)
    native.on('resize', scheduleGeometry)
    native.on('maximize', scheduleGeometry)
    native.on('unmaximize', scheduleGeometry)
    native.on('focus', () => {
      if (!this.owner().getWindow(id)) return
      void this.owner()
        .commitState((state) => ({
          ...state,
          session: {
            ...state.session,
            activeWindowId: id,
            windows: state.session.windows.map((window) =>
              window.id === id ? { ...window, lastActivatedAtMs: Date.now() } : window
            )
          }
        }))
        .catch((error) => this.report(error, id))
    })
    updateGeometry()
    const result = await this.owner().flush(id, this.contexts.get(id)!.contextToken)
    if (result.status !== 'persisted')
      log.warn('Window initialized with unavailable recovery storage', id)
  }

  async initialization(editor: EditorWindow): Promise<WindowInitialization> {
    await editor.sessionReady
    const id = editor.sessionStateId
    if (!id) throw new Error('Unmanaged window')
    const initialized = await this.owner().initializeRenderer(id)
    this.rendererUnavailable.delete(id)
    this.rendererReady.delete(id)
    this.contexts.set(id, initialized.context)
    const result = await this.owner().flush(id, initialized.context.contextToken)
    return {
      ...initialized,
      preferences: this.accessor.preferences.getAll(),
      projectRoots: editor.projectRoots.snapshot(),
      documentStatuses: this.statuses.get(id),
      persistenceAvailable: result.status === 'persisted'
    }
  }

  private contextMatches(windowId: string, token: string): boolean {
    return !!this.owner().getWindow(windowId) && this.contexts.get(windowId)?.contextToken === token
  }

  private native(windowId: string): BrowserWindow {
    const window = this.editors.get(windowId)?.browserWindow
    if (!window || window.isDestroyed()) throw new Error('Window unavailable')
    return window
  }

  openFile(
    editor: EditorWindow,
    pathname: string,
    options: FileOpenOptions,
    selected: boolean
  ): Promise<void> {
    const id = editor.sessionStateId
    if (!id) return Promise.resolve()
    if (typeof options.requestId === 'number') this.previewRequests.set(id, options.requestId)
    const result = (this.fileQueues.get(id) ?? Promise.resolve())
      .catch(() => {})
      .then(async() => {
        await editor.sessionReady
        const obsolete = () =>
          options.preview &&
          typeof options.requestId === 'number' &&
          this.previewRequests.get(id) !== options.requestId
        if (obsolete()) return
        await this.requestCheckpoint(id)
        if (obsolete()) return
        const location = createFileLocation(pathname)
        const existing = this.owner()
          .getWindow(id)
          ?.documents.find(
            (document) =>
              document.resource.kind === 'file' && document.resource.location.key === location.key
          )
        if (existing) {
          this.native(id).webContents.send('mt::switch-tab-by-file_path', pathname, options)
          return
        }
        const loaded = await this.readDocument(pathname, options)
        if (obsolete()) return
        const snapshot = this.owner().getWindow(id)!
        const preview = options.preview && this.accessor.preferences.getAll().openFilesInPreviewMode
        const retire = snapshot.documents.filter(
          (document) =>
            (preview &&
              this.previews.get(id) === document.id &&
              document.content.kind === 'disk') ||
            (selected &&
              document.id === snapshot.activeDocumentId &&
              document.resource.kind === 'untitled' &&
              document.content.kind === 'empty')
        )
        for (const document of retire) await this.endDocument(id, document.id, false)
        const result = await this.owner().addDocument(id, loaded.document, loaded.content.markdown)
        if (result.status !== 'persisted')
          this.report(new Error('Recovery storage unavailable'), id)
        if (preview) this.previews.set(id, loaded.document.id)
        if (loaded.document.resource.kind === 'file' && !loaded.document.resource.pendingCreation)
          editor.addToOpenedFiles(pathname)
        this.accessor.menu.addRecentlyUsedDocument(pathname)
        const payload: ManagedDocumentPayload = {
          document: loaded.document,
          markdown: loaded.content.markdown,
          contentRevision: 0,
          selected,
          options
        }
        this.native(id).webContents.send('mt::state::document-opened', payload)
      })
    this.fileQueues.set(id, result)
    return result
  }

  cancelPreview(windowId: string, requestId: number): void {
    if (this.previewRequests.get(windowId) === requestId) this.previewRequests.delete(windowId)
  }

  async newDocument(
    windowId: string,
    title: string,
    markdown = '',
    selected = true
  ): Promise<DocumentSnapshot> {
    const snapshot = this.owner().getWindow(windowId)
    if (!snapshot) throw new Error('Unknown window')
    const document = this.blankDocument(
      markdown,
      title || `Untitled-${snapshot.documents.length + 1}`
    )
    const result = await this.owner().addDocument(windowId, document, markdown)
    if (result.status !== 'persisted')
      this.report(new Error('Recovery storage unavailable'), windowId)
    this.native(windowId).webContents.send('mt::state::document-opened', {
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
    await this.requestCheckpoint(id)
    editor.projectRoots.add(pathname, replace)
    const workspace = createWorkspaceDescriptor(
      editor.projectRoots.roots.map((root) => root.pathname)
    )
    if (!workspace) throw new Error('Missing workspace roots')
    await this.owner().commitState((state) => ({
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
                  workspace.roots.some((root) => root.id === view.rootId)
                )
              }
            }
            : window
        )
      }
    }))
    const initialized = await this.initialization(editor)
    this.native(id).webContents.send('mt::state::context-changed', initialized)
  }

  requestCheckpoint(windowId: string, transactionId = createStateId()): Promise<WindowSnapshot> {
    const result = (this.checkpointQueues.get(windowId) ?? Promise.resolve())
      .catch(() => {})
      .then(() => this.checkpointNow(windowId, transactionId))
    this.checkpointQueues.set(windowId, result)
    return result
  }

  private async checkpointNow(windowId: string, transactionId: string): Promise<WindowSnapshot> {
    this.geometryWriters.get(windowId)?.flush()
    if (!this.rendererReady.has(windowId) || this.rendererUnavailable.has(windowId)) {
      const context = this.contexts.get(windowId)
      if (!context) throw new Error('Missing renderer context')
      const result = await this.owner().flush(windowId, context.contextToken)
      const snapshot = this.owner().getWindow(windowId)
      if (result.status !== 'persisted' || !snapshot)
        throw new Error('Initial checkpoint unavailable')
      return snapshot
    }
    const existing = this.waiting.get(windowId)
    if (existing) throw new Error('Another window checkpoint is pending')
    await this.owner().beginCloseCheckpoint(windowId, transactionId)
    const context = this.contexts.get(windowId)
    if (!context) throw new Error('Missing renderer context')
    return new Promise<WindowSnapshot>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.waiting.delete(windowId)
        void this.owner().cancelCloseCheckpoint(windowId, transactionId)
        reject(new Error('The editor did not finish its recovery checkpoint'))
      }, 10000)
      this.waiting.set(windowId, { transactionId, resolve, reject, timeout })
      this.native(windowId).webContents.send('mt::state::prepare-close', {
        contextToken: context.contextToken,
        transactionId
      })
    })
  }

  async closeWindow(editor: EditorWindow): Promise<void> {
    await editor.sessionReady
    if (editor.sessionStateId) await this.coordinator.closeWindow(editor.sessionStateId)
    if (this.editors.size === 0 && process.platform !== 'darwin') app.quit()
  }

  rendererGone(editor: EditorWindow): void {
    const id = editor.sessionStateId
    if (!id) return
    this.rendererUnavailable.add(id)
    this.rendererReady.delete(id)
    const pending = this.waiting.get(id)
    if (pending) {
      clearTimeout(pending.timeout)
      this.waiting.delete(id)
      pending.reject(new Error('The renderer stopped before completing its checkpoint'))
    }
  }

  private async choose(snapshot: WindowSnapshot): Promise<'save' | 'discard' | 'cancel'> {
    const documents = snapshot.documents.filter((document) => document.content.kind === 'recovery')
    const { response } = await dialog.showMessageBox(this.native(snapshot.id), {
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
      message: t('dialog.saveChanges', {
        count: documents.length,
        type: t(documents.length === 1 ? 'dialog.file' : 'dialog.files'),
        files: documents.map((document) => document.title).join('\n')
      }),
      detail: t('dialog.changesWillBeLost')
    })
    if (response === 0) return 'save'
    if (response === 1) return 'discard'
    return 'cancel'
  }

  private async diskBaseline(pathname: string): Promise<DiskBaseline> {
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
    const document = this.owner()
      .getWindow(windowId)
      ?.documents.find((document) => document.id === documentId)
    if (!document || (document.readOnly && !allowReadOnly)) return { status: 'failed' }
    let savedMarkdown = ''
    let savedFormat = document.saveFormat
    const sender = this.native(windowId).webContents
    if (allowReadOnly && document.readOnly)
      await documentWrites.setReadOnly(sender.id, documentId, false)
    try {
      const result = await this.owner().saveDocument(windowId, documentId, async(capture) => {
        const epoch = documentWrites.capture(sender.id, documentId)
        if (epoch === null) throw new Error('Document is read-only')
        const native = this.native(windowId)
        const resource = capture.snapshot.resource
        let destination = resource.kind === 'file' ? resource.location.path : ''
        if (saveAs || !destination) {
          const choice = await dialog.showSaveDialog(native, {
            defaultPath:
              destination || path.join(app.getPath('documents'), `${capture.snapshot.title}.md`)
          })
          if (choice.canceled || !choice.filePath) return null
          destination = choice.filePath
        } else {
          const current = await this.diskBaseline(destination)
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
        if (!path.extname(destination)) destination += '.md'
        const written = await documentWrites.write(sender.id, documentId, epoch, async() => {
          await writeMarkdownFile(destination, capture.markdown, capture.snapshot.saveFormat)
          return true
        })
        if (!written) throw new Error('Document became read-only before the save completed')
        savedMarkdown = capture.markdown
        savedFormat = capture.snapshot.saveFormat
        const baseline = await this.diskBaseline(destination)
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
        return { status: 'failed' }
      }
      const saved = this.owner().getDocument(documentId)
      this.statuses.set(
        windowId,
        (this.statuses.get(windowId) ?? []).filter((status) => status.documentId !== documentId)
      )
      if (saved.resource.kind === 'file') {
        this.editors.get(windowId)?.addToOpenedFiles(saved.resource.location.path)
        this.accessor.menu.addRecentlyUsedDocument(saved.resource.location.path)
        ipcMain.emit('window-file-saved', this.native(windowId).id, saved.resource.location.path)
      }
      const response: Extract<ManagedSaveResult, { status: 'saved' }> = {
        status: 'saved',
        document: saved,
        savedMarkdown,
        savedFormat,
        metadataRevision: this.owner().getState().revision
      }
      this.native(windowId).webContents.send('mt::state::document-saved', response)
      return response
    } catch (error) {
      this.report(error, windowId)
      return { status: 'failed' }
    } finally {
      if (allowReadOnly && document.readOnly) {
        const current = this.owner()
          .getWindow(windowId)
          ?.documents.find((document) => document.id === documentId)
        if (current?.readOnly) await documentWrites.setReadOnly(sender.id, documentId, true)
      }
    }
  }

  async renameDocument(windowId: string, documentId: string, destination: string): Promise<void> {
    await this.requestCheckpoint(windowId)
    const document = this.owner()
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
    const existing = await this.diskBaseline(target)
    if (existing.exists) {
      const choice = await dialog.showMessageBox(this.native(windowId), {
        type: 'warning',
        buttons: [t('dialog.replace'), t('dialog.cancel')],
        defaultId: 1,
        cancelId: 1,
        message: t('dialog.fileExists', { filename: target })
      })
      if (choice.response !== 0) return
    }
    await rename(source, target)
    const result = await this.owner().relocateDocument(
      windowId,
      documentId,
      createFileLocation(target),
      path.basename(target)
    )
    this.editors.get(windowId)?.changeOpenedFilePath(target, source)
    this.accessor.menu.addRecentlyUsedDocument(target)
    this.native(windowId).webContents.send(
      'mt::state::document-relocated',
      this.owner().getDocument(documentId),
      this.owner().getState().revision
    )
    if (result.status !== 'persisted')
      this.report(new Error('Recovery metadata unavailable after rename'), windowId)
  }

  async moveDocument(windowId: string, documentId: string): Promise<void> {
    const document = this.owner()
      .getWindow(windowId)
      ?.documents.find((document) => document.id === documentId)
    if (!document || document.resource.kind !== 'file') return
    const result = await dialog.showSaveDialog(this.native(windowId), {
      buttonLabel: 'Move to',
      defaultPath: document.resource.location.path
    })
    if (!result.canceled && result.filePath)
      await this.renameDocument(windowId, documentId, result.filePath)
  }

  private async endDocument(windowId: string, id: string, discard: boolean): Promise<void> {
    const document = this.owner()
      .getWindow(windowId)
      ?.documents.find((document) => document.id === id)
    const result = await this.owner().endDocument(windowId, id, discard)
    if (result.status !== 'persisted') throw new Error('Document end was not committed')
    this.statuses.set(
      windowId,
      (this.statuses.get(windowId) ?? []).filter((status) => status.documentId !== id)
    )
    if (document?.resource.kind === 'file')
      this.editors.get(windowId)?.removeFromOpenedFiles(document.resource.location.path)
    this.native(windowId).webContents.send('mt::state::documents-ended', [id])
  }

  async observeFile(
    windowId: string,
    payload: {
      type: string
      change: { pathname: string; data?: Awaited<ReturnType<typeof loadMarkdownFile>> }
    }
  ): Promise<void> {
    const document = this.owner()
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
      const statuses = (this.statuses.get(windowId) ?? []).filter(
        (status) => status.documentId !== document.id
      )
      this.statuses.set(windowId, [
        ...statuses,
        { documentId: document.id, diskMissing: true, diskConflict: false }
      ])
      const result = await this.owner().observeDisk(windowId, document.id, null)
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
      const result = await this.owner().observeDisk(windowId, document.id, saved, raw.markdown)
      if (result.status !== 'persisted')
        this.report(new Error('External file state was not persisted'), windowId)
    }
  }

  private async closeDocuments(
    windowId: string,
    ids: string[]
  ): Promise<{ status: 'closed' | 'canceled' | 'failed' }> {
    if (this.tabClosePending) return { status: 'canceled' }
    this.tabClosePending = true
    try {
      const initial = await this.requestCheckpoint(windowId)
      const selected = initial.documents.filter((document) => ids.includes(document.id))
      if (selected.length !== new Set(ids).size) return { status: 'failed' }
      const snapshot = { ...initial, documents: selected }
      const dirty = selected.filter((document) => document.content.kind === 'recovery')
      const choice = dirty.length ? await this.choose(snapshot) : 'discard'
      if (choice === 'cancel') return { status: 'canceled' }
      if (choice === 'save') {
        for (const document of dirty) {
          const result = await this.saveDocument(windowId, document.id, false, true)
          if (result.status !== 'saved')
            return { status: result.status === 'canceled' ? 'canceled' : 'failed' }
        }
      }
      const latest = await this.requestCheckpoint(windowId)
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
      for (const id of ids) await this.endDocument(windowId, id, choice === 'discard')
      return { status: 'closed' }
    } catch (error) {
      this.report(error, windowId)
      return { status: 'failed' }
    } finally {
      this.tabClosePending = false
    }
  }

  report(error: unknown, windowId?: string): void {
    log.error('Session recovery operation failed', error)
    const native = windowId
      ? this.editors.get(windowId)?.browserWindow
      : [...this.editors.values()][0]?.browserWindow
    if (native && !native.isDestroyed())
      native.webContents.send('mt::show-notification', {
        title: t('sideBar.tree.sessionSaveFailed'),
        type: 'error',
        message: 'Keep this window open and save your documents before quitting.'
      })
  }

  private registerIpc(): void {
    const editorFor = (sender: WebContents): EditorWindow => {
      const owner = getManagedOwner(sender)
      const editor = owner?.host === this ? this.editors.get(owner.windowId) : undefined
      if (!editor) throw new Error('Unrecognized editor window')
      return editor
    }
    ipcMain.on('mt::window-initialized', (event) => {
      const owner = getManagedOwner(event.sender)
      if (owner?.host === this) this.rendererReady.add(owner.windowId)
    })
    ipcMain.handle('mt::state::get-window-initialization', (event) =>
      this.initialization(editorFor(event.sender))
    )
    ipcMain.handle('mt::preferences::get', () => this.accessor.preferences.getAll())
    ipcMain.handle('mt::preferences::update', (_event, patch) => {
      const result = this.accessor.preferences.update(patch)
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
        if (!this.contextMatches(id, request.contextToken))
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
        const result = await this.owner().checkpoint(id, request)
        if (result.status === 'persisted') {
          if (
            request.previewDocumentId &&
            this.owner()
              .getWindow(id)
              ?.documents.some((document) => document.id === request.previewDocumentId)
          )
            this.previews.set(id, request.previewDocumentId)
          else this.previews.delete(id)
        }
        const pending = this.waiting.get(id)
        if (pending && request?.closeTransactionId === pending.transactionId) {
          clearTimeout(pending.timeout)
          this.waiting.delete(id)
          await this.owner().cancelCloseCheckpoint(id, pending.transactionId)
          const snapshot = this.owner().getWindow(id)
          if (result.status === 'persisted' && snapshot) pending.resolve(snapshot)
          else pending.reject(new Error('Final checkpoint was not persisted'))
        }
        return result
      }
    )
    ipcMain.handle('mt::state::flush', (event, token: string) =>
      this.owner().flush(editorFor(event.sender).sessionStateId!, token)
    )
    ipcMain.handle(
      'mt::state::save-document',
      async(event, token: string, id: string, saveAs: boolean) => {
        const editor = editorFor(event.sender)
        if (!this.contextMatches(editor.sessionStateId!, token)) return { status: 'failed' }
        return this.saveDocument(editor.sessionStateId!, id, saveAs)
      }
    )
    ipcMain.handle('mt::state::close-documents', (event, token: string, ids: string[]) => {
      const editor = editorFor(event.sender)
      if (
        !this.contextMatches(editor.sessionStateId!, token) ||
        !Array.isArray(ids) ||
        ids.some((id) => typeof id !== 'string')
      )
        return { status: 'failed' }
      return this.closeDocuments(editor.sessionStateId!, ids)
    })
  }
}
