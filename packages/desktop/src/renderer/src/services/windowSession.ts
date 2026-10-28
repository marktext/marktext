import { requestWindowCheckpoint } from '@/store/checkpoint'
import { nextTick, watch, type WatchStopHandle } from 'vue'
import debounce from 'lodash/debounce'
import type {
  DocumentSnapshot,
  ManagedDocumentPayload,
  ManagedSaveResult,
  PersistResult,
  RuntimeWindowContext,
  WindowCheckpointRequest,
  WindowInitialization
} from '@shared/types/applicationState'
import type { IFileState } from '@shared/types/files'
import type { SaveDocumentResult } from '@shared/types/ipc'
import { setSessionActions, useEditorStore } from '@/store/editor'
import { useLayoutStore } from '@/store/layout'
import { usePreferencesStore } from '@/store/preferences'
import { useProjectStore } from '@/store/project'
import { useMainStore } from '@/store'
import { createDocumentState, getOptionsFromState } from '@/store/help'
import { deepClone } from '@/util'
import {
  captureDocumentView,
  restoreDocumentView,
  isDocumentViewReady,
  onDocumentViewChange
} from './documentViewState'
import notice from './notification'
import bus from '../bus'
import { t } from '@/i18n'

/** Last locally captured content and its revision, retained until native persistence acknowledges it. */
interface ObservedContent {
  markdown: string
  format: string
  revision: number
  pending: boolean
}

class WindowSession {
  private readonly _editor = useEditorStore()
  private readonly _layout = useLayoutStore()
  private readonly _preferences = usePreferencesStore()
  private readonly _project = useProjectStore()
  private readonly _main = useMainStore()
  private _context: RuntimeWindowContext | null = null
  private _workspace: WindowInitialization['snapshot']['workspace'] = null
  private _sequence = 0
  private _initializing = true
  private _interactionEpoch = 0
  private _deferredSelection: string | null = null
  private _queue: Promise<unknown> = Promise.resolve()
  private readonly _observed = new Map<string, ObservedContent>()
  // Late save/checkpoint replies must not undo newer native resource updates.
  private readonly _serverRevision = new Map<string, number>()
  private readonly _stops: Array<WatchStopHandle | (() => void)> = []
  private _pendingRestoreId: string | null = null
  private readonly _pendingOpens: ManagedDocumentPayload[] = []
  private readonly _schedule = debounce(() => {
    void this._flush().catch((error) => this._failure(error))
  }, 250)

