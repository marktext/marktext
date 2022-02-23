import Vue from 'vue'
import Vuex from 'vuex'
import { ipcRenderer } from 'electron'

import listenForMain from './listenForMain'
import project from './project'
import editor from './editor'
import layout from './layout'
import preferences from './preferences'
import autoUpdates from './autoUpdates'
import notification from './notification'
import tweet from './tweet'
import commandCenter from './commandCenter'

Vue.use(Vuex)

// global states
const state = {
  platform: process.platform, // platform of system `darwin` | `win32` | `linux`
  appVersion: process.versions.MARKTEXT_VERSION_STRING, // MarkText version string
  windowActive: true, // whether current window is active or focused
  init: false // whether MarkText is initialized
}

const getters = {}

const mutations = {
  SET_WIN_STATUS (state, status) {
    state.windowActive = status
  },
  SET_INITIALIZED (state) {
    state.init = true
  }
}

const actions = {
  LINTEN_WIN_STATUS ({ commit, state }) {
    ipcRenderer.on('mt::window-active-status', (e, { status }) => {
      commit('SET_WIN_STATUS', status)
    })
  },

  SEND_INITIALIZED ({ commit }) {
    commit('SET_INITIALIZED')
  }
}

const store = new Vuex.Store({
  state,
  getters,
  mutations,
  actions,
  modules: {
    // have no states
    listenForMain,
    autoUpdates,
    notification,
    tweet,
    // have states
    project,
    preferences,
    editor,
    layout,
    commandCenter
  }
})

export default store
