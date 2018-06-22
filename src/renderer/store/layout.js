import { ipcRenderer } from 'electron'

// messages from main process, and do not change the state
const state = {
  rightColumn: 'files',
  showSideBar: false,
  showTabBar: false
}

const getters = {}

const mutations = {
  SET_LAYOUT (state, layout) {
    Object.assign(state, layout)
  }
}

const actions = {
  LISTEN_FOR_LAYOUT ({ commit }, layout) {
    ipcRenderer.on('AGANI::listen-for-view-layout', (e, layout) => {
      commit('SET_LAYOUT', layout)
    })
  },
  LISTEN_FOR_REQUEST_LAYOUT ({ commit, dispatch }) {
    ipcRenderer.on('AGANI::request-for-view-layout', () => {
      dispatch('SET_LAYOUT_MENU_ITEM')
    })
  },
  SET_LAYOUT_MENU_ITEM ({ commit, state }) {
    const { showTabBar, showSideBar } = state
    ipcRenderer.send('AGANI::set-view-layout', { showTabBar, showSideBar })
  }
}

export default { state, getters, mutations, actions }