  async start(): Promise<void> {
    const ipc = window.electron.ipcRenderer
    const interacted = (): void => {
      this._interactionEpoch++
    }
    for (const name of ['pointerdown', 'keydown', 'beforeinput']) {
      document.addEventListener(name, interacted, true)
      this._stops.push(() => document.removeEventListener(name, interacted, true))
    }
    const finishRename = (): void => {
      void nextTick().then(() => {
        if (this._project.renameCache) return
        const file = this._editor.tabs.find((file) => file.id === this._deferredSelection)
        this._deferredSelection = null
        if (file && this._project.activeItem?.pathname === file.pathname) {
          this._editor.SET_OPEN_INTENT(file.pathname, false, file.isPreview)
          this._editor.UPDATE_CURRENT_FILE(file)
          void nextTick().then(() => {
            this._editor.DISCARD_OPEN_INTENT(file.pathname)
            if (!document.activeElement?.closest('.editor-component'))
              bus.emit('SIDEBAR::focus-tree')
          })
        }
      })
    }
    this._stops.push(watch(() => this._project.renameCache, (pathname) => {
      if (!pathname) finishRename()
    }))
    this._stops.push(
      ipc.on('mt::state::document-opened', (_event, payload) => this._openDocument(payload))
    )
    this._stops.push(
      ipc.on('mt::state::documents-ended', (_event, ids) => {
        for (const id of ids) {
          const file = this._editor.tabs.find((file) => file.id === id)
          if (file) this._editor.FORCE_CLOSE_TAB(file)
          this._observed.delete(id)
        }
      })
    )
    this._stops.push(ipc.on('mt::state::document-saved', (_event, result) => this._saved(result)))
    this._stops.push(ipc.on('mt::tab-save-failure', (_event, id, message) => {
      this._editor.pushTabNotification({
        tabId: id,
        msg: t('store.editor.errorWhileSaving', { msg: message }),
        style: 'crit'
      })
    }))
    this._stops.push(
      ipc.on('mt::state::document-relocated', (_event, document, revision) => {
        const file = this._editor.tabs.find((file) => file.id === document.id)
        if (!file || (this._serverRevision.get(document.id) ?? -1) > revision) return
        this._serverRevision.set(document.id, revision)
        this._applyResource(file, document)
      })
    )
    this._stops.push(
      ipc.on('mt::state::context-changed', (_event, initialized) => {
        void this._applyInitialization(initialized, true).catch((error) => this._failure(error))
      })
    )
    this._stops.push(
      ipc.on('mt::state::prepare-close', (_event, request) => {
        if (request.contextToken !== this._context?.contextToken) return
        void requestWindowCheckpoint(request.transactionId).catch((error) => this._failure(error))
      })
    )
    setSessionActions({
      checkpoint: transactionId => this._flush(transactionId),
      scheduleCheckpoint: () => { this._schedule() },
      captureView: () => {
        void this._captureActiveView().catch((error) => this._failure(error))
      },
      save: (id, saveAs = false) => this._save(id, saveAs),
      create: async(markdown, selected) => {
        if (!this._context) return
        const result = await ipc.invoke('mt::state::register-untitled', {
          contextToken: this._context.contextToken,
          title: '',
          markdown,
          selected
        })
        if (result.status !== 'registered') throw new Error('New document was not registered')
      },
      close: (ids) => this._close(ids),
      saveAll: async(closeTabs) => {
        if (closeTabs) await this._close(this._editor.tabs.map((file) => file.id))
        else
          for (const file of this._editor.tabs.filter((file) => !file.readOnly && !file.isSaved))
            await this._save(file.id)
      }
    })
    onDocumentViewChange(() => {
      if (!this._initializing) {
        void this._restoreActiveView().catch((error) => this._failure(error))
        this._schedule()
      }
    })
    const initialized = await ipc.invoke('mt::state::get-window-initialization')
    await this._applyInitialization(initialized)
    for (const payload of this._pendingOpens.splice(0)) this._openDocument(payload)
    this._stops.push(
      watch(
        () =>
          this._editor.tabs.map((file) => [
            file.id,
            file.markdown,
            JSON.stringify(getOptionsFromState(file)),
            file.readOnly
          ]),
        () => this._schedule()
      )
    )
    this._stops.push(
      watch(
        () => this._editor.currentFile?.id,
        () => {
          if (!this._initializing) this._project.restoringSession = false
          this._pendingRestoreId = this._editor.currentFile?.id ?? null
          void nextTick()
            .then(() => this._restoreActiveView())
            .catch((error) => this._failure(error))
          this._schedule()
        },
        { flush: 'post' }
      )
    )
    await this._flush()
  }

  private _file(payload: ManagedDocumentPayload): IFileState {
    const { document, markdown } = payload
    const file = createDocumentState(
      {
        filename: document.title,
        pathname: document.resource.kind === 'file' ? document.resource.location.path : '',
        markdown,
        readOnly: document.readOnly,
        isPendingCreation: document.resource.kind === 'file' && document.resource.pendingCreation,
        isSaved: document.content.kind !== 'recovery',
        ...document.saveFormat,
        cursor: deepClone(document.view?.muyaSelection ?? null),
        muyaIndexCursor: deepClone(document.view?.sourceSelection ?? null),
        scrollTop: document.view?.renderedScrollTopPx ?? 0
      },
      document.id
    )
    file.viewState = deepClone(document.view)
    file.tocCollapsedKeys = [...(document.view?.collapsedOutlineKeys ?? [])]
    this._observed.set(document.id, {
      markdown,
      format: JSON.stringify(getOptionsFromState(file)),
      revision: payload.contentRevision,
      pending: false
    })
    return file
  }

