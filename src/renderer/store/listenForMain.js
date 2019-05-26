import { ipcRenderer } from 'electron'
import bus from '../bus'

// messages from main process, and do not change the state
const state = {}

const getters = {}

const mutations = {}

const actions = {
  LISTEN_FOR_EDIT ({ commit }) {
    ipcRenderer.on('AGANI::edit', (e, { type }) => {
      bus.$emit(type, type)
    })
  },

  LISTEN_FOR_VIEW ({ commit }) {
    ipcRenderer.on('AGANI::view', (e, data) => {
      commit('SET_MODE', data)
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
  }
}

const listenForMain = { state, getters, mutations, actions }

export default listenForMain
