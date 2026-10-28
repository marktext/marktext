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

interface ObservedContent {
  markdown: string
  format: string
  revision: number
  pending: boolean
}

class WindowSession {
  private readonly editor = useEditorStore()
  private readonly layout = useLayoutStore()
  private readonly preferences = usePreferencesStore()
  private readonly project = useProjectStore()
  private readonly main = useMainStore()
  private context: RuntimeWindowContext | null = null
  private initialization: WindowInitialization | null = null
  private sequence = 0
  private initializing = true
  private interactionEpoch = 0
  private deferredSelection: string | null = null
  private queue: Promise<unknown> = Promise.resolve()
  private readonly observed = new Map<string, ObservedContent>()
  private readonly serverRevision = new Map<string, number>()
  private readonly stops: Array<WatchStopHandle | (() => void)> = []
  private pendingRestoreId: string | null = null
  private readonly pendingOpens: ManagedDocumentPayload[] = []
  private readonly schedule = debounce(() => {
    void this.flush().catch((error) => this.failure(error))
  }, 250)

  async start(): Promise<void> {
    const ipc = window.electron.ipcRenderer
    const interacted = (): void => {
      this.interactionEpoch++
    }
    for (const name of ['pointerdown', 'keydown', 'beforeinput']) {
      document.addEventListener(name, interacted, true)
      this.stops.push(() => document.removeEventListener(name, interacted, true))
    }
    const finishRename = (): void => {
      void nextTick().then(() => {
        if (this.project.renameCache) return
        const file = this.editor.tabs.find((file) => file.id === this.deferredSelection)
        this.deferredSelection = null
        if (file && this.project.activeItem?.pathname === file.pathname) {
          this.editor.SET_OPEN_INTENT(file.pathname, false, file.isPreview)
          this.editor.UPDATE_CURRENT_FILE(file)
          void nextTick().then(() => {
            this.editor.DISCARD_OPEN_INTENT(file.pathname)
            if (!document.activeElement?.closest('.editor-component'))
              bus.emit('SIDEBAR::focus-tree')
          })
        }
      })
    }
    this.stops.push(watch(() => this.project.renameCache, (pathname) => {
      if (!pathname) finishRename()
    }))
    this.stops.push(
      ipc.on('mt::state::document-opened', (_event, payload) => this.openDocument(payload))
    )
    this.stops.push(
      ipc.on('mt::state::documents-ended', (_event, ids) => {
        for (const id of ids) {
          const file = this.editor.tabs.find((file) => file.id === id)
          if (file) this.editor.FORCE_CLOSE_TAB(file)
          this.observed.delete(id)
        }
      })
    )
    this.stops.push(ipc.on('mt::state::document-saved', (_event, result) => this.saved(result)))
    this.stops.push(ipc.on('mt::tab-save-failure', (_event, id, message) => {
      this.editor.pushTabNotification({
        tabId: id,
        msg: t('store.editor.errorWhileSaving', { msg: message }),
        style: 'crit'
      })
    }))
    this.stops.push(
      ipc.on('mt::state::document-relocated', (_event, document, revision) => {
        const file = this.editor.tabs.find((file) => file.id === document.id)
        if (!file || (this.serverRevision.get(document.id) ?? -1) > revision) return
        this.serverRevision.set(document.id, revision)
        this.applyResource(file, document)
      })
    )
    this.stops.push(
      ipc.on('mt::state::context-changed', (_event, initialized) => {
        void this.applyInitialization(initialized, true).catch((error) => this.failure(error))
      })
    )
    this.stops.push(
      ipc.on('mt::state::prepare-close', (_event, request) => {
        if (request.contextToken !== this.context?.contextToken) return
        void requestWindowCheckpoint(request.transactionId).catch((error) => this.failure(error))
      })
    )
    setSessionActions({
      checkpoint: transactionId => this.flush(transactionId),
      scheduleCheckpoint: () => { this.schedule() },
      captureView: () => {
        void this.captureActiveView().catch((error) => this.failure(error))
      },
      save: (id, saveAs = false) => this.save(id, saveAs),
      create: async(markdown, selected) => {
        if (!this.context) return
        const result = await ipc.invoke('mt::state::register-untitled', {
          contextToken: this.context.contextToken,
          title: '',
          markdown,
          selected
        })
        if (result.status !== 'registered') throw new Error('New document was not registered')
      },
      close: (ids) => this.close(ids),
      saveAll: async(closeTabs) => {
        if (closeTabs) await this.close(this.editor.tabs.map((file) => file.id))
        else
          for (const file of this.editor.tabs.filter((file) => !file.readOnly && !file.isSaved))
            await this.save(file.id)
      }
    })
    onDocumentViewChange(() => {
      if (!this.initializing) {
        void this.restoreActiveView().catch((error) => this.failure(error))
        this.schedule()
      }
    })
    const initialized = await ipc.invoke('mt::state::get-window-initialization')
    await this.applyInitialization(initialized)
    for (const payload of this.pendingOpens.splice(0)) this.openDocument(payload)
    this.stops.push(
      watch(
        () =>
          this.editor.tabs.map((file) => [
            file.id,
            file.markdown,
            JSON.stringify(getOptionsFromState(file)),
            file.readOnly
          ]),
        () => this.schedule()
      )
    )
    this.stops.push(
      watch(
        () => this.editor.currentFile?.id,
        () => {
          if (!this.initializing) this.project.restoringSession = false
          this.pendingRestoreId = this.editor.currentFile?.id ?? null
          void nextTick()
            .then(() => this.restoreActiveView())
            .catch((error) => this.failure(error))
          this.schedule()
        },
        { flush: 'post' }
      )
    )
    await this.flush()
  }

