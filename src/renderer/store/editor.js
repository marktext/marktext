import { ipcRenderer, remote } from 'electron'
import path from 'path'
import bus from '../bus'

const state = {
  appVersion: remote.app.getVersion(),
  filename: 'Untitled - unsaved',
  searchMatches: {
    index: -1,
    matches: [],
    value: ''
  },
  // user preference
  theme: 'light',
  fontSize: '16px',
  lineHeight: 1.6,
  lightColor: '#303133', // color in light theme
  darkColor: 'rgb(217, 217, 217)', // color in dark theme
  autoSave: false,
  preferLooseListItem: true, // prefer loose or tight list items
  autoPairBracket: true,
  autoPairMarkdownSyntax: true,
  autoPairQuote: true,
  // edit mode
  typewriter: false, // typewriter mode
  focus: false, // focus mode
  sourceCode: false, // source code mode
  pathname: '',
  isSaved: true,
  markdown: '',
  isUtf8BomEncoded: false,
  cursor: null,
  windowActive: true,
  wordCount: {
    paragraph: 0,
    word: 0,
    character: 0,
    all: 0
  },
  platform: process.platform
}

const mutations = {
  SET_MODE (state, { type, checked }) {
    state[type] = checked
  },
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
  SET_SAVE_STATUS (state, status) {
    state.isSaved = status
  },
  SET_MARKDOWN (state, markdown) {
    state.markdown = markdown
  },
  SET_IS_UTF8_BOM_ENCODED (state, isUtf8BomEncoded) {
    state.isUtf8BomEncoded = isUtf8BomEncoded
  },
  SET_WORD_COUNT (state, wordCount) {
    state.wordCount = wordCount
  },
  SET_CURSOR (state, cursor) {
    state.cursor = cursor
  },
  SET_USER_PREFERENCE (state, preference) {
    Object.keys(preference).forEach(key => {
      if (typeof preference[key] !== 'undefined' && typeof state[key] !== 'undefined') {
        state[key] = preference[key]
      }
    })
  }
}

