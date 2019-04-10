import { ipcRenderer } from 'electron'
import { getOptionsFromState } from './help'

// user preference
const state = {
  theme: 'light',
  editorFontFamily: 'Open Sans',
  fontSize: '16px',
  codeFontFamily: 'DejaVu Sans Mono',
  codeFontSize: '14px',
  lineHeight: 1.6,
  lightColor: '#303133', // color in light theme
  darkColor: 'rgb(217, 217, 217)', // color in dark theme
  autoSave: false,
  preferLooseListItem: true, // prefer loose or tight list items
  bulletListMarker: '-',
  autoPairBracket: true,
  autoPairMarkdownSyntax: true,
  autoPairQuote: true,
  tabSize: 4,
  // bullet/list marker width + listIndentation, tab or Daring Fireball Markdown (4 spaces) --> list indentation
  listIndentation: 1,
  hideQuickInsertHint: false,
  titleBarStyle: 'csd',
  // edit modes (they are not in preference.md, but still put them here)
  typewriter: false, // typewriter mode
  focus: false, // focus mode
  sourceCode: false // source code mode
}

const getters = {}

const mutations = {
  SET_USER_PREFERENCE (state, preference) {
    Object.keys(preference).forEach(key => {
      if (typeof preference[key] !== 'undefined' && typeof state[key] !== 'undefined') {
        state[key] = preference[key]
      }
    })
  },
  SET_MODE (state, { type, checked }) {
    state[type] = checked
  }
}

const actions = {
  ASK_FOR_USER_PREFERENCE ({ commit, state, rootState }) {
    ipcRenderer.send('AGANI::ask-for-user-preference')
    ipcRenderer.on('AGANI::user-preference', (e, preference) => {
      const { autoSave } = preference
      commit('SET_USER_PREFERENCE', preference)

      // handle autoSave @todo
      if (autoSave) {
        const { pathname, markdown } = state
        const options = getOptionsFromState(rootState.editor)
        if (pathname) {
          commit('SET_SAVE_STATUS', true)
          ipcRenderer.send('AGANI::response-file-save', { pathname, markdown, options })
        }
      }
    })
  },

  ASK_FOR_MODE ({ commit }) {
    ipcRenderer.send('AGANI::ask-for-mode')
    ipcRenderer.on('AGANI::res-for-mode', (e, modes) => {
      Object.keys(modes).forEach(type => {
        commit('SET_MODE', {
          type,
          checked: modes[type]
        })
      })
    })
  },

  CHANGE_FONT ({ commit }, { type, value }) {
    commit('SET_USER_PREFERENCE', { [type]: value })
    // save to preference.md
    ipcRenderer.send('AGANI::set-user-preference', { [type]: value })
  }
}

const preferences = { state, getters, mutations, actions }

export default preferences
