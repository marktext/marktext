import { ipcRenderer } from 'electron'
import bus from '../bus'

// messages from main process, and do not change the state
const state = {}

const getters = {}

const mutations = {}

const actions = {
  LISTEN_FOR_EDIT ({ commit }) {
    ipcRenderer.on('mt::editor-edit-action', (e, type) => {
      if (type === 'findInFolder') {
        commit('SET_LAYOUT', {
          rightColumn: 'search',
          showSideBar: true
        })
      }
      bus.$emit(type, type)
    })
  },

  LISTEN_FOR_VIEW ({ commit }) {
    ipcRenderer.on('mt::editor-change-view', (e, data) => {
      commit('SET_MODE', data)
    })
    ipcRenderer.on('mt::show-command-palette', () => {
      bus.$emit('show-command-palette')
    })
  },

  LISTEN_FOR_SHOW_DIALOG ({ commit }) {
    ipcRenderer.on('mt::about-dialog', e => {
      bus.$emit('aboutDialog')
    })
    ipcRenderer.on('mt::show-export-dialog', (e, type) => {
      bus.$emit('showExportDialog', type)
    })
  },

  LISTEN_FOR_PARAGRAPH_INLINE_STYLE () {
    ipcRenderer.on('mt::editor-paragraph-action', (e, { type }) => {
      bus.$emit('paragraph', type)
    })
    ipcRenderer.on('mt::editor-format-action', (e, { type }) => {
      bus.$emit('format', type)
    })
  }
}

const listenForMain = { state, getters, mutations, actions }

export default listenForMain