const actions = {
  ASK_FOR_INSERT_IMAGE ({ commit }, type) {
    ipcRenderer.send('AGANI::ask-for-insert-image', type)
  },

  ASK_FOR_IMAGE_AUTO_PATH ({ commit, state }, src) {
    const { pathname } = state
    if (pathname) {
      ipcRenderer.send('AGANI::ask-for-image-auto-path', { pathname, src })
    }
  },

  LISTEN_FOR_IMAGE_PATH ({ commit }) {
    ipcRenderer.on('AGANI::image-auto-path', (e, files) => {
      bus.$emit('image-auto-path', files)
    })
  },

  CHANGE_FONT ({ commit }, { type, value }) {
    commit('SET_USER_PREFERENCE', { [type]: value })
    // save to preference.md
    ipcRenderer.send('AGANI::set-user-preference', { [type]: value })
  },

  ASK_FOR_USER_PREFERENCE ({ commit, state }) {
    ipcRenderer.send('AGANI::ask-for-user-preference')
    ipcRenderer.on('AGANI::user-preference', (e, preference) => {
      const { autoSave } = preference

      commit('SET_USER_PREFERENCE', preference)

      // handle autoSave
      if (autoSave) {
        const { pathname, markdown, isUtf8BomEncoded } = state

        if (autoSave && pathname) {
          commit('SET_SAVE_STATUS', true)
          ipcRenderer.send('AGANI::response-file-save', { pathname, markdown, isUtf8BomEncoded })
        }
      }
    })
  },

  SEARCH ({ commit }, value) {
    commit('SET_SEARCH', value)
  },

  ASK_FOR_MODE ({ commit }) {
    ipcRenderer.send('AGANI::ask-for-mode')
    ipcRenderer.on('AGANI::res-for-mode', (e, modes) => {
      Object.keys(modes).forEach(type => {
        commit('SET_MODE', {
          type,
          checked: modes[type]
        })
      })
    })
  },

  LINTEN_WIN_STATUS ({ commit }) {
    ipcRenderer.on('AGANI::window-active-status', (e, { status }) => {
      commit('SET_WIN_STATUS', status)
    })
  },

  LISTEN_FOR_SAVE ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-save', () => {
      const { pathname, markdown, isUtf8BomEncoded } = state
      ipcRenderer.send('AGANI::response-file-save', { pathname, markdown, isUtf8BomEncoded })
    })
  },

  LISTEN_FOR_SAVE_AS ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-save-as', () => {
      const { pathname, markdown, isUtf8BomEncoded } = state
      ipcRenderer.send('AGANI::response-file-save-as', { pathname, markdown, isUtf8BomEncoded })
    })
  },

  LISTEN_FOR_MOVE_TO ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-move-to', () => {
      const { pathname, markdown, isUtf8BomEncoded } = state
      if (!pathname) {
        ipcRenderer.send('AGANI::response-file-save', { pathname, markdown, isUtf8BomEncoded })
      } else {
        ipcRenderer.send('AGANI::response-file-move-to', { pathname })
      }
    })
  },

  LISTEN_FOR_RENAME ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-rename', () => {
      const { pathname, markdown, isUtf8BomEncoded } = state
      if (!pathname) {
        ipcRenderer.send('AGANI::response-file-save', { pathname, markdown, isUtf8BomEncoded })
      } else {
        bus.$emit('rename')
      }
    })
  },

  RENAME ({ commit, state }, newFilename) {
    const { pathname, filename } = state
    if (filename !== newFilename) {
      const newPathname = path.join(path.dirname(pathname), newFilename)
      ipcRenderer.send('AGANI::rename', { pathname, newPathname })
    }
  },

  GET_FILENAME ({ commit, state }) {
    ipcRenderer.on('AGANI::set-pathname', (e, { pathname, filename }) => {
      commit('SET_FILENAME', filename)
      commit('SET_PATHNAME', pathname)
      commit('SET_SAVE_STATUS', true)
    })
  },

  LISTEN_FOR_FILE_LOAD ({ commit, state }) {
    ipcRenderer.on('AGANI::file-loaded', (e, { file, filename, pathname, isUtf8BomEncoded }) => {
      commit('SET_FILENAME', filename)
      commit('SET_PATHNAME', pathname)
      commit('SET_MARKDOWN', file)
      commit('SET_SAVE_STATUS', true)
      commit('SET_IS_UTF8_BOM_ENCODED', isUtf8BomEncoded)
      bus.$emit('file-loaded', file)
    })
  },

  LISTEN_FOR_FILE_CHANGE ({ commit, state }) {
    ipcRenderer.on('AGANI::file-change', (e, { file, filename, pathname }) => {
      const { windowActive } = state
      commit('SET_FILENAME', filename)
      commit('SET_PATHNAME', pathname)
      commit('SET_MARKDOWN', file)
      commit('SET_SAVE_STATUS', true)
      if (!windowActive) {
        bus.$emit('file-loaded', file)
      }
    })
  },

  EXPORT ({ commit, state }, { type, content }) {
    const { filename, pathname } = state
    ipcRenderer.send('AGANI::response-export', { type, content, filename, pathname })
  },

  LISTEN_FOR_CONTENT_CHANGE ({ commit, state }, { markdown, wordCount, cursor }) {
    const { pathname, autoSave, markdown: oldMarkdown, isUtf8BomEncoded } = state
    commit('SET_MARKDOWN', markdown)
    // set word count
    if (wordCount) commit('SET_WORD_COUNT', wordCount)
    // set cursor
    if (cursor) commit('SET_CURSOR', cursor)
    // change save status/save to file only when the markdown changed!
    if (markdown !== oldMarkdown) {
      if (pathname && autoSave) {
        ipcRenderer.send('AGANI::response-file-save', { pathname, markdown, isUtf8BomEncoded })
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

  LISTEN_FOR_INSERT_IMAGE ({ commit, state }) {
    ipcRenderer.on('AGANI::INSERT_IMAGE', (e, { filename: imagePath, type }) => {
      if (type === 'absolute' || type === 'relative') {
        const { pathname } = state
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

  LISTEN_FOR_EDIT ({ commit }) {
    ipcRenderer.on('AGANI::edit', (e, { type }) => {
      bus.$emit(type)
    })
  },

  LISTEN_FOR_VIEW ({ commit }) {
    ipcRenderer.on('AGANI::view', (e, data) => {
      commit('SET_MODE', data)
    })
    ipcRenderer.on('AGANI::font-setting', e => {
      bus.$emit('font-setting')
    })
  },

  LISTEN_FOR_ABOUT_DIALOG ({ commit }) {
    ipcRenderer.on('AGANI::about-dialog', e => {
      bus.$emit('aboutDialog')
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
      const { isSaved, markdown, pathname, filename, isUtf8BomEncoded } = state
      if (!isSaved && /[^\n]/.test(markdown)) {
        ipcRenderer.send('AGANI::response-close-confirm', { filename, pathname, markdown, isUtf8BomEncoded })
      } else {
        ipcRenderer.send('AGANI::close-window')
      }
    })
  }
}

export default { state, mutations, actions }
