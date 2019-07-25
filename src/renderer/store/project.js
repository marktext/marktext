import path from 'path'
import { ipcRenderer, shell } from 'electron'
import { addFile, unlinkFile, addDirectory, unlinkDirectory } from './treeCtrl'
import bus from '../bus'
import { create, paste, rename } from '../util/fileSystem'
import { PATH_SEPARATOR } from '../config'
import notice from '../services/notification'
import { getFileStateFromData } from './help'

const state = {
  activeItem: {},
  createCache: {},
  // Use to cache newly created filename, for open immediately.
  newFileNameCache: '',
  renameCache: null,
  clipboard: null,
  projectTree: null
}

const getters = {}

const mutations = {
  SET_ROOT_DIRECTORY (state, pathname) {
    let name = path.basename(pathname)
    if (!name) {
      // Root directory such "/" or "C:\"
      name = pathname
    }

    state.projectTree = {
      // Root full path
      pathname: path.normalize(pathname),
      // Root directory name
      name,
      isDirectory: true,
      isFile: false,
      isMarkdown: false,
      folders: [],
      files: []
    }
  },
  SET_NEWFILENAME (state, name) {
    state.newFileNameCache = name
  },
  ADD_FILE (state, change) {
    const { projectTree } = state
    addFile(projectTree, change)
  },
  UNLINK_FILE (state, change) {
    const { projectTree } = state
    unlinkFile(projectTree, change)
  },
  ADD_DIRECTORY (state, change) {
    const { projectTree } = state
    addDirectory(projectTree, change)
  },
  UNLINK_DIRECTORY (state, change) {
    const { projectTree } = state
    unlinkDirectory(projectTree, change)
  },
  SET_ACTIVE_ITEM (state, activeItem) {
    state.activeItem = activeItem
  },
  SET_CLIPBOARD (state, data) {
    state.clipboard = data
  },
  CREATE_PATH (state, cache) {
    state.createCache = cache
  },
  SET_RENAME_CACHE (state, cache) {
    state.renameCache = cache
  }
}

const actions = {
  LISTEN_FOR_LOAD_PROJECT ({ commit, dispatch }) {
    ipcRenderer.on('mt::open-directory', (e, pathname) => {
      commit('SET_ROOT_DIRECTORY', pathname)
      commit('SET_LAYOUT', {
        rightColumn: 'files',
        showSideBar: true,
        showTabBar: true
      })
      dispatch('SET_LAYOUT_MENU_ITEM')
    })
  },
  LISTEN_FOR_UPDATE_PROJECT ({ commit, state, dispatch }) {
    ipcRenderer.on('AGANI::update-object-tree', (e, { type, change }) => {
      switch (type) {
        case 'add': {
          const { pathname, data, isMarkdown } = change
          commit('ADD_FILE', change)
          if (isMarkdown && state.newFileNameCache && pathname === state.newFileNameCache) {
            const fileState = getFileStateFromData(data)
            dispatch('UPDATE_CURRENT_FILE', fileState)
            commit('SET_NEWFILENAME', '')
          }
          break
        }
        case 'unlink':
          commit('UNLINK_FILE', change)
          commit('SET_SAVE_STATUS_WHEN_REMOVE', change)
          break
        case 'addDir':
          commit('ADD_DIRECTORY', change)
          break
        case 'unlinkDir':
          commit('UNLINK_DIRECTORY', change)
          break
        case 'change':
          break
        default:
          if (process.env.NODE_ENV === 'development') {
            console.log(`Unknown directory watch type: "${type}"`)
          }
          break
      }
    })
  },
  CHANGE_ACTIVE_ITEM ({ commit }, activeItem) {
    commit('SET_ACTIVE_ITEM', activeItem)
  },
  CHANGE_CLIPBOARD ({ commit }, data) {
    commit('SET_CLIPBOARD', data)
  },
  ASK_FOR_OPEN_PROJECT ({ commit }) {
    ipcRenderer.send('mt::ask-for-open-project-in-sidebar')
  },
  LISTEN_FOR_SIDEBAR_CONTEXT_MENU ({ commit, state }) {
    bus.$on('SIDEBAR::show-in-folder', () => {
      const { pathname } = state.activeItem
      shell.showItemInFolder(pathname)
    })
    bus.$on('SIDEBAR::new', type => {
      const { pathname, isDirectory } = state.activeItem
      const dirname = isDirectory ? pathname : path.dirname(pathname)
      commit('CREATE_PATH', { dirname, type })
      bus.$emit('SIDEBAR::show-new-input')
    })
    bus.$on('SIDEBAR::remove', () => {
      const { pathname } = state.activeItem
      shell.moveItemToTrash(pathname)
    })
    bus.$on('SIDEBAR::copy-cut', type => {
      const { pathname: src } = state.activeItem
      commit('SET_CLIPBOARD', { type, src })
    })
    bus.$on('SIDEBAR::paste', () => {
      const { clipboard } = state
      const { pathname, isDirectory } = state.activeItem
      const dirname = isDirectory ? pathname : path.dirname(pathname)
      if (clipboard) {
        clipboard.dest = dirname + PATH_SEPARATOR + path.basename(clipboard.src)
        paste(clipboard)
          .then(() => {
            commit('SET_CLIPBOARD', null)
          })
          .catch(err => {
            notice.notify({
              title: 'Paste Error',
              type: 'error',
              message: err.message
            })
          })
      }
    })
    bus.$on('SIDEBAR::rename', () => {
      const { pathname } = state.activeItem
      commit('SET_RENAME_CACHE', pathname)
      bus.$emit('SIDEBAR::show-rename-input')
    })
  },

  CREATE_FILE_DIRECTORY ({ commit, state }, name) {
    const { dirname, type } = state.createCache
    const fullName = `${dirname}/${name}`
    create(fullName, type)
      .then(() => {
        commit('CREATE_PATH', {})
        if (type === 'file') {
          commit('SET_NEWFILENAME', fullName)
        }
      })
      .catch(err => {
        notice.notify({
          title: 'Error in Side Bar',
          type: 'error',
          message: err.message
        })
      })
  },

  RENAME_IN_SIDEBAR ({ commit, state }, name) {
    const src = state.renameCache
    const dirname = path.dirname(src)
    const dest = dirname + PATH_SEPARATOR + name
    rename(src, dest)
      .then(() => {
        commit('RENAME_IF_NEEDED', { src, dest })
      })
  },

  OPEN_SETTING_WINDOW () {
    ipcRenderer.send('mt::open-setting-window')
  }
}

export default { state, getters, mutations, actions }
