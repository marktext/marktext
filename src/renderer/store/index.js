import Vue from 'vue'
import Vuex from 'vuex'
import { ipcRenderer } from 'electron'

import listenForMain from './listenForMain'
import project from './project'
import editor from './editor'
import aidou from './aidou'
import layout from './layout'
import preferences from './preferences'
import autoUpdates from './autoUpdates'
import notification from './notification'
import tweet from './tweet'

Vue.use(Vuex)

// global states
const state = {
  platform: process.platform, // platform of system `darwin` | `win32` | `linux`
  appVersion: process.versions.MARKTEXT_VERSION_STRING, // Mark Text version string
  windowActive: true, // weather current window is active or focused
  init: process.env.NODE_ENV === 'development' // weather Mark Text is inited
}

const getters = {}

const mutations = {
  SET_WIN_STATUS (state, status) {
    state.windowActive = status
  },
  SET_INIT_STATUS (state, status) {
    state.init = status
  }
}

const actions = {
  LINTEN_WIN_STATUS ({ commit, state }) {
    ipcRenderer.on('AGANI::window-active-status', (e, { status }) => {
      commit('SET_WIN_STATUS', status)
    })
  },
  INIT_STATUS ({ commit }, status) {
    commit('SET_INIT_STATUS', status)
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
    aidou,
    preferences,
    editor,
    layout
  }
})

export default store
