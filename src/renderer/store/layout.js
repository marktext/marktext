import { ipcRenderer } from 'electron'

const width = localStorage.getItem('side-bar-width')
const sideBarWidth = typeof +width === 'number' ? Math.max(+width, 220) : 280

// messages from main process, and do not change the state
const state = {
  rightColumn: 'files',
  showSideBar: false,
  showTabBar: false,
  sideBarWidth
}

const getters = {}

const mutations = {
  SET_LAYOUT (state, layout) {
    Object.assign(state, layout)
  },
  SET_SIDE_BAR_WIDTH (state, width) {
    // TODO: Add side bar to session (GH#732).
    localStorage.setItem('side-bar-width', Math.max(+width, 220))
    state.sideBarWidth = width
  }
}

const actions = {
  LISTEN_FOR_LAYOUT ({ commit }) {
    ipcRenderer.on('AGANI::listen-for-view-layout', (e, layout) => {
      commit('SET_LAYOUT', layout)
    })
  },
  LISTEN_FOR_REQUEST_LAYOUT ({ dispatch }) {
    ipcRenderer.on('AGANI::request-for-view-layout', () => {
      dispatch('SET_LAYOUT_MENU_ITEM')
    })
  },
  SET_LAYOUT_MENU_ITEM ({ state }) {
    const { windowId } = global.marktext.env
    const { showTabBar, showSideBar } = state
    ipcRenderer.send('mt::view-layout-changed', windowId, { showTabBar, showSideBar })
  },
  CHANGE_SIDE_BAR_WIDTH ({ commit }, width) {
    commit('SET_SIDE_BAR_WIDTH', width)
  }
}

export default { state, getters, mutations, actions }
