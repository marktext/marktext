import equal from 'deep-equal'
import bus from '../bus'
import { hasKeys, getUniqueId, deepClone } from '../util'
import listToTree from '../util/listToTree'
import {
  createDocumentState,
  getOptionsFromState,
  getBlankFileState,
  defaultFileState
} from './help'
import notice from '../services/notification'
import {
  FileEncodingCommand,
  LineEndingCommand,
  QuickOpenCommand,
  TrailingNewlineCommand
} from '../commands'
import { defineStore } from 'pinia'
import { usePreferencesStore } from './preferences'
import { useProjectStore } from './project'
import { useLayoutStore } from './layout'
import { useMainStore } from '.'
import { i18n } from '../i18n'
import { debouncedSendBufferedState, sendBufferedState } from './bufferedState'

const autoSaveTimers = new Map()

export const useEditorStore = defineStore('editor', {
  state: () => ({
    currentFile: {},
    tabs: [],
    tabIdToIndex: {},
    listToc: [], // Used for equal check and for searching for the correct github-slug to jump to
    toc: []
  }),

  actions: {
    updateTabIdToIndex() {
      this.tabIdToIndex = this.tabs.reduce((map, tab, index) => {
        map[tab.id] = index
        return map
      }, {})
    },

    CREATE_BUFFERED_STATE() {
      return createBufferedEditorState(this.$state)
    },

    RESTORE_BUFFERED_STATE(state) {
      const bufferedEditorState = createBufferedEditorState(state?.editor || state)
      if (!bufferedEditorState) {
        console.error('RESTORE_BUFFERED_STATE: Invalid editor buffer state.')
        return
      }

      const oldIdToNewId = {}
      const tabs = bufferedEditorState.tabs.map((tab) => {
        const fileState = createDocumentState(tab)

        oldIdToNewId[tab.id] = fileState.id

        return fileState
      })

      const currentFileId = oldIdToNewId[bufferedEditorState.currentFileId]
      const currentFile = tabs.find((tab) => tab.id === currentFileId) ?? {}

      const projectStore = useProjectStore()
      const layoutStore = useLayoutStore()

      projectStore.RESTORE_BUFFERED_STATE(state?.project)
      layoutStore.RESTORE_BUFFERED_STATE(state?.layout)
      this.$patch((state) => {
        state.tabs = tabs
        state.currentFile = currentFile
        state.tabIdToIndex = {}
        state.listToc = []
        state.toc = []
      })

      this.updateTabIdToIndex()
      window.DIRNAME = currentFile.pathname ? window.path.dirname(currentFile.pathname) : ''
      this.UPDATE_LINE_ENDING_MENU()

      for (const warning of bufferedEditorState.restoreWarnings) {
        const restoredTabId = warning.tabId ? oldIdToNewId[warning.tabId] : null
        const tab = restoredTabId
          ? this.tabs.find((t) => t.id === restoredTabId)
          : this.tabs.find((t) => window.fileUtils.isSamePathSync(t.pathname, warning.pathname))

        if (!tab) continue

        this.pushTabNotification({
          tabId: tab.id,
          msg: warning.msg,
          showConfirm: warning.showConfirm,
          style: warning.style,
          exclusiveType: warning.exclusiveType
        })
      }
    },

    /**
     * Copies the specified heading's github-slug to the clipboard.
     * @param {string} id The heading-id to copy.
     */
    copyGithubSlug(key) {
      const item = this.listToc.find((i) => i.slug === key)

      if (item) {
        window.electron.clipboard.writeText(`#${item.githubSlug}`)
        notice.notify({
          title: i18n.global.t('store.editor.anchorLinkCopied'),
          type: 'primary',
          time: 2000,
          showConfirm: false
        })
      } else {
        console.warn(i18n.global.t('store.editor.tocItemNotFound', { key }))
      }
    },

    /**
     * Update scroll position for the currentFile
     */
    updateScrollPosition(id, scrollTop) {
      if (!(id in this.tabIdToIndex)) {
        console.warn('updateScrollPosition: Cannot find tab index for id:', id)
        return
      }

      this.tabs[this.tabIdToIndex[id]].scrollTop = scrollTop
      debouncedSendBufferedState()
    },

    /**
     * Push a tab specific notification on stack that never disappears.
     */
    pushTabNotification(data) {
      const defaultAction = () => {}
      const { tabId, msg } = data
      const action = data.action || defaultAction
      const showConfirm = data.showConfirm || false
      const style = data.style || 'info'
      // Whether only one notification should exist.
      const exclusiveType = data.exclusiveType || ''

      const tab = this.tabs.find((t) => t.id === tabId)
      if (!tab) {
        console.error(i18n.global.t('store.editor.tabNotFound'))
        return
      }

      const { notifications } = tab

      // Remove the old notification if only one should exist.
      if (exclusiveType) {
        const index = notifications.findIndex((n) => n.exclusiveType === exclusiveType)
        if (index >= 0) {
          // Reorder current notification
          notifications.splice(index, 1)
        }
      }

      // Push new notification on stack.
      notifications.push({
        msg,
        showConfirm,
        style,
        exclusiveType,
        action
      })
    },

    loadChange(change) {
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
      // Create a new document and update few entires later.
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
        // The tab may be closed in the meanwhile.
        console.error('loadChange: Cannot find tab in tab list.')
        notice.notify({
          title: i18n.global.t('store.editor.errorLoadingTabTitle'),
          message: i18n.global.t('store.editor.errorLoadingTabMessage'),
          type: 'error',
          time: 20000,
          showConfirm: false
        })
        return
      }

      // Backup few entries that we need to restore later.
      const oldId = tab.id
      const oldNotifications = tab.notifications
      let oldHistory = null
      if (tab.history.index >= 0 && tab.history.stack.length >= 1) {
        // Allow to restore the old document.
        oldHistory = {
          stack: [tab.history.stack[tab.history.index]],
          index: 0
        }

        // Free reference from array
        tab.history.index--
        tab.history.stack.pop()
      }

      // Update file content and restore some entries.
      Object.assign(tab, newFileState)
      tab.id = oldId
      tab.notifications = oldNotifications
      if (oldHistory) {
        tab.history = oldHistory
      }

      if (isMixedLineEndings) {
        this.pushTabNotification({
          tabId: tab.id,
          msg: i18n.global.t('store.editor.mixedLineEndingsNormalized', {
            name: filename,
            lineEnding: lineEnding.toUpperCase()
          }),
          showConfirm: false,
          style: 'info',
          exclusiveType: ''
        })
      }

      // Reload the editor if the tab is currently opened.
      if (pathname === currentFile.pathname) {
        // save current state first
        this.currentFile = tab
        const { id, cursor, history, scrollTop, muyaIndexCursor } = tab // Should not use blocks history as this is loaded from disk
        bus.emit('file-changed', {
          id,
          markdown,
          muyaIndexCursor,
          cursor,
          renderCursor: true,
          history,
          scrollTop
        })
      }
      debouncedSendBufferedState()
    },

    FORMAT_LINK_CLICK({ data, dirname }) {
      // Check if the link starts with a #, that is a local anchor link.

      if (data.href.length > 0 && data.href[0] === '#') {
        const anchorSlug = data.href.substring(1)
        if (!anchorSlug) return

        // Find the block with the anchor slug from the TOC
        for (const item of this.listToc) {
          if (item.githubSlug === anchorSlug) {
            // Scroll to the corresponding element that matches this github-slug
            bus.emit('scroll-to-header', item.slug)
            return
          }
        }

        return
      }

      window.electron.ipcRenderer.send('mt::format-link-click', { data, dirname })
    },

    LISTEN_SCREEN_SHOT() {
      window.electron.ipcRenderer.on('mt::screenshot-captured', () => {
        bus.emit('screenshot-captured')
      })
    },

    // image path auto complement
    ASK_FOR_IMAGE_AUTO_PATH(src) {
      const { pathname } = this.currentFile
      if (pathname) {
        let rs
        const promise = new Promise((resolve) => {
          rs = resolve
        })
        const id = getUniqueId()
        window.electron.ipcRenderer.once(`mt::response-of-image-path-${id}`, (_, files) => {
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

    SEARCH(value) {
      this.currentFile.searchMatches = JSON.parse(JSON.stringify(value)) // deep clone to trigger state changes
    },

    SHOW_IMAGE_DELETION_URL(deletionUrl) {
      notice
        .notify({
          title: i18n.global.t('store.editor.imageDeletionUrlTitle'),
          message: i18n.global.t('store.editor.imageDeletionUrlMessage', { url: deletionUrl }),
          showConfirm: true,
          time: 20000
        })
        .then(() => {
          window.electron.clipboard.writeText(deletionUrl)
        })
    },

    // We need to update line endings menu when changing tabs.
    UPDATE_LINE_ENDING_MENU() {
      const { lineEnding } = this.currentFile
      if (lineEnding) {
        const { windowId } = global.marktext.env
        window.electron.ipcRenderer.send('mt::update-line-ending-menu', windowId, lineEnding)
      }
    },

    FILE_SAVE() {
      const projectStore = useProjectStore()
      const { id, filename, pathname, markdown } = this.currentFile
      const options = getOptionsFromState(this.currentFile)
      const defaultPath = getRootFolderFromState(projectStore)
      if (id) {
        window.electron.ipcRenderer.send(
          'mt::response-file-save',
          id,
          filename,
          pathname,
          markdown,
          deepClone(options),
          defaultPath
        )
      }
    },

    // need pass some data to main process when `save` menu item clicked
    LISTEN_FOR_SAVE() {
      window.electron.ipcRenderer.on('mt::editor-ask-file-save', () => {
        this.FILE_SAVE()
      })
      bus.on('mt::editor-ask-file-save', () => {
        this.FILE_SAVE()
      })
    },

    FILE_SAVE_AS() {
      const projectStore = useProjectStore()
      const { id, filename, pathname, markdown } = this.currentFile
      const options = getOptionsFromState(this.currentFile)
      const defaultPath = getRootFolderFromState(projectStore)

      if (id) {
        window.electron.ipcRenderer.send(
          'mt::response-file-save-as',
          id,
          filename,
          pathname,
          markdown,
          deepClone(options),
          defaultPath
        )
      }
    },

    // need pass some data to main process when `save as` menu item clicked
    LISTEN_FOR_SAVE_AS() {
      window.electron.ipcRenderer.on('mt::editor-ask-file-save-as', () => {
        this.FILE_SAVE_AS()
      })
      bus.on('mt::editor-ask-file-save-as', () => {
        this.FILE_SAVE_AS()
      })
    },

    LISTEN_FOR_SET_PATHNAME() {
      window.electron.ipcRenderer.on('mt::set-pathname', (_, fileInfo) => {
        const { tabs } = this
        const { pathname, id } = fileInfo
        const tab = tabs.find((f) => f.id === id)
        if (!tab) {
          console.error('[ERROR] Cannot change file path from unknown tab.')
          return
        }

        // If a tab with the same file path already exists we need to close the tab.
        // The existing tab is overwritten by this tab.
        const existingTab = tabs.find(
          (t) => t.id !== id && window.fileUtils.isSamePathSync(t.pathname, pathname)
        )
        if (existingTab) {
          this.CLOSE_TAB(existingTab)
        }

        // SET_PATHNAME
        const { filename } = fileInfo
        if (id === this.currentFile.id && pathname) {
          window.DIRNAME = window.path.dirname(pathname)
        }
        if (tab) {
          Object.assign(tab, { filename, pathname, isSaved: true })
          debouncedSendBufferedState()
        }
      })

      window.electron.ipcRenderer.on('mt::tab-saved', (_, tabId) => {
        const tab = this.tabs.find((f) => f.id === tabId)
        if (tab) {
          if (
            tab.history.lastEditIndex >= 0 &&
            tab.history.lastEditIndex < tab.history.stack.length
          ) {
            tab.lastSavedHistoryId = tab.history.stack[tab.history.lastEditIndex].id
          }
          tab.isSaved = true
          debouncedSendBufferedState()
        }
      })

      window.electron.ipcRenderer.on('mt::tab-save-failure', (_, tabId, msg) => {
        const tab = this.tabs.find((t) => t.id === tabId)
        if (!tab) {
          notice.notify({
            title: i18n.global.t('dialog.saveFailure'),
            message: msg,
            type: 'error',
            time: 20000,
            showConfirm: false
          })
          return
        }

        tab.isSaved = false
        this.pushTabNotification({
          tabId,
          msg: i18n.global.t('store.editor.errorWhileSaving', { msg }),
          style: 'crit'
        })
        debouncedSendBufferedState()
      })
    },

    LISTEN_FOR_CLOSE() {
      const projectStore = useProjectStore()
      const preferencesStore = usePreferencesStore()
      window.electron.ipcRenderer.on('mt::ask-for-close', () => {
        sendBufferedState()
          .catch((err) => {
            console.error('Failed to update buffered state before closing', err)
          })
          .then(() => {
            const unsavedFiles = this.tabs
              .filter((file) => !file.isSaved)
              .map((file) => {
                const { id, filename, pathname, markdown } = file
                const options = getOptionsFromState(file)
                return {
                  id,
                  filename,
                  pathname,
                  markdown,
                  options,
                  defaultPath: getRootFolderFromState(projectStore)
                }
              })

            if (unsavedFiles.length && preferencesStore.startUpAction !== 'restoreAll') {
              // Ignore unsaved files when user has chosen to restore all on startup, as they will be restored anyway.
              window.electron.ipcRenderer.send('mt::close-window-confirm', deepClone(unsavedFiles))
            } else {
              window.electron.ipcRenderer.send('mt::close-window')
            }
          })
      })
    },

    LISTEN_FOR_SAVE_CLOSE() {
      window.electron.ipcRenderer.on('mt::force-close-tabs-by-id', (_, tabIdList) => {
        if (Array.isArray(tabIdList) && tabIdList.length) {
          this.CLOSE_TABS(tabIdList)
        }
      })
    },

    ASK_FOR_SAVE_ALL(closeTabs) {
      const { tabs } = this
      const projectStore = useProjectStore()
      const unsavedFiles = tabs
        .filter((file) => !(file.isSaved && /[^\n]/.test(file.markdown)))
        .map((file) => {
          const { id, filename, pathname, markdown } = file
          const options = getOptionsFromState(file)
          return {
            id,
            filename,
            pathname,
            markdown,
            options,
            defaultPath: getRootFolderFromState(projectStore)
          }
        })

      if (closeTabs) {
        if (unsavedFiles.length) {
          this.CLOSE_TABS(tabs.filter((f) => f.isSaved).map((f) => f.id))
          window.electron.ipcRenderer.send('mt::save-and-close-tabs', deepClone(unsavedFiles))
        } else {
          this.CLOSE_TABS(tabs.map((f) => f.id))
        }
      } else {
        window.electron.ipcRenderer.send('mt::save-tabs', deepClone(unsavedFiles))
      }
    },

    MOVE_FILE_TO() {
      const projectStore = useProjectStore()
      const { id, filename, pathname, markdown } = this.currentFile
      const options = getOptionsFromState(this.currentFile)
      const defaultPath = getRootFolderFromState(projectStore)
      if (!id) return
      if (!pathname) {
        // if current file is a newly created file, just save it!
        window.electron.ipcRenderer.send(
          'mt::response-file-save',
          id,
          filename,
          pathname,
          markdown,
          deepClone(options),
          defaultPath
        )
      } else {
        // if not, move to a new(maybe) folder
        window.electron.ipcRenderer.send('mt::response-file-move-to', { id, pathname })
      }
    },

    LISTEN_FOR_MOVE_TO() {
      window.electron.ipcRenderer.on('mt::editor-move-file', () => {
        this.MOVE_FILE_TO()
      })
      bus.on('mt::editor-move-file', () => {
        this.MOVE_FILE_TO()
      })
    },

    LISTEN_FOR_RENAME() {
      window.electron.ipcRenderer.on('mt::editor-rename-file', () => {
        this.RESPONSE_FOR_RENAME()
      })
      bus.on('mt::editor-rename-file', () => {
        this.RESPONSE_FOR_RENAME()
      })
    },

    RESPONSE_FOR_RENAME() {
      const projectStore = useProjectStore()
      const { id, filename, pathname, markdown } = this.currentFile
      const options = getOptionsFromState(this.currentFile)
      const defaultPath = getRootFolderFromState(projectStore)
      if (!id) return
      if (!pathname) {
        // if current file is a newly created file, just save it!
        window.electron.ipcRenderer.send(
          'mt::response-file-save',
          id,
          filename,
          pathname,
          markdown,
          deepClone(options),
          defaultPath
        )
      } else {
        bus.emit('rename')
      }
    },

    // ask for main process to rename this file to a new name `newFilename`
    RENAME(newFilename) {
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

    UPDATE_CURRENT_FILE(currentFile) {
      const oldCurrentFile = this.currentFile
      let didUpdateCurrentFile = false
      if (!oldCurrentFile.id || oldCurrentFile.id !== currentFile.id) {
        const { id, markdown, cursor, history, pathname, scrollTop, blocks, muyaIndexCursor } =
          currentFile
        window.DIRNAME = pathname ? window.path.dirname(pathname) : ''
        this.currentFile = currentFile
        didUpdateCurrentFile = true

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
        debouncedSendBufferedState()
      }
    },

    // This events are only used during window creation.
    LISTEN_FOR_BOOTSTRAP_WINDOW() {
      const preferencesStore = usePreferencesStore()
      const layoutStore = useLayoutStore()
      const projectStore = useProjectStore()
      const mainStore = useMainStore()

      // Delay load runtime commands and initialize commands.
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
        bus.emit('cmd::register-command', new LineEndingCommand(this))
        bus.emit('cmd::register-command', new TrailingNewlineCommand(this))

        setTimeout(() => {
          window.electron.ipcRenderer.send('mt::request-keybindings')
          bus.emit('cmd::sort-commands')
        }, 100)
      }, 400)

      window.electron.ipcRenderer.on('mt::bootstrap-editor', (_, config) => {
        const {
          addBlankTab,
          markdownList,
          lineEnding,
          sideBarVisibility,
          tabBarVisibility,
          sourceCodeModeEnabled
        } = config

        window.electron.ipcRenderer.send('mt::window-initialized')
        mainStore.SET_INITIALIZED()
        preferencesStore.SET_USER_PREFERENCE({ endOfLine: lineEnding })
        layoutStore.SET_LAYOUT({
          rightColumn: 'files',
          showSideBar: !!sideBarVisibility,
          showTabBar: !!tabBarVisibility
        })
        layoutStore.DISPATCH_LAYOUT_MENU_ITEMS()
        preferencesStore.SET_MODE({
          type: 'sourceCode',
          checked: !!sourceCodeModeEnabled
        })

        if (addBlankTab) {
          this.NEW_UNTITLED_TAB({ selected: true })
        } else if (markdownList.length) {
          let isFirst = true
          for (const markdown of markdownList) {
            this.NEW_UNTITLED_TAB({ markdown, selected: isFirst })
            isFirst = false
          }
        }
      })
    },

    // Open a new tab, optionally with content.
    LISTEN_FOR_NEW_TAB() {
      window.electron.ipcRenderer.on(
        'mt::open-new-tab',
        (_, markdownDocument, options = {}, selected = true) => {
          if (markdownDocument) {
            // Create tab with content.
            this.NEW_TAB_WITH_CONTENT({ markdownDocument, options, selected })
          } else {
            // Fallback: create a blank tab and always select it
            this.NEW_UNTITLED_TAB({})
          }
        }
      )

      window.electron.ipcRenderer.on(
        'mt::new-untitled-tab',
        (_, selected = true, markdown = '') => {
          // Create a blank tab
          this.NEW_UNTITLED_TAB({ markdown, selected })
        }
      )
      bus.on('mt::new-untitled-tab', ({ selected = true, markdown = '' }) => {
        this.NEW_UNTITLED_TAB({ markdown, selected })
      })
    },

    CLOSE_TAB(file = null) {
      if (!file) {
        file = this.currentFile
      }
      if (!hasKeys(file)) return

      if (file.isSaved) {
        this.FORCE_CLOSE_TAB(file)
      } else {
        this.CLOSE_UNSAVED_TAB(file)
      }
    },

    LISTEN_FOR_CLOSE_TAB() {
      window.electron.ipcRenderer.on('mt::editor-close-tab', () => {
        this.CLOSE_TAB()
      })
      bus.on('mt::editor-close-tab', () => {
        this.CLOSE_TAB()
      })
    },

    LISTEN_FOR_TAB_CYCLE() {
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

    LISTEN_FOR_SWITCH_TABS() {
      window.electron.ipcRenderer.on('mt::switch-tab-by-index', (_, index) => {
        this.SWITCH_TAB_BY_INDEX(index)
      })
      window.electron.ipcRenderer.on('mt::switch-tab-by-file_path', (_, filePath) => {
        this.SWITCH_TAB_BY_FILEPATH(filePath)
      })
    },

    FORCE_CLOSE_TAB(file) {
      const { tabs, currentFile } = this
      const index = tabs.findIndex((t) => t.id === file.id)
      if (index > -1) {
        tabs.splice(index, 1)
        this.updateTabIdToIndex()
      }

      if (file.id && autoSaveTimers.has(file.id)) {
        const timer = autoSaveTimers.get(file.id)
        clearTimeout(timer)
        autoSaveTimers.delete(file.id)
      }

      this.updateTabIdToIndex() // Update before sending it out to prevent stale mappings.

      if (file.id === currentFile.id) {
        const fileState = this.tabs[index] || this.tabs[index - 1] || this.tabs[0] || {}
        this.currentFile = fileState
        if (typeof fileState.markdown === 'string') {
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
      debouncedSendBufferedState()
    },

    CLOSE_UNSAVED_TAB(file) {
      const { id, pathname, filename, markdown } = file
      const options = getOptionsFromState(file)
      window.electron.ipcRenderer.send('mt::save-and-close-tabs', [
        { id, pathname, filename, markdown, options: deepClone(options) }
      ])
    },

    CLOSE_OTHER_TABS(file) {
      this.tabs
        .filter((f) => f.id !== file.id)
        .forEach((tab) => {
          this.CLOSE_TAB(tab)
        })
    },

    CLOSE_SAVED_TABS() {
      this.tabs
        .filter((f) => f.isSaved)
        .forEach((tab) => {
          this.CLOSE_TAB(tab)
        })
    },

    CLOSE_ALL_TABS() {
      this.tabs.slice().forEach((tab) => {
        this.CLOSE_TAB(tab)
      })
    },

    CLOSE_TABS(tabIdList) {
      if (!tabIdList || tabIdList.length === 0) return

      let tabIndex = 0
      tabIdList.forEach((id) => {
        const index = this.tabs.findIndex((f) => f.id === id)
        if (index === -1) return

        const { pathname } = this.tabs[index]

        if (pathname) {
          window.electron.ipcRenderer.send('mt::window-tab-closed', pathname)
        }

        this.tabs.splice(index, 1)
        if (this.currentFile.id === id) {
          this.currentFile = {}
          window.DIRNAME = ''
          if (tabIdList.length === 1) {
            tabIndex = index
          }
        }
      })

      this.updateTabIdToIndex() // Update before sending it out to prevent stale mappings.

      if (!this.currentFile.id && this.tabs.length > 0) {
        this.currentFile = this.tabs[tabIndex] || this.tabs[tabIndex - 1] || this.tabs[0] || {}
        if (typeof this.currentFile.markdown === 'string') {
          const { id, markdown, cursor, history, pathname, scrollTop, blocks, muyaIndexCursor } =
            this.currentFile
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
        }
      }

      if (this.tabs.length === 0) {
        this.listToc = []
        this.toc = []
      }
      debouncedSendBufferedState()
    },

    EXCHANGE_TABS_BY_ID(tabIDs) {
      const { fromId, toId } = tabIDs
      const { tabs } = this
      const moveItem = (arr, from, to) => {
        if (from === to) return true
        const len = arr.length
        const item = arr.splice(from, 1)
        if (item.length === 0) return false

        arr.splice(to, 0, item[0])
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
      debouncedSendBufferedState()
    },

    RENAME_FILE(file) {
      this.UPDATE_CURRENT_FILE(file)
      bus.emit('rename')
    },

    // Direction is a boolean where false is left and true right.
    CYCLE_TABS(direction) {
      const { tabs, currentFile } = this
      if (tabs.length <= 1) {
        return
      }

      const currentIndex = tabs.findIndex((t) => t.id === currentFile.id)
      if (currentIndex === -1) {
        console.error('CYCLE_TABS: Cannot find current tab index.')
        return
      }

      let nextTabIndex = 0
      if (!direction) {
        // Switch tab to the left.
        nextTabIndex = currentIndex === 0 ? tabs.length - 1 : currentIndex - 1
      } else {
        // Switch tab to the right.
        nextTabIndex = (currentIndex + 1) % tabs.length
      }

      const nextTab = tabs[nextTabIndex]
      if (!nextTab || !nextTab.id) {
        console.error(`CYCLE_TABS: Cannot find next tab (index="${nextTabIndex}").`)
        return
      }

      this.UPDATE_CURRENT_FILE(nextTab)
    },

    SWITCH_TAB_BY_FILEPATH(filePath) {
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
      this.UPDATE_CURRENT_FILE(tabs[nextTabIndex])
    },

    SWITCH_TAB_BY_INDEX(nextTabIndex) {
      const { tabs, currentFile } = this
      if (nextTabIndex < 0 || nextTabIndex >= tabs.length) {
        console.warn('Invalid tab index:', nextTabIndex)
        return
      }

      const currentIndex = tabs.findIndex((t) => t.id === currentFile.id)
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

    /**
     * Create a new untitled tab optional from a markdown string.
     *
     * @param {*} _ The store context - not used.
     * @param {{markdown?: string, selected?: boolean}} obj Optional markdown string
     * and whether the tab should become the selected tab (true if not set).
     */
    NEW_UNTITLED_TAB({ markdown: markdownString, selected }) {
      if (selected == null) {
        selected = true
      }

      this.SHOW_TAB_VIEW(false)

      const preferencesStore = usePreferencesStore()
      const { defaultEncoding, endOfLine } = preferencesStore
      const fileState = getBlankFileState(this.tabs, defaultEncoding, endOfLine, markdownString)

      if (selected) {
        const { id, markdown } = fileState
        this.UPDATE_CURRENT_FILE(fileState)
        bus.emit('file-loaded', { id, markdown })
      } else {
        this.tabs.push(fileState)
        this.updateTabIdToIndex()
        debouncedSendBufferedState()
      }
    },

    /**
     * Create a new tab from the given markdown document.
     *
     * @param {*} _ The store context - not used.
     * @param {{markdownDocument: IMarkdownDocumentRaw, selected?: boolean}} obj The markdown document
     * and optional whether the tab should become the selected tab (true if not set).
     */
    NEW_TAB_WITH_CONTENT({ markdownDocument, options = {}, selected }) {
      if (!markdownDocument) {
        console.warn('Cannot create a file tab without a markdown document!')
        this.NEW_UNTITLED_TAB({})
        return
      }

      if (typeof selected === 'undefined') {
        selected = true
      }

      const { currentFile, tabs } = this
      const { pathname } = markdownDocument
      const existingTab = tabs.find((t) => window.fileUtils.isSamePathSync(t.pathname, pathname))
      if (existingTab) {
        this.UPDATE_CURRENT_FILE(existingTab)
        return
      }

      let keepTabBarState = false
      if (currentFile) {
        const { isSaved, pathname } = currentFile
        if (isSaved && !pathname) {
          keepTabBarState = true
          this.FORCE_CLOSE_TAB(currentFile)
        }
      }

      if (!keepTabBarState) {
        this.SHOW_TAB_VIEW(false)
      }

      const { markdown, isMixedLineEndings } = markdownDocument
      const docState = createDocumentState(Object.assign(markdownDocument, options))
      const { id, cursor } = docState

      if (selected) {
        this.UPDATE_CURRENT_FILE(docState)
        bus.emit('file-loaded', { id, markdown, cursor })
      } else {
        this.tabs.push(docState)
        this.updateTabIdToIndex()
        debouncedSendBufferedState()
      }

      if (isMixedLineEndings) {
        const { filename, lineEnding } = markdownDocument
        this.pushTabNotification({
          tabId: id,
          msg: i18n.global.t('store.editor.mixedLineEndingsNormalized', {
            name: filename,
            lineEnding: lineEnding.toUpperCase()
          })
        })
      }
    },

    SHOW_TAB_VIEW(always) {
      const { tabs } = this
      const layoutStore = useLayoutStore()
      if (always || tabs.length === 1) {
        layoutStore.SET_LAYOUT({ showTabBar: true })
        layoutStore.DISPATCH_LAYOUT_MENU_ITEMS()
      }
    },

    SET_SAVE_STATUS_WHEN_REMOVE({ pathname }) {
      let didUpdateSaveStatus = false
      this.tabs.forEach((f) => {
        if (f.pathname === pathname) {
          f.isSaved = false
          didUpdateSaveStatus = true
        }
      })
      if (didUpdateSaveStatus) {
        debouncedSendBufferedState()
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
    }) {
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

      const { filename, pathname, markdown: oldMarkdown, trimTrailingNewline } = tab

      markdown = adjustTrailingNewlines(markdown, trimTrailingNewline)
      tab.markdown = markdown

      if (oldMarkdown.length === 0 && markdown.length === 1 && markdown[0] === '\n') {
        debouncedSendBufferedState()
        return
      }

      if (wordCount) tab.wordCount = wordCount
      if (cursor) tab.cursor = cursor
      if (muyaIndexCursor) tab.muyaIndexCursor = muyaIndexCursor
      if (history) tab.history = history
      if (blocks) tab.blocks = blocks

      // Only update TOC if it's the current file
      if (id === this.currentFile.id && toc && !equal(toc, this.listToc)) {
        this.listToc = toc
        this.toc = listToTree(toc)
      }

      if (
        (tab.history.lastEditIndex >= 0 &&
          tab.history.stack[tab.history.lastEditIndex].id !== tab.lastSavedHistoryId) ||
        (tab.history.lastEditIndex === -1 &&
          tab.lastSavedHistoryId !== -1 &&
          tab.lastSavedHistoryId !== tab.history.lastInitIndex) // Edge Case: Undo to original content (lastEditIndex === -1) after saving means we cant use the lastEditIndex. Compare it against the lastInitIndex instead.
      ) {
        tab.isSaved = false
        if (pathname && autoSave) {
          const options = getOptionsFromState(tab)
          this.HANDLE_AUTO_SAVE({
            id,
            filename,
            pathname,
            markdown,
            options
          })
        }
      } else if (tab.lastSavedHistoryId !== -1) {
        // Check here is to prevent it from overriding a restored .isSaved state
        tab.isSaved = true // An undo can trigger this
      }
      debouncedSendBufferedState()
    },

    HANDLE_AUTO_SAVE({ id, filename, pathname, markdown, options }) {
      if (!id || !pathname) {
        throw new Error('HANDLE_AUTO_SAVE: Invalid tab.')
      }

      const preferencesStore = usePreferencesStore()
      const projectStore = useProjectStore()
      const { autoSaveDelay } = preferencesStore

      if (autoSaveTimers.has(id)) {
        const timer = autoSaveTimers.get(id)
        clearTimeout(timer)
        autoSaveTimers.delete(id)
      }

      const timer = setTimeout(() => {
        autoSaveTimers.delete(id)

        const tab = this.tabs.find((t) => t.id === id)
        if (tab && !tab.isSaved) {
          const defaultPath = getRootFolderFromState(projectStore)
          window.electron.ipcRenderer.send(
            'mt::response-file-save',
            id,
            filename,
            pathname,
            markdown,
            deepClone(options),
            defaultPath
          )
        }
      }, autoSaveDelay)
      autoSaveTimers.set(id, timer)
    },

    SELECTION_CHANGE(changes) {
      const { start, end } = changes
      if (start.key === end.key && start.block.text) {
        const value = start.block.text.substring(start.offset, end.offset)
        this.currentFile.searchMatches = {
          matches: [],
          index: -1,
          value
        }
      }

      const { windowId } = global.marktext.env
      window.electron.ipcRenderer.send(
        'mt::editor-selection-changed',
        windowId,
        createApplicationMenuState(changes)
      )
    },

    SELECTION_FORMATS(formats) {
      const { windowId } = global.marktext.env
      window.electron.ipcRenderer.send(
        'mt::update-format-menu',
        windowId,
        createSelectionFormatState(formats)
      )
    },

    EXPORT({ type, content, pageOptions }) {
      if (!hasKeys(this.currentFile)) return

      let title = ''
      const { listToc } = this
      if (listToc && listToc.length > 0) {
        let headerRef = listToc[0]
        const len = Math.min(listToc.length, 6)
        for (let i = 1; i < len; ++i) {
          if (headerRef.lvl === 1) break
          const header = listToc[i]
          if (headerRef.lvl > header.lvl) {
            headerRef = header
          }
        }
        title = headerRef.content
      }

      const { filename, pathname } = this.currentFile
      window.electron.ipcRenderer.send('mt::response-export', {
        type,
        title,
        content,
        filename,
        pathname,
        pageOptions
      })
    },

    LINTEN_FOR_EXPORT_SUCCESS() {
      window.electron.ipcRenderer.on('mt::export-success', (_, { filePath }) => {
        notice
          .notify({
            title: i18n.global.t('store.editor.exportSuccessTitle'),
            message: i18n.global.t('store.editor.exportSuccessMessage', {
              name: window.path.basename(filePath)
            }),
            showConfirm: true
          })
          .then(() => {
            window.electron.shell.showItemInFolder(filePath)
          })
      })
    },

    PRINT_RESPONSE() {
      window.electron.ipcRenderer.send('mt::response-print')
    },

    LINTEN_FOR_PRINT_SERVICE_CLEARUP() {
      window.electron.ipcRenderer.on('mt::print-service-clearup', () => {
        bus.emit('print-service-clearup')
      })
    },

    SET_LINE_ENDING(lineEnding) {
      const { lineEnding: oldLineEnding } = this.currentFile
      if (lineEnding !== oldLineEnding) {
        this.currentFile.lineEnding = lineEnding
        this.currentFile.adjustLineEndingOnSave = lineEnding !== 'lf'
        this.currentFile.isSaved = true
        this.UPDATE_LINE_ENDING_MENU()
        debouncedSendBufferedState()
      }
    },

    LINTEN_FOR_SET_LINE_ENDING() {
      window.electron.ipcRenderer.on('mt::set-line-ending', (_, lineEnding) => {
        this.SET_LINE_ENDING(lineEnding)
      })
      bus.on('mt::set-line-ending', (lineEnding) => {
        this.SET_LINE_ENDING(lineEnding)
      })
    },

    LINTEN_FOR_SET_ENCODING() {
      bus.on('mt::set-file-encoding', (encodingName) => {
        const { encoding } = this.currentFile.encoding
        if (encoding !== encodingName) {
          this.currentFile.encoding.encoding = encodingName
          this.currentFile.encoding.isBom = false
          this.currentFile.isSaved = true
          debouncedSendBufferedState()
        }
      })
    },

    LINTEN_FOR_SET_FINAL_NEWLINE() {
      bus.on('mt::set-final-newline', (value) => {
        const { trimTrailingNewline } = this.currentFile
        if (trimTrailingNewline !== value) {
          this.currentFile.trimTrailingNewline = value
          this.currentFile.isSaved = true
          debouncedSendBufferedState()
        }
      })
    },

    LISTEN_FOR_FILE_CHANGE() {
      const preferencesStore = usePreferencesStore()
      window.electron.ipcRenderer.on('mt::update-file', (_, { type, change }) => {
        const { tabs } = this
        const { pathname } = change
        const tab = tabs.find((t) => window.fileUtils.isSamePathSync(t.pathname, pathname))
        if (tab) {
          const { id, isSaved, filename } = tab
          switch (type) {
            case 'unlink': {
              tab.isSaved = false
              this.pushTabNotification({
                tabId: id,
                msg: i18n.global.t('store.editor.fileRemovedOnDisk', { name: filename }),
                style: 'warn',
                showConfirm: false,
                exclusiveType: 'file_changed'
              })
              debouncedSendBufferedState()
              break
            }
            case 'add':
            case 'change': {
              const { autoSave } = preferencesStore
              if (autoSave) {
                if (autoSaveTimers.has(id)) {
                  const timer = autoSaveTimers.get(id)
                  clearTimeout(timer)
                  autoSaveTimers.delete(id)
                }

                if (isSaved) {
                  this.loadChange(change)
                  return
                }
              }

              tab.isSaved = false
              this.pushTabNotification({
                tabId: id,
                msg: i18n.global.t('store.editor.fileChangedOnDisk', { name: filename }),
                showConfirm: true,
                exclusiveType: 'file_changed',
                action: (status) => {
                  if (status) {
                    this.loadChange(change)
                  }
                }
              })
              debouncedSendBufferedState()
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

    ASK_FOR_IMAGE_PATH() {
      return window.electron.ipcRenderer.sendSync('mt::ask-for-image-path')
    },

    EDIT_ZOOM(zoomFactor) {
      const preferencesStore = usePreferencesStore()
      zoomFactor = Number.parseFloat(zoomFactor.toFixed(3))
      const { zoom } = preferencesStore
      if (zoom !== zoomFactor) {
        preferencesStore.SET_SINGLE_PREFERENCE({ type: 'zoom', value: zoomFactor })
      }
      window.electron.webFrame.setZoomFactor(zoomFactor)
    },

    LISTEN_WINDOW_ZOOM() {
      window.electron.ipcRenderer.on('mt::window-zoom', (_, zoomFactor) => {
        this.EDIT_ZOOM(zoomFactor)
      })
      bus.on('mt::window-zoom', (zoomFactor) => {
        this.EDIT_ZOOM(zoomFactor)
      })
    },

    LISTEN_FOR_RELOAD_IMAGES() {
      window.electron.ipcRenderer.on('mt::invalidate-image-cache', () => {
        bus.emit('invalidate-image-cache')
      })
    },

    LISTEN_FOR_CONTEXT_MENU() {
      // General context menu
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

      // Spelling
      window.electron.ipcRenderer.on('mt::spelling-replace-misspelling', (_, info) => {
        bus.emit('replace-misspelling', info)
      })
      window.electron.ipcRenderer.on('mt::spelling-show-switch-language', () => {
        bus.emit('open-command-spellchecker-switch-language')
      })
    },

    LISTEN_FOR_STATE_REPLACE() {
      window.electron.ipcRenderer.on('mt::load-state', (_, state) => {
        this.RESTORE_BUFFERED_STATE(state)
      })
    }
  }
})

// ----------------------------------------------------------------------------

/**
 * Return the opened root folder or an empty string.
 *
 * @param {object} projectStore The project store instance.
 */
const getRootFolderFromState = (projectStore) => {
  const openedFolder = projectStore.projectTree
  if (openedFolder) {
    return openedFolder.pathname
  }
  return ''
}

/**
 * Trim the final newlines according `trimTrailingNewlineOption`.
 *
 * @param {string} markdown The text to trim.
 * @param {*} trimTrailingNewlineOption The option how we should trim the final newlines.
 */
const adjustTrailingNewlines = (markdown, trimTrailingNewlineOption) => {
  if (!markdown) {
    return ''
  }

  switch (trimTrailingNewlineOption) {
    // Trim trailing newlines.
    case 0: {
      return trimTrailingNewlines(markdown)
    }
    // Ensure single trailing newline.
    case 1: {
      // Muya will always add a final new line to the markdown text. Check first whether
      // only one newline exist to prevent copying the string.
      const lastIndex = markdown.length - 1
      if (markdown[lastIndex] === '\n') {
        if (markdown.length === 1) {
          // Just return nothing because adding a final new line makes no sense.
          return ''
        } else if (markdown[lastIndex - 1] !== '\n') {
          return markdown
        }
      }

      // Otherwise trim trailing newlines and add one.
      markdown = trimTrailingNewlines(markdown)
      if (markdown.length === 0) {
        // Just return nothing because adding a final new line makes no sense.
        return ''
      }
      return markdown + '\n'
    }
    // Disabled, use text as it is.
    default:
      return markdown
  }
}

/**
 * Trim trailing newlines from `text`.
 *
 * @param {string} text The text to trim.
 */
const trimTrailingNewlines = (text) => {
  return text.replace(/[\r?\n]+$/, '')
}

/**
 * Creates a object that contains the application menu state.
 *
 * @param {*} selection The selection.
 * @returns A object that represents the application menu state.
 */
const createApplicationMenuState = ({ start, end, affiliation }) => {
  const state = {
    isDisabled: false,
    // Whether multiple lines are selected.
    isMultiline: start.key !== end.key,
    // List information - a list must be selected.
    isLooseListItem: false,
    isTaskList: false,
    // Whether the selection is code block like (math, html or code block).
    isCodeFences: false,
    // Whether a code block line is selected.
    isCodeContent: false,
    // Whether the selection contains a table.
    isTable: false,
    // Contains keys about the selection type(s) (string, boolean) like "ul: true".
    affiliation: {}
  }
  const { isMultiline } = state

  // Get code block information from selection.
  if (
    (start.block.functionType === 'cellContent' && end.block.functionType === 'cellContent') ||
    (start.type === 'span' && start.block.functionType === 'codeContent') ||
    (end.type === 'span' && end.block.functionType === 'codeContent')
  ) {
    // A code block like block is selected (code, math, ...).
    state.isCodeFences = true

    // A code block line is selected.
    if (start.block.functionType === 'codeContent' || end.block.functionType === 'codeContent') {
      state.isCodeContent = true
    }
  }

  // Query list information.
  if (affiliation.length >= 1 && /ul|ol/.test(affiliation[0].type)) {
    const listBlock = affiliation[0]
    state.affiliation[listBlock.type] = true
    state.isLooseListItem = listBlock.children[0].isLooseListItem
    state.isTaskList = listBlock.listType === 'task'
  } else if (affiliation.length >= 3 && affiliation[1].type === 'li') {
    const listItem = affiliation[1]
    const listType = listItem.listItemType === 'order' ? 'ol' : 'ul'
    state.affiliation[listType] = true
    state.isLooseListItem = listItem.isLooseListItem
    state.isTaskList = listItem.listItemType === 'task'
  }

  // Search with block depth 3 (e.g. "ul -> li -> p" where p is the actually paragraph inside the list (item)).
  for (const b of affiliation.slice(0, 3)) {
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
      }
      break
    } else if (isMultiline && /^h{1,6}$/.test(b.type)) {
      // Multiple block elements are selected.
      state.affiliation = {}
      break
    } else {
      if (!state.affiliation[b.type]) {
        state.affiliation[b.type] = true
      }
    }
  }

  // Clean up
  if (Object.getOwnPropertyNames(state.affiliation).length >= 2 && state.affiliation.p) {
    delete state.affiliation.p
  }
  if ((state.affiliation.ul || state.affiliation.ol) && state.affiliation.li) {
    delete state.affiliation.li
  }
  return state
}

/**
 * Creates a object that contains the formats selection state.
 *
 * @param {*} formats The selection formats.
 * @returns A object that represents the formats menu state.
 */
const createSelectionFormatState = (formats) => {
  const state = {}
  for (const item of formats) {
    state[item.type] = true
  }
  return state
}

/*
 * Convert a Pinia Proxy Object to a serializable value by applying JSON stringify and parse.
 */
const toSerializableValue = (value, fallback = null) => {
  if (value == null) return fallback

  try {
    return JSON.parse(JSON.stringify(value))
  } catch (err) {
    console.warn('Unable to serialize editor buffer value:', err)
    return fallback
  }
}

const createBufferedTabState = (tab) => {
  return {
    id: tab.id,
    pathname: tab.pathname ?? defaultFileState.pathname,
    filename: tab.filename ?? defaultFileState.filename,
    markdown: typeof tab.markdown === 'string' ? tab.markdown : defaultFileState.markdown,
    isSaved: tab.isSaved ?? defaultFileState.isSaved,
    encoding: toSerializableValue(tab.encoding, defaultFileState.encoding),
    lineEnding: tab.lineEnding ?? defaultFileState.lineEnding,
    trimTrailingNewline:
      typeof tab.trimTrailingNewline === 'number'
        ? tab.trimTrailingNewline
        : defaultFileState.trimTrailingNewline,
    adjustLineEndingOnSave: tab.adjustLineEndingOnSave ?? defaultFileState.adjustLineEndingOnSave,
    cursor: toSerializableValue(tab.cursor, defaultFileState.cursor),
    wordCount: toSerializableValue(tab.wordCount, defaultFileState.wordCount),
    muyaIndexCursor: toSerializableValue(tab.muyaIndexCursor, defaultFileState.muyaIndexCursor),
    scrollTop: tab.scrollTop ?? defaultFileState.scrollTop
  }
}

const createBufferedRestoreWarning = (warning) => {
  if (!warning) return null

  const { tabId, pathname, msg, showConfirm, style, exclusiveType } = warning
  if (!tabId && !pathname) return null
  if (!msg) return null

  return {
    tabId: tabId || null,
    pathname: pathname || '',
    msg,
    showConfirm: !!showConfirm,
    style: style || 'info',
    exclusiveType: exclusiveType || ''
  }
}

const createBufferedEditorState = (state) => {
  if (!state || !Array.isArray(state.tabs)) {
    return null
  }

  return {
    currentFileId: state.currentFileId || state.currentFile?.id || null,
    tabs: state.tabs.map(createBufferedTabState),
    restoreWarnings: Array.isArray(state.restoreWarnings)
      ? state.restoreWarnings.map(createBufferedRestoreWarning).filter(Boolean)
      : []
  }
}
