import { ipcRenderer } from 'electron'
import path from 'path'
import bus from '../bus'
import { getOptionsFromState, getSingleFileState, getBlankFileState } from './help'

const state = {
  currentFile: {},
  tabs: []
}

const getters = {}

const mutations = {
  // set search key and matches also index
  SET_SEARCH (state, value) {
    state.currentFile.searchMatches = value
  },
  SET_CURRENT_FILE (state, currentFile) {
    const oldCurrentFile = state.currentFile
    if (!oldCurrentFile.id || oldCurrentFile.id !== currentFile.id) {
      const { markdown, cursor, history } = currentFile
      bus.$emit('file-changed', { markdown, cursor, renderCursor: true, history })
      state.currentFile = currentFile
    }
  },
  ADD_FILE_TO_TABS (state, currentFile) {
    state.tabs.push(currentFile)
  },
  SET_FILENAME (state, filename) {
    state.currentFile.filename = filename
  },
  SET_PATHNAME (state, pathname) {
    window.__dirname = path.dirname(pathname)
    state.currentFile.pathname = pathname
  },
  SET_SAVE_STATUS (state, status) {
    state.currentFile.isSaved = status
  },
  SET_MARKDOWN (state, markdown) {
    state.currentFile.markdown = markdown
  },
  SET_IS_UTF8_BOM_ENCODED (state, isUtf8BomEncoded) {
    state.currentFile.isUtf8BomEncoded = isUtf8BomEncoded
  },
  SET_LINE_ENDING (state, lineEnding) {
    state.currentFile.lineEnding = lineEnding
  },
  SET_ADJUST_LINE_ENDING_ON_SAVE (state, adjustLineEndingOnSave) {
    state.currentFile.adjustLineEndingOnSave = adjustLineEndingOnSave
  },
  SET_WORD_COUNT (state, wordCount) {
    state.currentFile.wordCount = wordCount
  },
  SET_CURSOR (state, cursor) {
    state.currentFile.cursor = cursor
  },
  SET_HISTORY (state, history) {
    state.currentFile.history = history
  }
}