  private async _applyInitialization(
    initialized: WindowInitialization,
    preserve = false
  ): Promise<void> {
    this._initializing = true
    this._schedule.cancel()
    this._workspace = initialized.snapshot.workspace
    this._context = initialized.context
    this._sequence = 0
    this._preferences.SET_USER_PREFERENCE({ ...initialized.preferences })
    // Preference watchers can rebuild Muya blocks; load the document after those updates.
    await nextTick()
    if (preserve) {
      const restoring = this._project.restoringSession
      if (initialized.projectRoots) this._project.APPLY_ROOTS(initialized.projectRoots)
      this._project.restoringSession = restoring
      this._initializing = false
      window.electron.ipcRenderer.send('mt::window-initialized')
      window.electron.ipcRenderer.send('mt::project-renderer-ready')
      for (const payload of this._pendingOpens.splice(0)) this._openDocument(payload)
      this._schedule()
      return
    }
    const files = initialized.snapshot.documents.flatMap((document) => {
      const body = initialized.documentContents.find((body) => body.documentId === document.id)
      if (!body) return []
      const file = this._file({
        document,
        markdown: body.markdown,
        contentRevision: body.contentRevision,
        selected: false
      })
      const status = initialized.documentStatuses?.find(
        (status) => status.documentId === document.id
      )
      if (status) {
        file.diskMissing = status.diskMissing
        file.diskConflict = status.diskConflict
      }
      return [file]
    })
    this._layout.INITIALIZE_WINDOW_LAYOUT(initialized.snapshot.layout, () => this._schedule())
    if (initialized.projectRoots) this._project.APPLY_ROOTS(initialized.projectRoots)
    this._project.RESTORE_PROJECT_VIEW(
      initialized.snapshot.workspace,
      initialized.snapshot.projectView
    )
    const activeId = initialized.snapshot.activeDocumentId
    this._editor.$patch((state) => {
      state.tabs = files
      state.currentFile = null
      state.tabIdToIndex = {}
      state.listToc = []
      state.toc = []
    })
    this._editor.updateTabIdToIndex()
    const active = files.find((file) => file.id === activeId) ?? files[0]
    if (active) this._editor.UPDATE_CURRENT_FILE(active)
    this._main.SET_INITIALIZED()
    window.electron.ipcRenderer.send('mt::window-initialized')
    window.electron.ipcRenderer.send('mt::project-renderer-ready')
    this._layout.DISPATCH_LAYOUT_MENU_ITEMS()
    this._preferences.DISPATCH_EDITOR_VIEW_STATE({
      sourceCode: this._preferences.sourceCode,
      focus: this._preferences.focus,
      typewriter: this._preferences.typewriter
    })
    this._initializing = false
    this._pendingRestoreId = active?.id ?? null
    await nextTick()
    await this._restoreActiveView()
    if (initialized.startupWarning)
      notice.notify({
        title: t('sideBar.tree.unavailableFolder'),
        type: 'warning',
        message: initialized.startupWarning
      })
    if (initialized.persistenceAvailable === false)
      this._failure(new Error('Recovery storage unavailable'))
    this._schedule()
  }

  private _openDocument(payload: ManagedDocumentPayload): void {
    if (this._initializing) {
      this._pendingOpens.push(payload)
      return
    }
    if (this._editor.tabs.some((file) => file.id === payload.document.id)) return
    const renaming = !!this._project.renameCache
    const nameInput = document.activeElement instanceof HTMLInputElement &&
      document.activeElement.matches('input.rename') ? document.activeElement : null
    const selection = nameInput ? [nameInput.selectionStart, nameInput.selectionEnd] as const : null
    for (const id of payload.replacedDocumentIds ?? []) {
      const replaced = this._editor.tabs.find((file) => file.id === id)
      if (replaced) this._editor.FORCE_CLOSE_TAB(replaced)
      this._observed.delete(id)
    }
    const file = this._file(payload)
    const options = payload.options ?? {}
    const intent = this._editor.PEEK_OPEN_INTENT(file.pathname)
    file.isPreview =
      (intent?.preview ?? options.preview ?? false) && this._preferences.openFilesInPreviewMode
    if (typeof options.requestId === 'number')
      this._editor.SETTLE_SIDEBAR_OPEN(options.requestId, file.pathname)
    if (payload.selected && !renaming)
      this._editor.UPDATE_CURRENT_FILE(file)
    else {
      if (payload.selected) this._deferredSelection = file.id
      this._editor.tabs.push(file)
      this._editor.updateTabIdToIndex()
    }
    const focus = this._editor.TAKE_OPEN_INTENT(file.pathname)
    if (focus === true && !renaming) bus.emit('editor-focus')
    else if (focus === false && !renaming)
      bus.emit('SIDEBAR::focus-tree')
    // Retiring the previous preview can synchronously restore its editor caret.
    if (nameInput?.isConnected && selection) {
      nameInput.focus({ preventScroll: true })
      nameInput.setSelectionRange(selection[0], selection[1])
    }
    if (options.anchor) this._editor.SCROLL_TO_ANCHOR(options.anchor)
    this._schedule()
  }

