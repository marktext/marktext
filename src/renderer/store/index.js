import Vue from 'vue'
import Vuex from 'vuex'
import { ipcRenderer, remote } from 'electron'

import listenForMain from './listenForMain'
import project from './project'
import editor from './editor'
import aidou from './aidou'
import layout from './layout'
import preferences from './preferences'
import autoUpdates from './autoUpdates'
import notification from './notification'

Vue.use(Vuex)

// global states
const state = {
  platform: process.platform, // platform of system `darwin` | `win32` | `linux`
  appVersion: remote.app.getVersion(), // electron version in develop and Mark Text version in production
  windowActive: true // weather current window is active or focused
}

const getters = {}

const mutations = {
  SET_WIN_STATUS (state, status) {
    state.windowActive = status
  }
}

const actions = {
  LINTEN_WIN_STATUS ({ commit, state }) {
    ipcRenderer.on('AGANI::window-active-status', (e, { status }) => {
      commit('SET_WIN_STATUS', status)
    })
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
    // have states
    project,
    aidou,
    preferences,
    editor,
    layout
  }
})

export default store
