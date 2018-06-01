import { ipcRenderer } from 'electron'

const width = localStorage.getItem('side-bar-width')
const sideBarWidth = typeof +width === 'number' ? Math.max(+width, 180) : 280

const state = {
  sideBarWidth,
  projectTree: JSON.parse(localStorage.getItem('tree'))
}

const mutations = {
  SET_PROJECT_TREE (state, tree) {
    localStorage.setItem('tree', JSON.stringify(tree))
    state.projectTree = tree
  },
  SET_SIDE_BAR_WIDTH (state, width) {
    localStorage.setItem('side-bar-width', Math.max(+width, 180))
    state.sideBarWidth = width
  }
}

const actions = {
  LISTEN_FOR_LOAD_PROJECT ({ commit }) {
    ipcRenderer.on('AGANI::project-loaded', (e, tree) => {
      commit('SET_PROJECT_TREE', tree)
    })
  },
  CHANGE_SIDE_BAR_WIDTH ({ commit }, width) {
    commit('SET_SIDE_BAR_WIDTH', width)
  }
}

export default { state, mutations, actions }