  private async _captureActiveView(): Promise<void> {
    const file = this._editor.currentFile
    if (!file || this._pendingRestoreId === file.id || !isDocumentViewReady(file.id, file.markdown))
      return
    const markdown = file.markdown
    const view = await captureDocumentView(
      file.id,
      markdown,
      file.tocCollapsedKeys ?? [],
      file.viewState ?? null
    )
    if (this._editor.tabs.some((current) => current.id === file.id) && file.markdown === markdown)
      file.viewState = view
  }

  private async _restoreActiveView(): Promise<void> {
    const file = this._editor.currentFile
    if (!file || this._pendingRestoreId !== file.id || !isDocumentViewReady(file.id, file.markdown))
      return
    const id = file.id
    const markdown = file.markdown
    const epoch = this._interactionEpoch
    this._pendingRestoreId = null
    const keys = await restoreDocumentView(
      id,
      markdown,
      file.viewState ?? null,
      () =>
        this._editor.currentFile?.id === id &&
        this._editor.currentFile.markdown === markdown &&
        this._interactionEpoch === epoch,
      true
    )
    if (this._editor.currentFile?.id === id && file.markdown === markdown)
      file.tocCollapsedKeys = keys
  }

  private _flush(transactionId: string | null = null): Promise<PersistResult> {
    this._schedule.cancel()
    const result = this._queue.catch(() => {}).then(() => this._checkpoint(transactionId))
    this._queue = result
    return result
  }

  private async _checkpoint(transactionId: string | null): Promise<PersistResult> {
    if (this._initializing || !this._context) return { status: 'failed', reason: 'stale-context' }
    this._editor.flushActiveEditor()
    await this._captureActiveView()
    const contents: WindowCheckpointRequest['dirtyContents'] = []
    const captured = new Map<string, { markdown: string; format: string; revision: number }>()
    const documents = this._editor.tabs.map((file) => {
      const saveFormat = getOptionsFromState(file)
      const formatKey = JSON.stringify(saveFormat)
      const observed = this._observed.get(file.id)
      if (!observed) throw new Error('Unknown document identity')
      if (file.markdown !== observed.markdown || formatKey !== observed.format) {
        observed.revision++
        observed.markdown = file.markdown
        observed.format = formatKey
        observed.pending = true
      }
      if (observed.pending)
        contents.push({
          documentId: file.id,
          contentRevision: observed.revision,
          markdown: file.markdown
        })
      captured.set(file.id, {
        markdown: file.markdown,
        format: formatKey,
        revision: observed.revision
      })
      return {
        id: file.id,
        acceptedDiskSha256: file.acceptedDiskSha256,
        content: { kind: 'recovery' as const, contentRevision: observed.revision },
        saveFormat,
        readOnly: file.readOnly,
        view: deepClone(file.viewState ?? null)
      }
    })
    const request: WindowCheckpointRequest = {
      contextToken: this._context.contextToken,
      sequence: ++this._sequence,
      closeTransactionId: transactionId,
      layout: this._layout.CAPTURE_WINDOW_LAYOUT(),
      projectView: this._project.CAPTURE_PROJECT_VIEW(
        this._workspace
      ),
      documents,
      activeDocumentId: this._editor.currentFile?.id ?? null,
      dirtyContents: contents,
      previewDocumentId: this._editor.tabs.find((file) => file.isPreview)?.id ?? null
    }
    const result = await window.electron.ipcRenderer.invoke('mt::state::checkpoint', request)
    if (result.status !== 'persisted') {
      const sameDocuments =
        documents.length === this._editor.tabs.length &&
        documents.every((document) => this._editor.tabs.some((file) => file.id === document.id))
      if (
        sameDocuments &&
        (result.reason !== 'stale-context' || request.contextToken === this._context.contextToken)
      )
        this._failure(new Error(result.reason))
      return result
    }
    for (const document of result.receipt.documents ?? []) {
      const file = this._editor.tabs.find((file) => file.id === document.id)
      const sent = captured.get(document.id)
      const observed = this._observed.get(document.id)
      if (!file || !sent || !observed) continue
      if (observed.revision === sent.revision) observed.pending = false
      if ((this._serverRevision.get(document.id) ?? -1) > result.receipt.metadataRevision) continue
      this._serverRevision.set(document.id, result.receipt.metadataRevision)
      this._applyResource(file, document)
      if (file.markdown === sent.markdown && JSON.stringify(getOptionsFromState(file)) === sent.format) {
        file.isSaved = document.content.kind !== 'recovery'
      }
    }
    return result
  }

