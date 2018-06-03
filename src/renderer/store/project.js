import { ipcRenderer } from 'electron'
import { getUniqueId } from '../util'
import { addFile, unlinkFile, changeFile, addDirectory, unlinkDirectory } from './treeCtrl'

const width = localStorage.getItem('side-bar-width')
const sideBarWidth = typeof +width === 'number' ? Math.max(+width, 180) : 280

const state = {
  projectName: '',
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
  SET_PROJECT_TREE (state, { projectName, tree }) {
    localStorage.setItem('tree', JSON.stringify(tree))
    state.projectTree = tree
    state.projectName = projectName
  },
  SET_SIDE_BAR_WIDTH (state, width) {
    localStorage.setItem('side-bar-width', Math.max(+width, 180))
    state.sideBarWidth = width
  },
  ADD_FILE (state, change) {
    const { projectTree } = state
    addFile(projectTree, change)
  },
  UNLINK_FILE (state, change) {
    const { projectTree } = state
    unlinkFile(projectTree, change)
  },
  CHANGE_FILE (state, change) {
    const { projectTree } = state
    changeFile(projectTree, change)
  },
  ADD_DIRECTORY (state, change) {
    const { projectTree } = state
    addDirectory(projectTree, change)
  },
  UNLINK_DIRECTORY (state, change) {
    const { projectTree } = state
    unlinkDirectory(projectTree, change)
  }
}

const actions = {
  LISTEN_FOR_LOAD_PROJECT ({ commit }) {
    ipcRenderer.on('AGANI::open-project', (e, { projectName, tree }) => {
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

      commit('SET_PROJECT_TREE', { projectName, tree })
    })
  },
  LISTEN_FOR_UPDATE_PROJECT ({ commit }) {
    ipcRenderer.on('AGANI::update-object-tree', (e, { type, change }) => {
      switch (type) {
        case 'add':
          commit('ADD_FILE', change)
          break
        case 'unlink':
          commit('UNLINK_FILE', change)
          break
        case 'change':
          console.log(change)
          commit('CHANGE_FILE', change)
          break
        case 'addDir':
          commit('ADD_DIRECTORY', change)
          break
        case 'unlinkDir':
          commit('UNLINK_DIRECTORY', change)
          break
        default:
          if (process.env.NODE_ENV === 'development') {
            console.log('unknown directory watch type')
          }
          break
      }
    })
  },
  CHANGE_SIDE_BAR_WIDTH ({ commit }, width) {
    commit('SET_SIDE_BAR_WIDTH', width)
  }
}

export default { state, getters, mutations, actions }
