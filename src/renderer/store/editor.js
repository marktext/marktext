import { ipcRenderer } from 'electron'

const state = {
  filename: 'Untitled - unsaved',
  pathname: '',
  isSaved: false,
  markdown: ''
}

const mutations = {
  SET_FILENAME (state, filename) {
    state.filename = filename
  },
  SET_PATHNAME (state, pathname) {
    state.pathname = pathname
  },
  SET_STATUS (state, status) {
    state.isSaved = status
  },
  SET_MARKDOWN (state, markdown) {
    state.markdown = markdown
  }
}

const actions = {
  LISTEN_FOR_SAVE ({ commit, state }) {
    ipcRenderer.on('AGANI::ask-file-save', () => {
      const { pathname, markdown } = state
      ipcRenderer.send('AGANI:response-file-save', { pathname, markdown })
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
    })
  },
  EDITE_FILE ({ commit }) {
    commit('SET_STATUS', false)
  },
  SAVE_FILE ({ commit, state }, markdown) {
    commit('SET_MARKDOWN', markdown)
    const { pathname } = state
    if (pathname) {
      commit('SET_STATUS', true)
      ipcRenderer.send('AGANI:response-file-save', { pathname, markdown })
    }
  }
}

export default { state, mutations, actions }