  private file(payload: ManagedDocumentPayload): IFileState {
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
    this.observed.set(document.id, {
      markdown,
      format: JSON.stringify(getOptionsFromState(file)),
      revision: payload.contentRevision,
      pending: false
    })
    return file
  }

  private async applyInitialization(
    initialized: WindowInitialization,
    preserve = false
  ): Promise<void> {
    this.initializing = true
    this.schedule.cancel()
    this.initialization = initialized
    this.context = initialized.context
    this.sequence = 0
    this.preferences.SET_USER_PREFERENCE({ ...initialized.preferences })
    // Preference watchers can rebuild Muya blocks; load the document after those updates.
    await nextTick()
    if (preserve) {
      const restoring = this.project.restoringSession
      if (initialized.projectRoots) this.project.APPLY_ROOTS(initialized.projectRoots)
      this.project.restoringSession = restoring
      this.initializing = false
      window.electron.ipcRenderer.send('mt::window-initialized')
      window.electron.ipcRenderer.send('mt::project-renderer-ready')
      for (const payload of this.pendingOpens.splice(0)) this.openDocument(payload)
      this.schedule()
      return
    }
    const previous = new Map(this.editor.tabs.map((file) => [file.id, file]))
    const files = initialized.snapshot.documents.flatMap((document) => {
      const body = initialized.documentContents.find((body) => body.documentId === document.id)
      if (!body) return []
      const existing = preserve ? previous.get(document.id) : undefined
      if (existing) {
        const observed = this.observed.get(document.id)
        if (observed) observed.revision = Math.max(observed.revision, body.contentRevision)
        return [existing]
      }
      const file = this.file({
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
    if (!preserve)
      this.layout.INITIALIZE_WINDOW_LAYOUT(initialized.snapshot.layout, () => this.schedule())
    if (initialized.projectRoots) this.project.APPLY_ROOTS(initialized.projectRoots)
    this.project.RESTORE_PROJECT_VIEW(
      initialized.snapshot.workspace,
      initialized.snapshot.projectView
    )
    const activeId = preserve ? this.editor.currentFile?.id : initialized.snapshot.activeDocumentId
    this.editor.$patch((state) => {
      state.tabs = files
      state.currentFile = null
      state.tabIdToIndex = {}
      state.listToc = []
      state.toc = []
    })
    this.editor.updateTabIdToIndex()
    const active = files.find((file) => file.id === activeId) ?? files[0]
    if (active) this.editor.UPDATE_CURRENT_FILE(active)
    this.main.SET_INITIALIZED()
    window.electron.ipcRenderer.send('mt::window-initialized')
    window.electron.ipcRenderer.send('mt::project-renderer-ready')
    this.layout.DISPATCH_LAYOUT_MENU_ITEMS()
    this.preferences.DISPATCH_EDITOR_VIEW_STATE({
      sourceCode: this.preferences.sourceCode,
      focus: this.preferences.focus,
      typewriter: this.preferences.typewriter
    })
    this.initializing = false
    this.pendingRestoreId = active?.id ?? null
    await nextTick()
    await this.restoreActiveView()
    if (initialized.startupWarning)
      notice.notify({
        title: t('sideBar.tree.unavailableFolder'),
        type: 'warning',
        message: initialized.startupWarning
      })
    if (initialized.persistenceAvailable === false)
      this.failure(new Error('Recovery storage unavailable'))
    this.schedule()
  }

  private openDocument(payload: ManagedDocumentPayload): void {
    if (this.initializing) {
      this.pendingOpens.push(payload)
      return
    }
    if (this.editor.tabs.some((file) => file.id === payload.document.id)) return
    const renaming = !!this.project.renameCache
    const nameInput = document.activeElement instanceof HTMLInputElement &&
      document.activeElement.matches('input.rename') ? document.activeElement : null
    const selection = nameInput ? [nameInput.selectionStart, nameInput.selectionEnd] as const : null
    for (const id of payload.replacedDocumentIds ?? []) {
      const replaced = this.editor.tabs.find((file) => file.id === id)
      if (replaced) this.editor.FORCE_CLOSE_TAB(replaced)
      this.observed.delete(id)
    }
    const file = this.file(payload)
    const options = payload.options ?? {}
    const intent = this.editor.PEEK_OPEN_INTENT(file.pathname)
    file.isPreview =
      (intent?.preview ?? options.preview ?? false) && this.preferences.openFilesInPreviewMode
    if (typeof options.requestId === 'number')
      this.editor.SETTLE_SIDEBAR_OPEN(options.requestId, file.pathname)
    if (payload.selected && !renaming)
      this.editor.UPDATE_CURRENT_FILE(file)
    else {
      if (payload.selected) this.deferredSelection = file.id
      this.editor.tabs.push(file)
      this.editor.updateTabIdToIndex()
    }
    const focus = this.editor.TAKE_OPEN_INTENT(file.pathname)
    if (focus === true && !renaming) bus.emit('editor-focus')
    else if (focus === false && !renaming)
      bus.emit('SIDEBAR::focus-tree')
    // Retiring the previous preview can synchronously restore its editor caret.
    if (nameInput?.isConnected && selection) {
      nameInput.focus({ preventScroll: true })
      nameInput.setSelectionRange(selection[0], selection[1])
    }
    if (options.anchor) this.editor.SCROLL_TO_ANCHOR(options.anchor)
    this.schedule()
  }

  private async captureActiveView(): Promise<void> {
    const file = this.editor.currentFile
    if (!file || this.pendingRestoreId === file.id || !isDocumentViewReady(file.id, file.markdown))
      return
    const markdown = file.markdown
    const view = await captureDocumentView(
      file.id,
      markdown,
      file.tocCollapsedKeys ?? [],
      file.viewState ?? null
    )
    if (this.editor.tabs.some((current) => current.id === file.id) && file.markdown === markdown)
      file.viewState = view
  }

  private async restoreActiveView(): Promise<void> {
    const file = this.editor.currentFile
    if (!file || this.pendingRestoreId !== file.id || !isDocumentViewReady(file.id, file.markdown))
      return
    const id = file.id
    const markdown = file.markdown
    const epoch = this.interactionEpoch
    this.pendingRestoreId = null
    const keys = await restoreDocumentView(
      id,
      markdown,
      file.viewState ?? null,
      () =>
        this.editor.currentFile?.id === id &&
        this.editor.currentFile.markdown === markdown &&
        this.interactionEpoch === epoch,
      true
    )
    if (this.editor.currentFile?.id === id && file.markdown === markdown)
      file.tocCollapsedKeys = keys
  }

  flush(transactionId: string | null = null): Promise<PersistResult> {
    this.schedule.cancel()
    const result = this.queue.catch(() => {}).then(() => this.checkpoint(transactionId))
    this.queue = result
    return result
  }

  private async checkpoint(transactionId: string | null): Promise<PersistResult> {
    if (this.initializing || !this.context) return { status: 'failed', reason: 'stale-context' }
    this.editor.flushActiveEditor()
    await this.captureActiveView()
    const contents: WindowCheckpointRequest['dirtyContents'] = []
    const captured = new Map<string, { markdown: string; format: string; revision: number }>()
    const documents = this.editor.tabs.map((file) => {
      const saveFormat = getOptionsFromState(file)
      const formatKey = JSON.stringify(saveFormat)
      const observed = this.observed.get(file.id)
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
      contextToken: this.context.contextToken,
      sequence: ++this.sequence,
      closeTransactionId: transactionId,
      layout: this.layout.CAPTURE_WINDOW_LAYOUT(),
      projectView: this.project.CAPTURE_PROJECT_VIEW(
        this.initialization?.snapshot.workspace ?? null
      ),
      documents,
      activeDocumentId: this.editor.currentFile?.id ?? null,
      dirtyContents: contents,
      previewDocumentId: this.editor.tabs.find((file) => file.isPreview)?.id ?? null
    }
    const result = await window.electron.ipcRenderer.invoke('mt::state::checkpoint', request)
    if (result.status !== 'persisted') {
      const sameDocuments =
        documents.length === this.editor.tabs.length &&
        documents.every((document) => this.editor.tabs.some((file) => file.id === document.id))
      if (
        sameDocuments &&
        (result.reason !== 'stale-context' || request.contextToken === this.context.contextToken)
      )
        this.failure(new Error(result.reason))
      return result
    }
    for (const document of result.receipt.documents ?? []) {
      const file = this.editor.tabs.find((file) => file.id === document.id)
      const sent = captured.get(document.id)
      const observed = this.observed.get(document.id)
      if (!file || !sent || !observed) continue
      if (observed.revision === sent.revision) observed.pending = false
      if ((this.serverRevision.get(document.id) ?? -1) > result.receipt.metadataRevision) continue
      this.serverRevision.set(document.id, result.receipt.metadataRevision)
      this.applyResource(file, document)
      if (file.markdown === sent.markdown && JSON.stringify(getOptionsFromState(file)) === sent.format) {
        file.isSaved = document.content.kind !== 'recovery'
      }
    }
    return result
  }

  private applyResource(file: IFileState, document: DocumentSnapshot): void {
    file.pathname = document.resource.kind === 'file' ? document.resource.location.path : ''
    file.filename = document.title
    file.isPendingCreation = document.resource.kind === 'file' && document.resource.pendingCreation
    if (this.editor.currentFile?.id === file.id)
      window.DIRNAME = file.pathname ? window.path.dirname(file.pathname) : ''
  }

  private saved(result: Extract<ManagedSaveResult, { status: 'saved' }>): void {
    const file = this.editor.tabs.find((file) => file.id === result.document.id)
    if (!file || result.document.resource.kind !== 'file') return
    if ((this.serverRevision.get(file.id) ?? -1) > result.metadataRevision) return
    this.serverRevision.set(file.id, result.metadataRevision)
    file.pathname = result.document.resource.location.path
    file.filename = result.document.title
    file.isPendingCreation = false
    file.diskConflict = false
    file.diskMissing = false
    const baseline = { markdown: result.savedMarkdown, format: JSON.stringify(result.savedFormat) }
    file.isSaved =
      file.markdown === baseline.markdown && JSON.stringify(getOptionsFromState(file)) === baseline.format
    if (this.editor.currentFile?.id === file.id) window.DIRNAME = window.path.dirname(file.pathname)
    this.schedule()
  }

  private async save(id: string, saveAs = false): Promise<SaveDocumentResult> {
    const checkpoint = await this.flush()
    if (
      !this.context ||
      (checkpoint.status !== 'persisted' && checkpoint.reason !== 'storage-unavailable')
    )
      return { status: 'failed' }
    const result = await window.electron.ipcRenderer.invoke(
      'mt::state::save-document',
      this.context.contextToken,
      id,
      saveAs
    )
    if (result.status !== 'saved') return result
    this.saved(result)
    return {
      status: 'saved',
      pathname:
        result.document.resource.kind === 'file' ? result.document.resource.location.path : '',
      filename: result.document.title,
      savedMarkdown: result.savedMarkdown
    }
  }

  private async close(ids: string[]): Promise<void> {
    if (!ids.length || !this.context) return
    const result = await window.electron.ipcRenderer.invoke(
      'mt::state::close-documents',
      this.context.contextToken,
      ids
    )
    if (result.status === 'closed' && this.editor.tabs.length === 0) {
      await window.electron.ipcRenderer.invoke('mt::state::register-untitled', {
        contextToken: this.context.contextToken,
        title: '',
        selected: true
      })
    }
  }

  private failure(error: unknown): void {
    console.error('Recovery operation did not complete', error)
    void notice.notify({
      title: t('sideBar.tree.sessionSaveFailed'),
      type: 'error',
      showConfirm: false
    })
  }

  dispose(): void {
    this.schedule.cancel()
    for (const stop of this.stops) stop()
    setSessionActions(null)
    onDocumentViewChange(null)
  }
}

export const startWindowSession = async(): Promise<() => void> => {
  const session = new WindowSession()
  await session.start()
  return () => session.dispose()
}
