import { ipcRenderer } from 'electron'
import path from 'path'
import bus from '../bus'

const state = {
  filename: 'Untitled - unsaved',
  searchMatches: {
    index: -1,
    matches: [],
    value: ''
  },
  pathname: '',
  isSaved: true,
  markdown: '',
  windowActive: true,
  wordCount: {
    paragraph: 0,
    word: 0,
    character: 0,
    all: 0
  }
}

const mutations = {
  SET_SEARCH (state, value) {
    state.searchMatches = value
  },
  SET_WIN_STATUS (state, status) {
    state.windowActive = status
  },
  SET_FILENAME (state, filename) {
    state.filename = filename
  },
  SET_PATHNAME (state, pathname) {
    window.__dirname = path.dirname(pathname)
    state.pathname = pathname
  },
  SET_STATUS (state, status) {
    state.isSaved = status
  },
  SET_MARKDOWN (state, markdown) {
    state.markdown = markdown
  },
  SET_WORD_COUNT (state, wordCount) {
    state.wordCount = wordCount
  }
}

const actions = {
  SEARCH ({ commit }, value) {
    commit('SET_SEARCH', value)
  },
  LINTEN_WIN_STATUS ({ commit }) {
    ipcRenderer.on('AGANI::window-active-status', (e, { status }) => {
      commit('SET_WIN_STATUS', status)
    })
  },
  LISTEN_FOR_SAVE ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-save', () => {
      const { pathname, markdown } = state
      ipcRenderer.send('AGANI::response-file-save', { pathname, markdown })
    })
  },
  LISTEN_FOR_SAVE_AS ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-save-as', () => {
      const { pathname, markdown } = state
      ipcRenderer.send('AGANI::response-file-save-as', { pathname, markdown })
    })
  },
  GET_FILENAME ({ commit, state }) {
    ipcRenderer.on('AGANI::set-pathname', (e, { pathname, filename }) => {
      commit('SET_FILENAME', filename)
      commit('SET_PATHNAME', pathname)
      commit('SET_STATUS', true)
    })
  },
  LISTEN_FOR_FILE_LOAD ({ commit, state }) {
    ipcRenderer.on('AGANI::file-loaded', (e, { file, filename, pathname }) => {
      commit('SET_FILENAME', filename)
      commit('SET_PATHNAME', pathname)
      commit('SET_MARKDOWN', file)
      commit('SET_STATUS', true)
      bus.$emit('file-loaded', file)
    })
  },
  LISTEN_FOR_FILE_CHANGE ({ commit, state }) {
    ipcRenderer.on('AGANI::file-change', (e, { file, filename, pathname }) => {
      const { windowActive } = state
      commit('SET_FILENAME', filename)
      commit('SET_PATHNAME', pathname)
      commit('SET_MARKDOWN', file)
      commit('SET_STATUS', true)
      if (!windowActive) {
        bus.$emit('file-loaded', file)
      }
    })
  },
  EDITE_FILE ({ commit }) {
    commit('SET_STATUS', false)
  },
  EXPORT ({ commit, state }, { type, content }) {
    const { filename, pathname } = state
    ipcRenderer.send('AGANI::response-export', { type, content, filename, pathname })
  },
  SAVE_FILE ({ commit, state }, { markdown, wordCount }) {
    commit('SET_MARKDOWN', markdown)
    commit('SET_WORD_COUNT', wordCount)
    const { pathname } = state
    if (pathname) {
      commit('SET_STATUS', true)
      ipcRenderer.send('AGANI::response-file-save', { pathname, markdown })
    } else {
      commit('SET_STATUS', false)
    }
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
  LISTEN_FOR_EDIT ({ commit }) {
    ipcRenderer.on('AGANI::edit', (e, { type }) => {
      bus.$emit(type)
    })
  },
  LISTEN_FOR_PARAGRAPH_INLINE_STYLE ({ commit }) {
    ipcRenderer.on('AGANI::paragraph', (e, { type }) => {
      bus.$emit('paragraph', type)
    })
    ipcRenderer.on('AGANI::format', (e, { type }) => {
      bus.$emit('format', type)
    })
  },
  LISTEN_FOR_CLOSE ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-for-close', e => {
      const { isSaved, markdown, pathname, filename } = state
      if (!isSaved && /[^\n]/.test(markdown)) {
        ipcRenderer.send('AGANI::response-close-confirm', { filename, pathname, markdown })
      } else {
        ipcRenderer.send('AGANI::close-window')
      }
    })
  }
}

export default { state, mutations, actions }
