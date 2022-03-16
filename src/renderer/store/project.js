import path from 'path'
import { ipcRenderer, shell } from 'electron'
import log from 'electron-log'
import { WATCHER_CHANGE_TYPE } from 'common/filesystem/watcher'
import { addFile, unlinkFile, addDirectory, unlinkDirectory, PROJECT_UPDATE_POLICY } from './treeCtrl'
import bus from '../bus'
import { getUniqueId, getErrorMessageFromInvokeRequest } from '../util'
import { create, paste, rename } from '../util/fileSystem'
import { PATH_SEPARATOR } from '../config'
import notice from '../services/notification'
import { hasMarkdownExtension } from '../../common/filesystem/paths'

const state = {
  activeItem: {},
  createCache: {},
  renameCache: null,
  clipboard: null,
  projectTree: null,
  watcherResponseId: null
}

const getters = {}

const mutations = {
  SET_ROOT_DIRECTORY (state, fullPath) {
    if (!path.isAbsolute(fullPath)) {
      throw new Error('Path must be absolute')
    }

    let name = path.basename(fullPath)
    if (!name) {
      // fullPath is a root directory such "/" or "C:\".
      name = fullPath
    }

    state.projectTree = {
      // Root full path
      pathname: path.resolve(fullPath),
      // Root directory name
      name,
      isDirectory: true,
      isCollapsed: false,
      // Root directory is always loaded after a short delay.
      isLoaded: true,
      folders: [],
      files: []
    }
  },
  ADD_FILE (state, change) {
    const { projectTree } = state
    addFile(projectTree, change, PROJECT_UPDATE_POLICY.PARTIAL)
  },
  FORCE_ADD_FILE (state, change) {
    const { projectTree } = state
    addFile(projectTree, change, PROJECT_UPDATE_POLICY.FORCE)
  },
  UNLINK_FILE (state, change) {
    const { projectTree } = state
    unlinkFile(projectTree, change)
  },
  ADD_DIRECTORY (state, change) {
    const { projectTree } = state
    addDirectory(projectTree, change, PROJECT_UPDATE_POLICY.PARTIAL)
  },
  FORCE_ADD_DIRECTORY (state, change) {
    const { projectTree } = state
    addDirectory(projectTree, change, PROJECT_UPDATE_POLICY.FORCE)
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
  },
  SET_WATCHER_RESPONSE_ID (state, id) {
    state.watcherResponseId = id
  }
}

const actions = {
  LISTEN_FOR_LOAD_PROJECT ({ state, commit, dispatch }) {
    ipcRenderer.on('mt::open-directory', (e, pathname) => {
      // Disable and close old watcher.
      if (state.watcherResponseId) {
        console.assert(state.projectTree && state.projectTree.pathname.length > 0, 'Expected a path that\'s watched.')

        commit('SET_WATCHER_RESPONSE_ID', null)
        ipcRenderer.send('mt::watcher-unwatch-sidebar-directory', state.projectTree.pathname)
      }

      // Initialize new project.
      commit('SET_ROOT_DIRECTORY', pathname)
      commit('SET_LAYOUT', {
        rightColumn: 'files',
        showSideBar: true,
        showTabBar: true
      })
      dispatch('SET_LAYOUT_MENU_ITEM')

      // Register new watcher and load directory contents.
      const responseId = getUniqueId()
      ipcRenderer.invoke('mt::filesystem-scan-sidebar-directory', pathname)
        .then(directoryList => {
          commit('SET_WATCHER_RESPONSE_ID', responseId)
          for (const { isDirectory, path: fullPath } of directoryList) {
            if (isDirectory) {
              commit('FORCE_ADD_DIRECTORY', fullPath)
            } else {
              commit('FORCE_ADD_FILE', fullPath)
            }
          }
        })
        .catch(error => {
          log.error(error)
          notice.notify({
            title: 'Error while loading project',
            type: 'error',
            message: error.message
          })
        })
      ipcRenderer.send('mt::watcher-watch-sidebar-directory', {
        path: pathname,
        token: responseId
      })
    })
  },
  LISTEN_FOR_UPDATE_PROJECT ({ commit, state }) {
    ipcRenderer.on('mt::watcher-changes-sidebar', (event, token, changeList) => {
      if (!token || token !== state.watcherResponseId) {
        return
      }

      for (const change of changeList) {
        const { isDirectory, path: fullPath, type } = change
        switch (type) {
          case WATCHER_CHANGE_TYPE.CREATED: {
            if (isDirectory) {
              commit('ADD_DIRECTORY', fullPath)
            } else {
              commit('ADD_FILE', fullPath)
            }
            break
          }
          case WATCHER_CHANGE_TYPE.DELETED: {
            if (isDirectory) {
              commit('UNLINK_DIRECTORY', fullPath)
            } else {
              commit('UNLINK_FILE', fullPath)
            }
            break
          }
        }
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
      shell.trashItem(pathname).catch(err => {
        notice.notify({
          title: 'Error while deleting',
          type: 'error',
          message: err.message
        })
      })
    })
    bus.$on('SIDEBAR::copy-cut', type => {
      const { pathname: src } = state.activeItem
      commit('SET_CLIPBOARD', { type, src })
    })
    bus.$on('SIDEBAR::paste', () => {
      const { clipboard } = state
      const { pathname, isDirectory } = state.activeItem
      const dirname = isDirectory ? pathname : path.dirname(pathname)
      if (clipboard && clipboard.src) {
        clipboard.dest = dirname + PATH_SEPARATOR + path.basename(clipboard.src)

        if (path.normalize(clipboard.src) === path.normalize(clipboard.dest)) {
          notice.notify({
            title: 'Paste Forbidden',
            type: 'warning',
            message: 'Source and destination must not be the same.'
          })
          return
        }

        paste(clipboard)
          .then(() => {
            commit('SET_CLIPBOARD', null)
          })
          .catch(err => {
            notice.notify({
              title: 'Error while pasting',
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
    commit('CREATE_PATH', {})

    if (type === 'file') {
      if (!hasMarkdownExtension(name)) {
        name += '.md'
      }

      ipcRenderer.invoke('mt::create-and-open-empty-markdown-file', path.join(dirname, name))
        .catch(error => {
          notice.notify({
            title: 'Error creating file',
            type: 'error',
            message: getErrorMessageFromInvokeRequest(error)
          })
        })
    } else {
      create(path.join(dirname, name), type)
        .catch(err => {
          notice.notify({
            title: 'Error creating folder',
            type: 'error',
            message: err.message
          })
        })
    }
  },

  RENAME_IN_SIDEBAR ({ commit, state }, name) {
    const src = state.renameCache
    const dest = path.join(path.dirname(src), name)
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