  private _applyResource(file: IFileState, document: DocumentSnapshot): void {
    file.pathname = document.resource.kind === 'file' ? document.resource.location.path : ''
    file.filename = document.title
    file.isPendingCreation = document.resource.kind === 'file' && document.resource.pendingCreation
    if (this._editor.currentFile?.id === file.id)
      window.DIRNAME = file.pathname ? window.path.dirname(file.pathname) : ''
  }

  private _saved(result: Extract<ManagedSaveResult, { status: 'saved' }>): void {
    const file = this._editor.tabs.find((file) => file.id === result.document.id)
    if (!file || result.document.resource.kind !== 'file') return
    if ((this._serverRevision.get(file.id) ?? -1) > result.metadataRevision) return
    this._serverRevision.set(file.id, result.metadataRevision)
    file.pathname = result.document.resource.location.path
    file.filename = result.document.title
    file.isPendingCreation = false
    file.diskConflict = false
    file.diskMissing = false
    const baseline = { markdown: result.savedMarkdown, format: JSON.stringify(result.savedFormat) }
    file.isSaved =
      file.markdown === baseline.markdown && JSON.stringify(getOptionsFromState(file)) === baseline.format
    if (this._editor.currentFile?.id === file.id) window.DIRNAME = window.path.dirname(file.pathname)
    this._schedule()
  }

  private async _save(id: string, saveAs = false): Promise<SaveDocumentResult> {
    const checkpoint = await this._flush()
    if (
      !this._context ||
      (checkpoint.status !== 'persisted' && checkpoint.reason !== 'storage-unavailable')
    )
      return { status: 'failed' }
    const result = await window.electron.ipcRenderer.invoke(
      'mt::state::save-document',
      this._context.contextToken,
      id,
      saveAs
    )
    if (result.status !== 'saved') return result
    this._saved(result)
    return {
      status: 'saved',
      pathname:
        result.document.resource.kind === 'file' ? result.document.resource.location.path : '',
      filename: result.document.title,
      savedMarkdown: result.savedMarkdown
    }
  }

  private async _close(ids: string[]): Promise<void> {
    if (!ids.length || !this._context) return
    const result = await window.electron.ipcRenderer.invoke(
      'mt::state::close-documents',
      this._context.contextToken,
      ids
    )
    if (result.status === 'closed' && this._editor.tabs.length === 0) {
      await window.electron.ipcRenderer.invoke('mt::state::register-untitled', {
        contextToken: this._context.contextToken,
        title: '',
        selected: true
      })
    }
  }

  private _failure(error: unknown): void {
    console.error('Recovery operation did not complete', error)
    void notice.notify({
      title: t('sideBar.tree.sessionSaveFailed'),
      type: 'error',
      showConfirm: false
    })
  }

  dispose(): void {
    this._schedule.cancel()
    for (const stop of this._stops) stop()
    setSessionActions(null)
    onDocumentViewChange(null)
  }
}

export const startWindowSession = async(): Promise<() => void> => {
  const session = new WindowSession()
  await session.start()
  return () => session.dispose()
}
