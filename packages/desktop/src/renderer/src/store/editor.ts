import equal from 'deep-equal'
import { prepareReading, applyReadOnly } from '../services/documentMode'
import bus from '../bus'
import { getUniqueId, deepClone } from '../util'
import listToTree, { type ListItem, type TreeNode } from '../util/listToTree'
import { createDocumentState } from './help'
import notice from '../services/notification'
import {
  FileEncodingCommand,
  LineEndingCommand,
  QuickOpenCommand,
  QuickOpenRecentCommand,
  TrailingNewlineCommand
} from '../commands'
import { defineStore } from 'pinia'
import { usePreferencesStore } from './preferences'
import { useProjectStore } from './project'

import { t } from '../i18n'
import { scheduleWindowCheckpoint } from './checkpoint'
import type { IFileState, FileNotification, FileWordCount, LineEnding, PageOptions, TabOptions } from '@shared/types/files'
import type { SaveDocumentResult } from '@shared/types/ipc'

export interface SessionActions {
  checkpoint(transactionId?: string): Promise<unknown>
  scheduleCheckpoint(): void
  captureView(): void
  save(id: string, saveAs?: boolean): Promise<SaveDocumentResult>
  create(markdown: string, selected: boolean): Promise<void>
  close(ids: string[]): Promise<void>
  saveAll(closeTabs: boolean): Promise<void>
}
let actions: SessionActions | null = null
export const getSessionActions = (): SessionActions | null => actions
export const setSessionActions = (value: SessionActions | null): void => {
  actions = value
}

interface TocItem extends ListItem {
  slug?: string
  githubSlug?: string
  content?: string
  contentHtml?: string
  lvl: number | null
}

type TocTreeNode = TreeNode<TocItem>

interface PushTabNotificationPayload {
  tabId: string
  msg: string
  showConfirm?: boolean
  style?: string
  exclusiveType?: string
  action?: FileNotification['action']
}

interface FileChangePayload {
  pathname: string
  data: {
    isMixedLineEndings?: boolean
    lineEnding?: LineEnding | string
    adjustLineEndingOnSave?: boolean
    trimTrailingNewline?: number
    encoding?: IFileState['encoding']
    markdown: string
    filename: string
    rawBaseline?: { exists: boolean; rawSha256?: string }
  }
}

interface FormatLinkClickPayload {
  // muya's getLinkInfo yields `href: null` when the rendered link carries no
  // usable href (e.g. an unsupported protocol stripped by sanitizeHyperlink).
  data: { href: string | null; [key: string]: unknown }
  dirname: string
}

interface ExportPayload {
  type: string
  content?: string
  pageOptions?: PageOptions
}

interface AutoSavePayload {
  id: string
  pathname: string
}

interface ContentChangePayload {
  id: string
  markdown: string
  wordCount?: IFileState['wordCount']
  cursor?: unknown
  muyaIndexCursor?: unknown
  history?: IFileState['history']
  toc?: TocItem[]
  blocks?: unknown
}

interface AffiliationEntry {
  type: string
  alertType?: string
  canGithubAlerts?: boolean
  functionType?: string
  listType?: string
  listItemType?: string
  isLooseListItem?: boolean
  [key: string]: unknown
}

interface SelectionChange {
  start: {
    key: string
    offset: number
    block?: { text?: string; functionType?: string }
    type?: string
  }
  end: { key: string; offset: number; block?: { functionType?: string }; type?: string }
  affiliation?: AffiliationEntry[]
  hasFrontMatter?: boolean
}

interface SelectionFormat {
  type: string
  [key: string]: unknown
}

export interface EditorState {
  currentFile: IFileState | null
  tabs: IFileState[]
  tabIdToIndex: Record<string, number>
  listToc: TocItem[]
  toc: TocTreeNode[]
  // Heading the cursor is inside, for the TOC highlight; null above the first.
  activeHeadingSlug: string | null
  selectionWordCount: FileWordCount | null
}

const autoSaveTimers = new Map<string, ReturnType<typeof setTimeout>>()

interface OpenIntent {
  focus: boolean
  preview: boolean
}

// A pathname can change from preview to pinned while its file is loading, so
// focus and preview intent must survive until separate consumers read them.
const openIntents = new Map<string, OpenIntent>()
let sidebarRequestSequence = 0
let latestSidebarRequest: { id: number; pathname: string } | null = null

