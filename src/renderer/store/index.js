import Vue from 'vue'
import Vuex from 'vuex'

import editorStore from './editor'
import aidouStore from './aidou'
import autoUpdates from './autoUpdates'
import version from './version'

Vue.use(Vuex)

const storeArray = [
  editorStore,
  aidouStore,
  autoUpdates,
  version
]

const { actions, mutations, state } = storeArray.reduce((acc, s) => {
  const {actions, mutations, state} = s
  return {
    actions: Object.assign({}, acc.actions, actions),
    mutations: Object.assign({}, acc.mutations, mutations),
    state: Object.assign({}, acc.state, state)
  }
}, {
  actions: {},
  mutations: {},
  state: {}
})

const store = new Vuex.Store({
  actions,
  mutations,
  state,
  getters: {}
})

export default store
