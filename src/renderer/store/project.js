import { ipcRenderer } from 'electron'
import { getUniqueId } from '../util'

const width = localStorage.getItem('side-bar-width')
const sideBarWidth = typeof +width === 'number' ? Math.max(+width, 180) : 280

const state = {
  sideBarWidth,
  projectTree: JSON.parse(localStorage.getItem('tree'))
}

const getters = {
  fileList: state => {
    const files = []
    const travel = folder => {
      files.push(...folder.files.filter(f => f.isMarkdown))
      for (const childFolder of folder.folders) {
        travel(childFolder)
      }
    }

    travel(state.projectTree)
    return files.sort()
  }
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
    ipcRenderer.on('AGANI::open-project', (e, tree) => {
      const travel = folder => {
        folder.id = getUniqueId()
        if (Array.isArray(folder.files) && folder.files.length) {
          folder.files.forEach(file => {
            file.id = getUniqueId()
          })
        }
        if (Array.isArray(folder.folders) && folder.folders.length) {
          folder.folders.forEach(childFolder => {
            travel(childFolder)
          })
        }
      }
      travel(tree)

      commit('SET_PROJECT_TREE', tree)
    })
  },
  CHANGE_SIDE_BAR_WIDTH ({ commit }, width) {
    commit('SET_SIDE_BAR_WIDTH', width)
  }
}

export default { state, getters, mutations, actions }