export const useEditorStore = defineStore('editor', {
  state: (): EditorState => ({
    currentFile: null,
    tabs: [],
    tabIdToIndex: {},
    listToc: [], // Used for equal check and for searching for the correct github-slug to jump to
    toc: [],
    activeHeadingSlug: null,
    selectionWordCount: null
  }),

  getters: {
    /** Title for an exported file: the shallowest of the first few headings. */
    documentTitle(state): string {
      const { listToc } = state
      if (!listToc || listToc.length === 0) return ''

      let headerRef: TocItem | undefined = listToc[0]
      const len = Math.min(listToc.length, 6)
      for (let i = 1; i < len; ++i) {
        if (headerRef?.lvl === 1) break
        const header = listToc[i]
        if (header && headerRef && (headerRef.lvl ?? 0) > (header.lvl ?? 0)) {
          headerRef = header
        }
      }
      return headerRef?.content ?? ''
    }
  },

  actions: {
    async SET_READ_ONLY(tabId: string, value: boolean): Promise<void> {
      const tab = this.tabs.find((item) => item.id === tabId)
      if (!tab || tab.modeChanging || tab.readOnly === value) return
      tab.modeChanging = true
      const timer = autoSaveTimers.get(tabId)
      if (timer) clearTimeout(timer)
      autoSaveTimers.delete(tabId)
      try {
        if (value && this.currentFile?.id === tabId) await prepareReading()
        await window.electron.ipcRenderer.invoke('mt::set-document-read-only', tabId, value)
        if (!this.tabs.includes(tab)) return
        tab.readOnly = value
        if (this.currentFile?.id === tabId) applyReadOnly(value)
        if (
          !value &&
          !tab.isSaved &&
          !tab.diskConflict &&
          tab.pathname &&
          usePreferencesStore().autoSave
        ) {
          this.HANDLE_AUTO_SAVE(tab)
          this.pushTabNotification({
            tabId,
            msg: t('readingMode.resumed'),
            style: 'info',
            exclusiveType: 'reading_mode'
          })
        }
        if (value && !tab.isSaved) {
          this.pushTabNotification({
            tabId,
            msg: t('readingMode.unsaved'),
            style: 'info',
            exclusiveType: 'reading_mode'
          })
        }
        scheduleWindowCheckpoint()
      } catch (error) {
        if (this.currentFile?.id === tabId) applyReadOnly(tab.readOnly)
        await window.electron.ipcRenderer
          .invoke('mt::set-document-read-only', tabId, tab.readOnly)
          .catch(console.error)
        notice.notify({
          title: t('readingMode.failed'),
          message: String(error),
          type: 'error',
          showConfirm: false
        })
      } finally {
        tab.modeChanging = false
      }
    },

    LISTEN_FOR_READING_MODE(): void {
      window.electron.ipcRenderer.on('mt::toggle-read-only', () => {
        if (this.currentFile)
          void this.SET_READ_ONLY(this.currentFile.id, !this.currentFile.readOnly)
      })
      bus.on('toggle-read-only', () => {
        if (this.currentFile)
          void this.SET_READ_ONLY(this.currentFile.id, !this.currentFile.readOnly)
      })
    },

    SET_SELECTION_WORD_COUNT(wordCount: FileWordCount | null): void {
      this.selectionWordCount = wordCount
    },

    updateTabIdToIndex(): void {
      this.tabIdToIndex = this.tabs.reduce<Record<string, number>>((map, tab, index) => {
        map[tab.id] = index
        return map
      }, {})
    },

    async copyGithubSlug(key: string): Promise<boolean> {
      const item = this.listToc.find((i) => i.slug === key)

      if (item) {
        try {
          return await window.electron.clipboard.writeText(`#${item.githubSlug}`)
        } catch {
          return false
        }
      } else {
        console.warn(t('store.editor.tocItemNotFound', { key }))
        return false
      }
    },

    updateScrollPosition(id: string, scrollTop: number): void {
      if (!(id in this.tabIdToIndex)) {
        console.warn('updateScrollPosition: Cannot find tab index for id:', id)
        return
      }

      const tab = this.tabs[this.tabIdToIndex[id]]
      if (tab) {
        tab.scrollTop = scrollTop
      }
      scheduleWindowCheckpoint()
    },

    /**
     * Push a tab specific notification on stack that never disappears.
     */
    pushTabNotification(data: PushTabNotificationPayload): void {
      const defaultAction: FileNotification['action'] = () => {}
      const { tabId, msg } = data
      const action = data.action || defaultAction
      const showConfirm = data.showConfirm || false
      const style = data.style || 'info'
      const exclusiveType = data.exclusiveType || ''

      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab) {
        console.error(t('store.editor.tabNotFound'))
        return
      }

      const { notifications } = tab

      if (exclusiveType) {
        const index = notifications.findIndex((n) => n.exclusiveType === exclusiveType)
        if (index >= 0) {
          notifications.splice(index, 1)
        }
      }

      notifications.push({
        msg,
        showConfirm,
        style,
        exclusiveType,
        action
      })
    },

    loadChange(change: FileChangePayload): void {
      const { tabs, currentFile } = this
      const { data, pathname } = change
      const {
        isMixedLineEndings,
        lineEnding,
        adjustLineEndingOnSave,
        trimTrailingNewline,
        encoding,
        markdown,
        filename
      } = data
      const newFileState = createDocumentState({
        markdown,
        filename,
        pathname,
        encoding,
        lineEnding,
        adjustLineEndingOnSave,
        trimTrailingNewline
      })

      const tab = tabs.find((t) => window.fileUtils.isSamePathSync(t.pathname, pathname))
      if (!tab) {
        console.error('loadChange: Cannot find tab in tab list.')
        notice.notify({
          title: t('store.editor.errorLoadingTabTitle'),
          message: t('store.editor.errorLoadingTabMessage'),
          type: 'error',
          time: 20000,
          showConfirm: false
        })
        return
      }

      const oldId = tab.id
      const oldNotifications = tab.notifications.filter(
        (item) => item.exclusiveType !== 'file_changed'
      )
      const readOnly = tab.readOnly
      // Preserve scroll across external reload so the editor stays put.
      const oldScrollTop = tab.scrollTop
      let oldHistory: IFileState['history'] | null = null
      const histIndex = tab.history.index
      if (histIndex >= 0 && tab.history.stack.length >= 1) {
        const entry = tab.history.stack[histIndex]
        if (entry) {
          oldHistory = {
            stack: [entry],
            index: 0
          }
        }

        tab.history.index--
        tab.history.stack.pop()
      }

      Object.assign(tab, newFileState)
      tab.readOnly = readOnly
      tab.acceptedDiskSha256 = data.rawBaseline?.rawSha256
      tab.diskMissing = false
      tab.diskConflict = false
      tab.id = oldId
      tab.notifications = oldNotifications
      tab.scrollTop = oldScrollTop
      if (oldHistory) {
        tab.history = oldHistory
      }

      if (isMixedLineEndings && typeof lineEnding === 'string') {
        this.pushTabNotification({
          tabId: tab.id,
          msg: t('store.editor.mixedLineEndingsNormalized', {
            name: filename,
            lineEnding: lineEnding.toUpperCase()
          }),
          showConfirm: false,
          style: 'info',
          exclusiveType: ''
        })
      }

      if (currentFile && pathname === currentFile.pathname) {
        this.currentFile = tab
        const { id, cursor, history, scrollTop, muyaIndexCursor } = tab // Should not use blocks history as this is loaded from disk
        bus.emit('file-changed', {
          id,
          markdown,
          muyaIndexCursor,
          cursor,
          renderCursor: true,
          history,
          scrollTop,
          // External disk reload: the engine handler records the new content as a
          // single invertible undo boundary (replaceContent) instead of clearing
          // history (setContent), so the first undo restores the pre-reload doc.
          isReload: true
        })
      }
      scheduleWindowCheckpoint()
    },

    FORMAT_LINK_CLICK({ data, dirname }: FormatLinkClickPayload): void {
      if (data.href && data.href[0] === '#') {
        this.SCROLL_TO_ANCHOR(data.href.substring(1))
        return
      }

      window.electron.ipcRenderer.send('mt::format-link-click', {
        data,
        dirname,
        ...(this.currentFile?.readOnly ? { readOnly: true } : {})
      })
    },

    SCROLL_TO_ANCHOR(anchor: string): void {
      let anchorSlug = anchor
      try {
        anchorSlug = decodeURIComponent(anchor)
      } catch {
        // Not valid percent-encoding (e.g. `#100%`): match it as written.
      }
      if (!anchorSlug) return

      const heading = this.listToc.find((item) => item.githubSlug === anchorSlug)
      if (heading) {
        bus.emit('scroll-to-header', heading.slug)
        return
      }

      // Fall back to a non-heading target: a custom `<a id="...">` (or any
      // element with a matching id) rendered in the document.
      const anchorElement = document.getElementById(anchorSlug)
      if (anchorElement) {
        bus.emit('scroll-to-anchor-element', anchorElement)
      }
    },

    LISTEN_SCREEN_SHOT(): void {
      window.electron.ipcRenderer.on('mt::screenshot-captured', (_, filePath) => {
        bus.emit('screenshot-captured', filePath)
      })
    },

    ASK_FOR_IMAGE_AUTO_PATH(src: string): Promise<string[]> {
      if (!this.currentFile) return Promise.resolve([])
      const { pathname } = this.currentFile
      if (pathname) {
        let rs: (value: string[]) => void = () => {}
        const promise = new Promise<string[]>((resolve) => {
          rs = resolve
        })
        const id = getUniqueId()
        // Dynamic IPC channel — not part of the static IpcMainEventChannels contract.
        ;(
          window.electron.ipcRenderer.once as (
            channel: string,
            listener: (event: unknown, files: string[]) => void
          ) => void
        )(`mt::response-of-image-path-${id}`, (_: unknown, files: string[]) => {
          rs(files)
        })
        window.electron.ipcRenderer.send('mt::ask-for-image-auto-path', {
          pathname,
          src,
          id,
          currentFile: deepClone(this.currentFile)
        })
        return promise
      } else {
        return Promise.resolve([])
      }
    },

    SEARCH(value: IFileState['searchMatches']): void {
      if (!this.currentFile) return
      this.currentFile.searchMatches = deepClone(value)
    },

    SHOW_IMAGE_DELETION_URL(deletionUrl: string): void {
      notice
        .notify({
          title: t('store.editor.imageDeletionUrlTitle'),
          message: t('store.editor.imageDeletionUrlMessage', { url: deletionUrl }),
          showConfirm: true,
          time: 20000
        })
        .then(() => {
          window.electron.clipboard.writeText(deletionUrl)
        })
        // Dismissing the notice rejects; declining to copy is not a failure.
        .catch(() => {})
    },

    UPDATE_LINE_ENDING_MENU(): void {
      if (!this.currentFile) return
      const { lineEnding } = this.currentFile
      if (lineEnding) {
        const { windowId } = window.marktext?.env ?? { windowId: -1 }
        window.electron.ipcRenderer.send(
          'mt::update-line-ending-menu',
          windowId,
          lineEnding as LineEnding
        )
      }
    },

    // Flush any edit still queued in the engine's rAF batch into the active
    // tab's `currentFile` before its markdown is read to persist — otherwise an
    // edit made in the same frame as the read is silently dropped from the
    // written file (#3803), the way tab switching already guards (#2938). Safe
    // no-op when nothing is pending.
    flushActiveEditor(): void {
      bus.emit('flush-active-editor')
    },

    FILE_SAVE({ waitForResult = false } = {}): Promise<SaveDocumentResult> | void {
      if (!this.currentFile || this.currentFile.readOnly || this.currentFile.modeChanging) return
      const session = getSessionActions()
      if (!session) return
      this.flushActiveEditor()
      const result = session.save(this.currentFile.id)
      if (waitForResult) return result
      void result.catch(console.error)
    },

    LISTEN_FOR_SAVE(): void {
      window.electron.ipcRenderer.on('mt::editor-ask-file-save', () => {
        this.FILE_SAVE()
      })
      bus.on('mt::editor-ask-file-save', () => {
        this.FILE_SAVE()
      })
    },

    FILE_SAVE_AS(): void {
      if (!this.currentFile || this.currentFile.readOnly || this.currentFile.modeChanging) return
      const session = getSessionActions()
      if (!session) return
      this.flushActiveEditor()
      void session.save(this.currentFile.id, true).catch(console.error)
    },

    LISTEN_FOR_SAVE_AS(): void {
      window.electron.ipcRenderer.on('mt::editor-ask-file-save-as', () => {
        this.FILE_SAVE_AS()
      })
      bus.on('mt::editor-ask-file-save-as', () => {
        this.FILE_SAVE_AS()
      })
    },



    ASK_FOR_SAVE_ALL(closeTabs: boolean): void {
      const session = getSessionActions()
      if (session) void session.saveAll(closeTabs).catch(console.error)
    },

    MOVE_FILE_TO(): void {
      if (this.currentFile?.readOnly && !this.currentFile.pathname) return
      if (!this.currentFile) return
      if (!this.currentFile.pathname) {
        this.FILE_SAVE()
        return
      }
      this.flushActiveEditor()
      const { id, pathname } = this.currentFile
      window.electron.ipcRenderer.send('mt::response-file-move-to', { id, pathname })
    },

    LISTEN_FOR_MOVE_TO(): void {
      window.electron.ipcRenderer.on('mt::editor-move-file', () => {
        this.MOVE_FILE_TO()
      })
      bus.on('mt::editor-move-file', () => {
        this.MOVE_FILE_TO()
      })
    },

    LISTEN_FOR_RENAME(): void {
      window.electron.ipcRenderer.on('mt::editor-rename-file', () => {
        this.RESPONSE_FOR_RENAME()
      })
      bus.on('mt::editor-rename-file', () => {
        this.RESPONSE_FOR_RENAME()
      })
    },

    RESPONSE_FOR_RENAME(): void {
      if (this.currentFile?.readOnly && !this.currentFile.pathname) return
      if (!this.currentFile) return
      if (!this.currentFile.pathname) {
        this.FILE_SAVE()
        return
      }
      this.flushActiveEditor()
      bus.emit('rename')
    },

    RENAME(newFilename: string): void {
      if (!this.currentFile) return
      const { id, pathname, filename } = this.currentFile
      if (typeof filename === 'string' && filename !== newFilename) {
        const newPathname = window.path.join(window.path.dirname(pathname), newFilename)
        window.electron.ipcRenderer.send('mt::rename', {
          id,
          pathname,
          newPathname,
          currentFile: deepClone(this.currentFile)
        })
      }
    },

    RENAME_IF_NEEDED({ src, dest }: { src: string; dest: string }): void {
      this.tabs.forEach((tab) => {
        if (tab.pathname === src) {
          tab.pathname = dest
          tab.filename = window.path.basename(dest)
        }
      })
      // Keep DIRNAME in sync when the active tab is the one being renamed,
      // so link resolution / dirname-based lookups don't keep using the old
      // folder until the user switches tabs.
      if (this.currentFile != null && this.currentFile.pathname === dest) {
        window.DIRNAME = window.path.dirname(dest)
      }
      scheduleWindowCheckpoint()
    },

    UPDATE_CURRENT_FILE(currentFile: IFileState): void {
      const oldCurrentFile = this.currentFile
      let didUpdateCurrentFile = false
      if (oldCurrentFile == null || oldCurrentFile.id !== currentFile.id) {
        const { id, markdown, cursor, history, pathname, scrollTop, blocks, muyaIndexCursor } =
          currentFile
        // Must run while `currentFile` still points at the outgoing tab, so its
        // flushed edit is attributed to that tab and not lost on switch (#2938).
        if (oldCurrentFile) {
          this.flushActiveEditor()
          getSessionActions()?.captureView()
        }
        window.DIRNAME = pathname ? window.path.dirname(pathname) : ''
        this.currentFile = currentFile
        applyReadOnly(currentFile.readOnly)
        this.selectionWordCount = null
        didUpdateCurrentFile = true
        // Slugs belong to the old document; the next selection-change re-seeds.
        this.activeHeadingSlug = null

        if (!this.tabs.some((file) => file.id === currentFile.id)) {
          this.tabs.push(currentFile)
          this.updateTabIdToIndex()
        }

        bus.emit('file-changed', {
          id,
          markdown,
          cursor,
          muyaIndexCursor,
          renderCursor: true,
          history,
          scrollTop,
          blocks
        })
      }

      this.UPDATE_LINE_ENDING_MENU()
      if (didUpdateCurrentFile) {
        scheduleWindowCheckpoint()
      }
    },

    REGISTER_EDITOR_COMMANDS(): void {
      const preferencesStore = usePreferencesStore()
      const projectStore = useProjectStore()

      setTimeout(() => {
        bus.emit('cmd::register-command', new FileEncodingCommand(this))
        bus.emit(
          'cmd::register-command',
          new QuickOpenCommand({
            editor: this,
            preferences: preferencesStore,
            project: projectStore
          })
        )
        bus.emit('cmd::register-command', new QuickOpenRecentCommand())
        bus.emit('cmd::register-command', new LineEndingCommand(this))
        bus.emit('cmd::register-command', new TrailingNewlineCommand(this))

        setTimeout(() => {
          window.electron.ipcRenderer.send('mt::request-keybindings')
          bus.emit('cmd::sort-commands')
        }, 100)
      }, 400)
    },

    LISTEN_FOR_NEW_TAB(): void {

      window.electron.ipcRenderer.on(
        'mt::new-untitled-tab',
        (_, selected = true, markdown = '') => {
          this.NEW_UNTITLED_TAB({ markdown, selected })
        }
      )
      bus.on('mt::new-untitled-tab', (payload) => {
        const { selected = true, markdown = '' } =
          (payload as { selected?: boolean; markdown?: string } | undefined) ?? {}
        this.NEW_UNTITLED_TAB({ markdown, selected })
      })
    },

    CLOSE_TAB(file: IFileState | null = null): void {
      const target = file ?? this.currentFile
      const session = getSessionActions()
      if (target && session) void session.close([target.id]).catch(console.error)
    },

    LISTEN_FOR_CLOSE_TAB(): void {
      window.electron.ipcRenderer.on('mt::editor-close-tab', () => {
        this.CLOSE_TAB()
      })
      bus.on('mt::editor-close-tab', () => {
        this.CLOSE_TAB()
      })
    },

    LISTEN_FOR_TAB_CYCLE(): void {
      window.electron.ipcRenderer.on('mt::tabs-cycle-left', () => {
        this.CYCLE_TABS(false)
      })
      window.electron.ipcRenderer.on('mt::tabs-cycle-right', () => {
        this.CYCLE_TABS(true)
      })
      bus.on('mt::tabs-cycle-left', () => {
        this.CYCLE_TABS(false)
      })
      bus.on('mt::tabs-cycle-right', () => {
        this.CYCLE_TABS(true)
      })
    },

    LISTEN_FOR_SWITCH_TABS(): void {
      window.electron.ipcRenderer.on('mt::switch-tab-by-index', (_, index) => {
        this.SWITCH_TAB_BY_INDEX(index)
      })
      window.electron.ipcRenderer.on('mt::switch-tab-by-file_path', (_, filePath, options) => {
        this.SWITCH_TAB_BY_FILEPATH(filePath, options)
      })
    },

    FORCE_CLOSE_TAB(file: IFileState): void {
      window.electron.ipcRenderer.send('mt::forget-document', file.id)
      const { tabs, currentFile } = this
      const index = tabs.findIndex((t) => t.id === file.id)
      if (index > -1) {
        tabs.splice(index, 1)
        this.updateTabIdToIndex()
      }

      if (file.id && autoSaveTimers.has(file.id)) {
        const timer = autoSaveTimers.get(file.id)
        if (timer) clearTimeout(timer)
        autoSaveTimers.delete(file.id)
      }

      this.updateTabIdToIndex() // Update before sending it out to prevent stale mappings.

      if (currentFile && file.id === currentFile.id) {
        const fileState: IFileState | null =
          this.tabs[index] ?? this.tabs[index - 1] ?? this.tabs[0] ?? null
        this.currentFile = fileState
        this.selectionWordCount = null
        if (fileState && typeof fileState.markdown === 'string') {
          const { id, markdown, cursor, history, pathname, scrollTop, blocks, muyaIndexCursor } =
            fileState
          window.DIRNAME = pathname ? window.path.dirname(pathname) : ''
          bus.emit('file-changed', {
            id,
            markdown,
            cursor,
            muyaIndexCursor,
            renderCursor: true,
            history,
            scrollTop,
            blocks
          })
        } else {
          window.DIRNAME = ''
        }
      }

      if (this.tabs.length === 0) {
        this.listToc = []
        this.toc = []
      }

      const { pathname } = file
      if (pathname) {
        window.electron.ipcRenderer.send('mt::window-tab-closed', pathname)
      }
      scheduleWindowCheckpoint()
    },



    CLOSE_OTHER_TABS(file: IFileState): void {
      const session = getSessionActions()
      if (session) void session.close(this.tabs.filter(tab => tab.id !== file.id).map(tab => tab.id)).catch(console.error)
    },

    CLOSE_SAVED_TABS(): void {
      const session = getSessionActions()
      if (session) void session.close(this.tabs.filter(tab => tab.isSaved).map(tab => tab.id)).catch(console.error)
    },

    CLOSE_ALL_TABS(): void {
      const session = getSessionActions()
      if (session) void session.close(this.tabs.map(tab => tab.id)).catch(console.error)
    },

    CLOSE_TABS(tabIdList: string[]): void {
      const session = getSessionActions()
      if (session) void session.close(tabIdList).catch(console.error)
    },

    EXCHANGE_TABS_BY_ID(tabIDs: { fromId: string; toId: string | null }): void {
      const { fromId, toId } = tabIDs
      const { tabs } = this
      const moveItem = <T>(arr: T[], from: number, to: number): boolean => {
        if (from === to) return true
        const len = arr.length
        const item = arr.splice(from, 1)
        if (item.length === 0) return false

        arr.splice(to, 0, item[0]!)
        return arr.length === len
      }

      const fromIndex = tabs.findIndex((t) => t.id === fromId)
      if (fromIndex === -1) return

      if (!toId) {
        moveItem(tabs, fromIndex, tabs.length - 1)
      } else {
        const toIndex = tabs.findIndex((t) => t.id === toId)
        if (toIndex === -1) return
        const realToIndex = fromIndex < toIndex ? toIndex - 1 : toIndex
        moveItem(tabs, fromIndex, realToIndex)
      }
      this.updateTabIdToIndex()
      scheduleWindowCheckpoint()
    },

    RENAME_FILE(file: IFileState): void {
      this.UPDATE_CURRENT_FILE(file)
      bus.emit('rename')
    },

    // Direction is a boolean where false is left and true right.
    CYCLE_TABS(direction: boolean): void {
      const { tabs, currentFile } = this
      if (tabs.length <= 1) {
        return
      }

      const currentIndex = tabs.findIndex((t) => t.id === currentFile?.id)
      if (currentIndex === -1) {
        console.error('CYCLE_TABS: Cannot find current tab index.')
        return
      }

      let nextTabIndex: number
      if (!direction) {
        nextTabIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1
      } else {
        nextTabIndex = (currentIndex + 1) % tabs.length
      }

      const nextTab = tabs[nextTabIndex]
      if (!nextTab || !nextTab.id) {
        console.error(`CYCLE_TABS: Cannot find next tab (index="${nextTabIndex}").`)
        return
      }

      this.UPDATE_CURRENT_FILE(nextTab)
    },

    SET_OPEN_INTENT(pathname: string, focus: boolean, preview = false): void {
      openIntents.set(pathname, { focus, preview })
    },

    PEEK_OPEN_INTENT(pathname: string | null | undefined): OpenIntent | null {
      if (!pathname) return null
      for (const [key, intent] of openIntents) {
        if (window.fileUtils.isSamePathSync(key, pathname)) return intent
      }
      return null
    },

    TAKE_OPEN_INTENT(pathname: string | null | undefined): boolean | null {
      if (!pathname) return null
      for (const [key, intent] of openIntents) {
        if (window.fileUtils.isSamePathSync(key, pathname)) {
          openIntents.delete(key)
          return intent.focus
        }
      }
      return null
    },

    DISCARD_OPEN_INTENT(pathname: string | null | undefined): void {
      if (!pathname) return
      for (const key of openIntents.keys()) {
        if (window.fileUtils.isSamePathSync(key, pathname)) openIntents.delete(key)
      }
    },

    BEGIN_SIDEBAR_OPEN(pathname: string, preview: boolean): number | null {
      if (
        latestSidebarRequest &&
        window.fileUtils.isSamePathSync(latestSidebarRequest.pathname, pathname)
      ) {
        return null
      }

      const requestId = ++sidebarRequestSequence
      latestSidebarRequest = { id: requestId, pathname }
      this.SET_OPEN_INTENT(pathname, false, preview)
      return requestId
    },

    PROMOTE_SIDEBAR_OPEN(pathname: string): void {
      const intent = this.PEEK_OPEN_INTENT(pathname)
      if (!intent) {
        this.SET_OPEN_INTENT(pathname, true)
        return
      }

      intent.focus = true
      intent.preview = false
    },

    CANCEL_PENDING_SIDEBAR_OPEN(): void {
      if (!latestSidebarRequest) return
      const { id, pathname } = latestSidebarRequest
      latestSidebarRequest = null
      this.DISCARD_OPEN_INTENT(pathname)
      window.electron.ipcRenderer.send('mt::cancel-pending-preview', id)
    },

    IS_LATEST_SIDEBAR_OPEN(requestId: number, pathname: string): boolean {
      return (
        latestSidebarRequest?.id === requestId &&
        window.fileUtils.isSamePathSync(latestSidebarRequest.pathname, pathname)
      )
    },

    SETTLE_SIDEBAR_OPEN(requestId: number, pathname: string): void {
      if (this.IS_LATEST_SIDEBAR_OPEN(requestId, pathname)) {
        latestSidebarRequest = null
      }
    },

    SWITCH_TAB_BY_FILEPATH(filePath: string, options: TabOptions = {}): void {
      const { tabs } = this

      if (!filePath) {
        console.warn('Invalid file path:', filePath)
        return
      }

      const nextTabIndex = tabs.findIndex((t) => t.pathname === filePath)
      if (nextTabIndex === -1) {
        console.error('Cannot find tab with pathname:', filePath)
        return
      }
      const next = tabs[nextTabIndex]
      if (!next) return
      this.UPDATE_CURRENT_FILE(next)
      if (options.readOnly === true && !next.readOnly) {
        void this.SET_READ_ONLY(next.id, true)
      }
      const focus = this.TAKE_OPEN_INTENT(filePath)
      if (focus === true) bus.emit('editor-focus')
      else if (focus === false) bus.emit('SIDEBAR::focus-tree')
      if (options.anchor) this.SCROLL_TO_ANCHOR(options.anchor)
    },

    FOCUS_FILE(pathname: string): void {
      const existing = this.tabs.find((t) => window.fileUtils.isSamePathSync(t.pathname, pathname))
      if (existing) {
        existing.isPreview = false
        this.UPDATE_CURRENT_FILE(existing)
        bus.emit('editor-focus')
        return
      }
      this.PROMOTE_SIDEBAR_OPEN(pathname)
    },

    SWITCH_TAB_BY_INDEX(nextTabIndex: number): void {
      const { tabs, currentFile } = this
      if (nextTabIndex < 0 || nextTabIndex >= tabs.length) {
        console.warn('Invalid tab index:', nextTabIndex)
        return
      }

      const currentIndex = tabs.findIndex((t) => t.id === currentFile?.id)
      if (currentIndex === -1) {
        console.error('Cannot find current tab index.')
        return
      }

      const nextTab = tabs[nextTabIndex]
      if (!nextTab || !nextTab.id) {
        console.error(`Cannot find tab by index="${nextTabIndex}".`)
        return
      }
      this.UPDATE_CURRENT_FILE(nextTab)
    },

    NEW_UNTITLED_TAB({ markdown = '', selected = true }: { markdown?: string; selected?: boolean }): void {
      const session = getSessionActions()
      if (session) void session.create(markdown, selected).catch(console.error)
    },

    SET_SAVE_STATUS_WHEN_REMOVE({ pathname }: { pathname: string }): void {
      let didUpdateSaveStatus = false
      this.tabs.forEach((f) => {
        if (f.pathname === pathname) {
          f.isSaved = false
          didUpdateSaveStatus = true
        }
      })
      if (didUpdateSaveStatus) {
        scheduleWindowCheckpoint()
      }
    },

    /**
     * Replaces the table of contents with a fresh snapshot from the engine.
     *
     * Used on file load and tab switch, where the engine fires no `json-change`
     * event (so `LISTEN_FOR_CONTENT_CHANGE` never runs and the TOC would
     * otherwise stay empty until the first edit). Assigns unconditionally: this
     * is a re-seed on load/switch, so there is no `equal` guard to short-circuit
     * — the incoming snapshot always wins, even if it happens to deep-equal the
     * current TOC.
     * @param toc Flat list of headings returned by `muya.getTOC()`.
     */
    UPDATE_TOC(toc: TocItem[]): void {
      this.listToc = toc ?? []
      this.toc = listToTree<TocItem>(toc ?? [])
      // Every caller replaces the whole document, so the old slug is gone.
      this.activeHeadingSlug = null
    },

    /**
     * Re-seeds the table of contents after a preference change. `setOptions` on
     * a render-affecting option re-renders in place without emitting
     * `json-change`, so nothing else would refresh the outline.
     *
     * `setOptions` also rebuilds every block, so each heading gets a fresh
     * per-instance `slug`; the highlighted one is remapped by document position
     * (a preference toggle does not reorder or drop headings).
     */
    REFRESH_TOC(toc: TocItem[]): void {
      const activeIndex = this.activeHeadingSlug
        ? this.listToc.findIndex((item) => item.slug === this.activeHeadingSlug)
        : -1
      const nextToc = toc ?? []
      this.listToc = nextToc
      this.toc = listToTree<TocItem>(nextToc)
      this.activeHeadingSlug = activeIndex >= 0 ? (nextToc[activeIndex]?.slug ?? null) : null
    },

    SET_ACTIVE_HEADING(slug: string | null): void {
      if (this.activeHeadingSlug !== slug) {
        this.activeHeadingSlug = slug
      }
    },

    // Content change from realtime preview editor and source code editor
    // There is a chance that this event is fired AFTER the tab is switched.
    LISTEN_FOR_CONTENT_CHANGE({
      id,
      markdown,
      wordCount,
      cursor,
      muyaIndexCursor,
      history,
      toc,
      blocks
    }: ContentChangePayload): void {
      const preferencesStore = usePreferencesStore()
      const { autoSave } = preferencesStore
      if (!id) {
        throw new Error('Listen for document change but id was not set!')
      } else if (this.tabs.length === 0) {
        return
      } else if (!(id in this.tabIdToIndex)) {
        // This only happens when the sourceCode tries to write a stale id via prepareTabSwitch() but the tab
        // has already been closed. In this case we can safely ignore the update.
        return
      }

      const tab = this.tabs[this.tabIdToIndex[id]]
      if (!tab || tab.readOnly) return

      const { pathname, markdown: oldMarkdown, trimTrailingNewline } = tab

      markdown = adjustTrailingNewlines(markdown, trimTrailingNewline)
      tab.markdown = markdown

      if (wordCount) tab.wordCount = wordCount
      if (cursor) tab.cursor = cursor
      if (muyaIndexCursor) tab.muyaIndexCursor = muyaIndexCursor
      if (history) tab.history = history
      if (blocks) tab.blocks = blocks

      if (id === this.currentFile?.id && toc && !equal(toc, this.listToc)) {
        this.listToc = toc
        this.toc = listToTree<TocItem>(toc)
      }

      if (markdown !== oldMarkdown) {
        tab.isPreview = false
        tab.isSaved = false
        if (pathname && autoSave && !tab.modeChanging) this.HANDLE_AUTO_SAVE(tab)
      }
      scheduleWindowCheckpoint()
    },

    HANDLE_AUTO_SAVE({ id, pathname }: AutoSavePayload): void {
      if (!id || !pathname) {
        throw new Error('HANDLE_AUTO_SAVE: Invalid tab.')
      }

      const preferencesStore = usePreferencesStore()
      const { autoSaveDelay } = preferencesStore

      if (autoSaveTimers.has(id)) {
        const timer = autoSaveTimers.get(id)
        clearTimeout(timer)
        autoSaveTimers.delete(id)
      }

      const timer = setTimeout(() => {
        autoSaveTimers.delete(id)

        const tab = this.tabs.find((t) => t.id === id)
        if (tab && !tab.isSaved && !tab.readOnly && !tab.modeChanging && !tab.diskConflict) {
          const session = getSessionActions()
          if (session) void session.save(id).catch(console.error)
        }
      }, autoSaveDelay)
      autoSaveTimers.set(id, timer)
    },

    SELECTION_CHANGE(changes: SelectionChange): void {
      const { start, end } = changes
      if (this.currentFile && start.key === end.key && start.block?.text) {
        const value = start.block.text.substring(start.offset, end.offset)
        this.currentFile.searchMatches = {
          matches: [],
          index: -1,
          value
        }
      }

      const { windowId } = window.marktext?.env ?? { windowId: -1 }
      window.electron.ipcRenderer.send(
        'mt::editor-selection-changed',
        windowId,
        createApplicationMenuState(changes)
      )
    },

    // Persist the caret for a tab without the heavy content-change pipeline. A
    // pure caret move (click / arrow key) fires `selection-change` but NOT
    // `json-change`, so `tab.cursor` — the position replayed when the tab is
    // re-activated — would otherwise only ever track the last EDIT, losing a
    // click-moved caret across an in-session tab switch. Lightweight by design:
    // it only stores the serialized caret, skipping markdown/blocks/TOC re-derivation
    // and the save/dirty bookkeeping LISTEN_FOR_CONTENT_CHANGE performs.
    PERSIST_CURSOR(id: string, cursor: unknown): void {
      if (!id || !cursor) return
      const index = this.tabIdToIndex[id]
      if (index == null) return
      const tab = this.tabs[index]
      if (tab) tab.cursor = cursor
    },

    SELECTION_FORMATS(formats: SelectionFormat[]): void {
      const { windowId } = window.marktext?.env ?? { windowId: -1 }
      window.electron.ipcRenderer.send(
        'mt::update-format-menu',
        windowId,
        createSelectionFormatState(formats)
      )
    },

    EXPORT({ type, content, pageOptions }: ExportPayload): void {
      if (this.currentFile === null) return

      const { filename, pathname } = this.currentFile
      window.electron.ipcRenderer.send('mt::response-export', {
        type: type as ExportPayload['type'] as never,
        title: this.documentTitle,
        content: content ?? '',
        filename,
        pathname,
        pageOptions: pageOptions ?? {}
      })
    },

    // Reads `currentFile.markdown` after a flush, the way `FILE_SAVE` does: in source-code
    // mode CodeMirror writes straight to it, so `engine.getMarkdown()` would be stale (#5379).
    EXPORT_PANDOC(target: string): void {
      if (this.currentFile === null) return

      this.flushActiveEditor()
      const { pathname, markdown } = this.currentFile
      const preferencesStore = usePreferencesStore()
      window.electron.ipcRenderer.send('mt::response-pandoc-export', {
        target,
        markdown,
        superSubScript: preferencesStore.superSubScript === true,
        githubAlerts: preferencesStore.githubAlerts === true,
        footnote: preferencesStore.footnote === true,
        texMathDollars: preferencesStore.texMathDollars === true,
        texMathGfm: preferencesStore.texMathGfm === true,
        texMathSingleBackslash: preferencesStore.texMathSingleBackslash === true,
        texMathDoubleBackslash: preferencesStore.texMathDoubleBackslash === true,
        title: this.documentTitle,
        pathname
      })
    },

    LISTEN_FOR_EXPORT_SUCCESS(): void {
      window.electron.ipcRenderer.on('mt::export-success', (_, payload) => {
        const filePath = payload?.filePath ?? ''
        const name = window.path.basename(filePath)
        notice
          .notify({
            title: t('store.editor.exportSuccessTitle'),
            // The plain-text formats leave images as links, which look broken once shared.
            message: payload?.linksMedia
              ? t('store.editor.exportLinkedMediaMessage', { name })
              : t('store.editor.exportSuccessMessage', { name }),
            showConfirm: true
          })
          .then(() => {
            window.electron.shell.showItemInFolder(filePath)
          })
          // Dismissing the notice rejects; declining to reveal is not a failure.
          .catch(() => {})
      })
    },

    PRINT_RESPONSE(): void {
      window.electron.ipcRenderer.send('mt::response-print')
    },

    LISTEN_FOR_PRINT_SERVICE_CLEARUP(): void {
      window.electron.ipcRenderer.on('mt::print-service-clearup', () => {
        bus.emit('print-service-clearup')
      })
    },

    SET_LINE_ENDING(lineEnding: LineEnding | string): void {
      if (this.currentFile?.readOnly || this.currentFile?.modeChanging) return
      if (!this.currentFile) return
      const { lineEnding: oldLineEnding } = this.currentFile
      if (lineEnding !== oldLineEnding) {
        this.currentFile.lineEnding = lineEnding
        this.currentFile.adjustLineEndingOnSave = lineEnding !== 'lf'
        this.currentFile.isSaved = true
        this.UPDATE_LINE_ENDING_MENU()
        scheduleWindowCheckpoint()
      }
    },

    LISTEN_FOR_SET_LINE_ENDING(): void {
      window.electron.ipcRenderer.on('mt::set-line-ending', (_, lineEnding) => {
        this.SET_LINE_ENDING(lineEnding)
      })
      bus.on('mt::set-line-ending', (lineEnding) => {
        this.SET_LINE_ENDING(lineEnding as LineEnding)
      })
    },

    LISTEN_FOR_SET_ENCODING(): void {
      bus.on('mt::set-file-encoding', (encodingName) => {
        if (this.currentFile?.readOnly || this.currentFile?.modeChanging) return
        if (!this.currentFile) return
        const { encoding } = this.currentFile.encoding
        if (encoding !== encodingName) {
          this.currentFile.encoding.encoding = encodingName as string
          this.currentFile.encoding.isBom = false
          this.currentFile.isSaved = true
          scheduleWindowCheckpoint()
        }
      })
    },

    LISTEN_FOR_SET_FINAL_NEWLINE(): void {
      bus.on('mt::set-final-newline', (value) => {
        if (this.currentFile?.readOnly || this.currentFile?.modeChanging) return
        if (!this.currentFile) return
        const { trimTrailingNewline } = this.currentFile
        if (trimTrailingNewline !== value) {
          this.currentFile.trimTrailingNewline = value as number
          this.currentFile.isSaved = true
          scheduleWindowCheckpoint()
        }
      })
    },

    LISTEN_FOR_FILE_CHANGE(): void {
      window.electron.ipcRenderer.on('mt::update-file', (_, payload) => {
        const { type, change } = payload
        const { tabs } = this
        const { pathname } = change
        const tab = tabs.find((t) => window.fileUtils.isSamePathSync(t.pathname, pathname))
        if (tab) {
          const { id, isSaved, filename } = tab
          switch (type) {
            case 'unlink': {
              tab.diskMissing = true
              if (!tab.readOnly) tab.isSaved = false
              this.pushTabNotification({
                tabId: id,
                msg: t('store.editor.fileRemovedOnDisk', { name: filename }),
                style: 'warn',
                showConfirm: false,
                exclusiveType: 'file_changed'
              })
              scheduleWindowCheckpoint()
              break
            }
            case 'add':
            case 'change': {
              const wasMissing = tab.diskMissing
              tab.diskMissing = false
              // Only the file's metadata changed on disk (e.g. a git checkout
              // that left the content byte-identical) — there is nothing to
              // reload and no reason to warn the user (#1861).
              const newMarkdown = (change as unknown as FileChangePayload).data?.markdown
              if (typeof newMarkdown === 'string' && newMarkdown === tab.markdown) {
                if (wasMissing)
                  tab.notifications = tab.notifications.filter(
                    (item) => item.exclusiveType !== 'file_changed'
                  )
                break
              }

              // The tab holds no local edits, so reloading discards nothing and
              // needs no confirmation (#3652). Deliberately independent of
              // autoSave: that writes our buffer back to disk and would
              // overwrite whichever editor produced this change.
              if (isSaved) {
                if (autoSaveTimers.has(id)) {
                  const timer = autoSaveTimers.get(id)
                  if (timer) clearTimeout(timer)
                  autoSaveTimers.delete(id)
                }

                this.loadChange(change as unknown as FileChangePayload)
                return
              }

              tab.diskConflict = true
              this.pushTabNotification({
                tabId: id,
                msg: t('store.editor.fileChangedOnDisk', { name: filename }),
                showConfirm: true,
                exclusiveType: 'file_changed',
                action: (status) => {
                  if (status) {
                    this.loadChange(change as unknown as FileChangePayload)
                  }
                }
              })
              scheduleWindowCheckpoint()
              break
            }
            default:
              console.error(`LISTEN_FOR_FILE_CHANGE: Invalid type "${type}"`)
          }
        } else {
          console.error(`LISTEN_FOR_FILE_CHANGE: Cannot find tab for path "${pathname}".`)
        }
      })
    },

    ASK_FOR_IMAGE_PATH(): Promise<string[]> {
      return window.electron.ipcRenderer.invoke('mt::ask-for-image-path')
    },

    EDIT_ZOOM(zoomFactor: number): void {
      const preferencesStore = usePreferencesStore()
      zoomFactor = Number.parseFloat(zoomFactor.toFixed(3))
      const { zoom } = preferencesStore
      if (zoom !== zoomFactor) {
        preferencesStore.SET_SINGLE_PREFERENCE({ type: 'zoom', value: zoomFactor })
      }
      window.electron.webFrame.setZoomFactor(zoomFactor)
    },

    LISTEN_WINDOW_ZOOM(): void {
      window.electron.ipcRenderer.on('mt::window-zoom', (_, zoomFactor) => {
        this.EDIT_ZOOM(zoomFactor)
      })
      bus.on('mt::window-zoom', (zoomFactor) => {
        this.EDIT_ZOOM(zoomFactor as number)
      })
    },

    LISTEN_FOR_RELOAD_IMAGES(): void {
      window.electron.ipcRenderer.on('mt::invalidate-image-cache', () => {
        bus.emit('invalidate-image-cache')
      })
    },

    LISTEN_FOR_CONTEXT_MENU(): void {
      window.electron.ipcRenderer.on('mt::cm-copy-as-rich', () => {
        bus.emit('copyAsRich', 'copyAsRich')
      })
      window.electron.ipcRenderer.on('mt::cm-copy-as-html', () => {
        bus.emit('copyAsHtml', 'copyAsHtml')
      })
      window.electron.ipcRenderer.on('mt::cm-paste-as-plain-text', () => {
        bus.emit('pasteAsPlainText', 'pasteAsPlainText')
      })
      window.electron.ipcRenderer.on('mt::cm-insert-paragraph', (_, location) => {
        bus.emit('insertParagraph', location)
      })

      window.electron.ipcRenderer.on('mt::spelling-replace-misspelling', (_, info) => {
        bus.emit('replace-misspelling', info)
      })
      window.electron.ipcRenderer.on('mt::spelling-show-switch-language', () => {
        bus.emit('open-command-spellchecker-switch-language')
      })
    },
  }
})