const actions = {
  // when cursor in `![](cursor)`, insert image popup will be shown! `absolute` or `relative`
  ASK_FOR_INSERT_IMAGE ({ commit }, type) {
    ipcRenderer.send('AGANI::ask-for-insert-image', type)
  },
  // image path auto complement
  ASK_FOR_IMAGE_AUTO_PATH ({ commit, state }, src) {
    const { pathname } = state.currentFile
    if (pathname) {
      ipcRenderer.send('AGANI::ask-for-image-auto-path', { pathname, src })
    }
  },

  SEARCH ({ commit }, value) {
    commit('SET_SEARCH', value)
  },

  // need update line ending when change between windows.
  LISTEN_FOR_LINEENDING_MENU ({ commit, state, dispatch }) {
    ipcRenderer.on('AGANI::req-update-line-ending-menu', e => {
      dispatch('UPDATE_LINEENDING_MENU')
    })
  },

  // need update line ending when change between tabs
  UPDATE_LINEENDING_MENU ({ commit, state }) {
    const { lineEnding } = state.currentFile
    ipcRenderer.send('AGANI::update-line-ending-menu', lineEnding)
  },

  // need pass some data to main process when `save` menu item clicked
  LISTEN_FOR_SAVE ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-save', () => {
      const { pathname, markdown } = state.currentFile
      const options = getOptionsFromState(state)
      ipcRenderer.send('AGANI::response-file-save', { pathname, markdown, options })
    })
  },

  // need pass some data to main process when `save as` menu item clicked
  LISTEN_FOR_SAVE_AS ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-save-as', () => {
      const { pathname, markdown } = state.currentFile
      const options = getOptionsFromState(state)
      ipcRenderer.send('AGANI::response-file-save-as', { pathname, markdown, options })
    })
  },

  LISTEN_FOR_MOVE_TO ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-move-to', () => {
      const { pathname, markdown } = state.currentFile
      const options = getOptionsFromState(state)
      if (!pathname) {
        // if current file is a newly created file, just save it!
        ipcRenderer.send('AGANI::response-file-save', { pathname, markdown, options })
      } else {
        // if not, move to a new(maybe) folder
        ipcRenderer.send('AGANI::response-file-move-to', { pathname })
      }
    })
  },

  LISTEN_FOR_RENAME ({ commit, state, dispatch }) {
    ipcRenderer.on('AGANI::ask-file-rename', () => {
      dispatch('RESPONSE_FOR_RENAME')
    })
  },

  RESPONSE_FOR_RENAME ({ commit, state }) {
    const { pathname, markdown } = state.currentFile
    const options = getOptionsFromState(state)
    if (!pathname) {
      // if current file is a newly created file, just save it!
      ipcRenderer.send('AGANI::response-file-save', { pathname, markdown, options })
    } else {
      bus.$emit('rename')
    }
  },

  // ask for main process to rename this file to a new name `newFilename`
  RENAME ({ commit, state }, newFilename) {
    const { pathname, filename } = state.currentFile
    if (filename !== newFilename) {
      const newPathname = path.join(path.dirname(pathname), newFilename)
      ipcRenderer.send('AGANI::rename', { pathname, newPathname })
    }
  },

  LISTEN_FOR_SET_FILENAME ({ commit, state }) {
    ipcRenderer.on('AGANI::set-pathname', (e, { pathname, filename }) => {
      commit('SET_FILENAME', filename)
      commit('SET_PATHNAME', pathname)
      commit('SET_SAVE_STATUS', true)
    })
  },

  UPDATE_CURRENT_FILE ({ commit, state }, currentFile) {
    commit('SET_CURRENT_FILE', currentFile)
    const { tabs } = state
    if (!tabs.some(file => file.id === currentFile.id)) {
      commit('ADD_FILE_TO_TABS', currentFile)
    }
  },

  LISTEN_FOR_OPEN_SINGLE_FILE ({ commit, state, dispatch }) {
    ipcRenderer.on('AGANI::open-single-file', (e, { markdown, filename, pathname, options }) => {
      const fileState = getSingleFileState({ markdown, filename, pathname, options })
      dispatch('UPDATE_CURRENT_FILE', fileState)
      bus.$emit('file-loaded', markdown)
    })
  },

  LISTEN_FOR_OPEN_BLANK_WINDOW ({ commit, state, dispatch }) {
    ipcRenderer.on('AGANI::open-blank-window', (e, { lineEnding }) => {
      const { tabs } = state
      const fileState = getBlankFileState(tabs, lineEnding)
      const { markdown } = fileState
      dispatch('UPDATE_CURRENT_FILE', fileState)
      bus.$emit('file-loaded', markdown)
    })
  },

  // LISTEN_FOR_FILE_CHANGE ({ commit, state }) {
  //   ipcRenderer.on('AGANI::file-change', (e, { file, filename, pathname }) => {
  //     const { windowActive } = state
  //     commit('SET_FILENAME', filename)
  //     commit('SET_PATHNAME', pathname)
  //     commit('SET_MARKDOWN', file)
  //     commit('SET_SAVE_STATUS', true)
  //     if (!windowActive) {
  //       bus.$emit('file-loaded', file)
  //     }
  //   })
  // },

  // Content change from realtime preview editor and source code editor
  LISTEN_FOR_CONTENT_CHANGE ({ commit, state, rootState }, { markdown, wordCount, cursor, history }) {
    const { autoSave } = rootState.preferences
    const { pathname, markdown: oldMarkdown } = state.currentFile
    const options = getOptionsFromState(state)
    commit('SET_MARKDOWN', markdown)
    // set word count
    if (wordCount) commit('SET_WORD_COUNT', wordCount)
    // set cursor
    if (cursor) commit('SET_CURSOR', cursor)
    // set history
    if (history) commit('SET_HISTORY', history)
    // change save status/save to file only when the markdown changed!
    if (markdown !== oldMarkdown) {
      if (pathname && autoSave) {
        ipcRenderer.send('AGANI::response-file-save', { pathname, markdown, options })
      } else {
        commit('SET_SAVE_STATUS', false)
      }
    }
  },

  LISTEN_FOR_FILE_SAVED_SUCCESSFULLY ({ commit }) {
    ipcRenderer.on('AGANI::file-saved-successfully', e => {
      commit('SET_SAVE_STATUS', true)
    })
  },

  SELECTION_CHANGE ({ commit }, changes) {
    const { start, end } = changes
    if (start.key === end.key && start.block.text) {
      const value = start.block.text.substring(start.offset, end.offset)
      commit('SET_SEARCH', {
        matches: [],
        index: -1,
        value
      })
    }

    ipcRenderer.send('AGANI::selection-change', changes)
  },

  SELECTION_FORMATS ({ commit }, formats) {
    ipcRenderer.send('AGANI::selection-formats', formats)
  },

  // listen for export from main process
  LISTEN_FOR_EXPORT ({ commit, state }) {
    ipcRenderer.on('AGANI::export', (e, { type }) => {
      bus.$emit('export', type)
    })
  },

  EXPORT ({ commit, state }, { type, content }) {
    const { filename, pathname } = state.currentFile
    ipcRenderer.send('AGANI::response-export', { type, content, filename, pathname })
  },

  LISTEN_FOR_INSERT_IMAGE ({ commit, state }) {
    ipcRenderer.on('AGANI::INSERT_IMAGE', (e, { filename: imagePath, type }) => {
      if (type === 'absolute' || type === 'relative') {
        const { pathname } = state.currentFile
        if (type === 'relative' && pathname) {
          imagePath = path.relative(path.dirname(pathname), imagePath)
        }
        bus.$emit('insert-image', imagePath)
      } else {
        // upload to CM
        bus.$emit('upload-image')
      }
    })
  },

  LISTEN_FOR_CLOSE ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-for-close', e => {
      const { isSaved, markdown, pathname, filename } = state.currentFile
      const options = getOptionsFromState(state)
      if (!isSaved && /[^\n]/.test(markdown)) {
        ipcRenderer.send('AGANI::response-close-confirm', { filename, pathname, markdown, options })
      } else {
        ipcRenderer.send('AGANI::close-window')
      }
    })
  },

  LINTEN_FOR_SET_LINE_ENDING ({ commit, state }) {
    ipcRenderer.on('AGANI::set-line-ending', (e, { lineEnding, ignoreSaveStatus }) => {
      const { lineEnding: oldLineEnding } = state.currentFile
      if (lineEnding !== oldLineEnding) {
        commit('SET_LINE_ENDING', lineEnding)
        commit('SET_ADJUST_LINE_ENDING_ON_SAVE', lineEnding !== 'lf')
        if (!ignoreSaveStatus) {
          commit('SET_SAVE_STATUS', false)
        }
      }
    })
  }
}

export default { state, getters, mutations, actions }
