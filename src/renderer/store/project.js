import { ipcRenderer } from 'electron'

const state = {
  projectTree: JSON.parse(localStorage.getItem('tree'))
}

const mutations = {
  SET_PROJECT_TREE (state, tree) {
    localStorage.setItem('tree', JSON.stringify(tree))
    state.projectTree = tree
  }
}

const actions = {
  LISTEN_FOR_LOAD_PROJECT ({ commit }) {
    ipcRenderer.on('AGANI::project-loaded', (e, tree) => {
      commit('SET_PROJECT_TREE', tree)
    })
  }
}

export default { state, mutations, actions }