/**
 * Trim the final newlines according `trimTrailingNewlineOption`.
 *
 * @param markdown The text to trim.
 * @param trimTrailingNewlineOption The option how we should trim the final newlines.
 */
const adjustTrailingNewlines = (markdown: string, trimTrailingNewlineOption: number): string => {
  if (!markdown) {
    return ''
  }

  switch (trimTrailingNewlineOption) {
    case 0: {
      return trimTrailingNewlines(markdown)
    }
    case 1: {
      // Muya will always add a final new line to the markdown text. Check first whether
      // only one newline exist to prevent copying the string.
      const lastIndex = markdown.length - 1
      if (markdown[lastIndex] === '\n') {
        if (markdown.length === 1) {
          return ''
        } else if (markdown[lastIndex - 1] !== '\n') {
          return markdown
        }
      }

      markdown = trimTrailingNewlines(markdown)
      if (markdown.length === 0) {
        return ''
      }
      return markdown + '\n'
    }
    default:
      return markdown
  }
}

const trimTrailingNewlines = (text: string): string => {
  return text.replace(/[\r?\n]+$/, '')
}

interface ApplicationMenuState {
  alertType?: string
  canGithubAlerts?: boolean
  isDisabled: boolean
  isMultiline: boolean
  isLooseListItem: boolean
  isTaskList: boolean
  isCodeFences: boolean
  isCodeContent: boolean
  isTable: boolean
  hasFrontMatter: boolean
  affiliation: Record<string, boolean>
}

