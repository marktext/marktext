import { ipcRenderer } from 'electron'
import bus from '../bus'
import notice from '../services/notification'

const state = {
  drawerVisible: false,
  drawerEnabled: true,
  loading: false,
  icons: []
}

const getters = {}

const mutations = {
  SET_ICON_DRAWER_VISIBLE (state, visible) {
    state.drawerVisible = visible
  },
  SET_ICON_DRAWER_ENABLED (state, enabled) {
    state.drawerEnabled = enabled
  },
  SET_ICON_LIBRARY_LOADING (state, loading) {
    state.loading = loading
  },
  SET_ICON_ITEMS (state, icons) {
    state.icons = icons
  }
}

const actions = {
  async LOAD_ICON_LIBRARY ({ commit }) {
    commit('SET_ICON_LIBRARY_LOADING', true)
    try {
      const { drawerEnabled, icons } = await ipcRenderer.invoke('mt::icon-library-list')
      commit('SET_ICON_DRAWER_ENABLED', !!drawerEnabled)
      commit('SET_ICON_ITEMS', icons || [])
    } catch (err) {
      notice.notify({
        title: 'Icon Drawer',
        type: 'warning',
        message: `Unable to load icon drawer configuration: ${err.message}`
      })
    } finally {
      commit('SET_ICON_LIBRARY_LOADING', false)
    }
  },

  async LISTEN_FOR_ICON_LIBRARY_UPDATES ({ dispatch }) {
    ipcRenderer.on('mt::feature-config-changed', (event, payload) => {
      if (payload && payload.icons) {
        dispatch('LOAD_ICON_LIBRARY')
      }
    })
  },

  TOGGLE_ICON_DRAWER ({ commit, state }) {
    commit('SET_ICON_DRAWER_VISIBLE', !state.drawerVisible)
  },

  OPEN_ICON_DRAWER ({ commit }) {
    commit('SET_ICON_DRAWER_VISIBLE', true)
  },

  CLOSE_ICON_DRAWER ({ commit }) {
    commit('SET_ICON_DRAWER_VISIBLE', false)
  },

  async ADD_CUSTOM_ICON ({ dispatch }, payload) {
    await ipcRenderer.invoke('mt::icon-library-add-custom', payload)
    await dispatch('LOAD_ICON_LIBRARY')
  },

  async IMPORT_LOCAL_ICONS ({ dispatch }, directoryPath = '') {
    const result = await ipcRenderer.invoke('mt::icon-library-import-local', directoryPath)
    await dispatch('LOAD_ICON_LIBRARY')
    return result
  },

  async REMOVE_ICON ({ dispatch }, iconId) {
    await ipcRenderer.invoke('mt::icon-library-remove', iconId)
    await dispatch('LOAD_ICON_LIBRARY')
  },

  INSERT_ICON_IN_EDITOR (_, icon) {
    if (!icon || !icon.value) return

    // Focus editor first to preserve selection behavior.
    setTimeout(() => bus.$emit('editor-focus'), 10)
    if (icon.iconType === 'emoji_text') {
      const shortcode = icon.shortcode ? `:${icon.shortcode}:` : ''
      const text = shortcode || icon.name || icon.value
      setTimeout(() => bus.$emit('insert-plain-text', text), 120)
    } else {
      setTimeout(() => bus.$emit('insert-image', icon.value), 120)
    }
  }
}

const iconLibrary = { state, getters, mutations, actions }

export default iconLibrary