const createApplicationMenuState = ({
  start,
  end,
  affiliation,
  hasFrontMatter
}: SelectionChange): ApplicationMenuState => {
  const state: ApplicationMenuState = {
    isDisabled: false,
    isMultiline: start.key !== end.key,
    isLooseListItem: false,
    isTaskList: false,
    isCodeFences: false,
    isCodeContent: false,
    isTable: false,
    hasFrontMatter: !!hasFrontMatter,
    // Contains keys about the selection type(s) (string, boolean) like "ul: true".
    affiliation: {}
  }
  const { isMultiline } = state
  const aff: AffiliationEntry[] = affiliation ?? []
  state.alertType = aff[0]?.alertType
  state.canGithubAlerts = aff[0]?.canGithubAlerts === true
  const startBlock: { text?: string; functionType?: string } = start.block ?? {}
  const endBlock: { functionType?: string } = end.block ?? {}

  if (
    (startBlock.functionType === 'cellContent' && endBlock.functionType === 'cellContent') ||
    (start.type === 'span' && startBlock.functionType === 'codeContent') ||
    (end.type === 'span' && endBlock.functionType === 'codeContent')
  ) {
    state.isCodeFences = true

    if (startBlock.functionType === 'codeContent' || endBlock.functionType === 'codeContent') {
      state.isCodeContent = true
    }
  }

  // Check every list level in the affiliation chain — nested lists show all
  // levels (e.g. a ul wrapping an ol checks both). Scanning the full chain (not
  // just the depth-3 loop below) keeps a deeply nested inner list checked. The
  // loose/task flags come from the INNERMOST list (the one the cursor is in);
  // the chain is outermost-first, so that is the last ul/ol entry.
  const listEntries = aff.filter((b) => b.type === 'ul' || b.type === 'ol')
  for (const entry of listEntries) {
    // Task and bullet lists are both `type: 'ul'`; distinguish by listType so a
    // chain with several kinds (e.g. ol > task > ul) checks each list menu item.
    const kind = entry.type === 'ol' ? 'ol' : entry.listType === 'task' ? 'task' : 'ul'
    state.affiliation[kind] = true
  }
  const innerList = listEntries[listEntries.length - 1]
  if (innerList) {
    // The engine's affiliation entry carries the loose flag on the list block
    // itself (derived from `meta.loose`), not via a `children` chain.
    state.isLooseListItem = !!innerList.isLooseListItem
    state.isTaskList = innerList.listType === 'task'
  }

  for (const b of aff.slice(0, 3)) {
    if (b.type === 'pre' && b.functionType) {
      if (/frontmatter|html|multiplemath|code$/.test(b.functionType)) {
        state.isCodeFences = true
        state.affiliation[b.functionType] = true
      }
      break
    } else if (b.type === 'figure' && b.functionType) {
      if (b.functionType === 'table') {
        state.isTable = true
        state.isDisabled = true
        state.affiliation[b.type] = true
      } else if (b.functionType === 'diagram') {
        // Diagrams are atomic, non-formattable blocks: disable the whole
        // paragraph + format menus like a code fence, but they are not tables.
        state.isCodeFences = true
        state.affiliation[b.functionType] = true
      }
      break
    } else if (isMultiline && /^h{1,6}$/.test(b.type)) {
      state.affiliation = {}
      break
    } else if (b.type !== 'ul' && b.type !== 'ol') {
      if (!state.affiliation[b.type]) {
        state.affiliation[b.type] = true
      }
    }
  }

  if (Object.getOwnPropertyNames(state.affiliation).length >= 2 && state.affiliation.p) {
    delete state.affiliation.p
  }
  if ((state.affiliation.ul || state.affiliation.ol) && state.affiliation.li) {
    delete state.affiliation.li
  }
  return state
}

export const createSelectionFormatState = (formats: SelectionFormat[]): Record<string, boolean> => {
  const state: Record<string, boolean> = {}
  for (const item of formats) {
    // Underline/superscript/subscript/highlight are carried as `html_tag`
    // tokens whose `tag` (u/sup/sub/mark) is the real format key the menu
    // map keys off — the bare `type` would only ever yield `html_tag`.
    const key = item.type === 'html_tag' ? (item.tag as string) : item.type
    if (key) state[key] = true
  }
  return state
}
