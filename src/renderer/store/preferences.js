import { ipcRenderer } from 'electron'

// user preference
const state = {
  autoSave: false,
  autoSaveDelay: 5000,
  titleBarStyle: 'custom',
  openFilesInNewWindow: false,
  openFolderInNewWindow: false,
  hideScrollbar: false,
  aidou: true,
  fileSortBy: 'created',
  startUpAction: 'lastState',
  defaultDirectoryToOpen: '',
  language: 'en',

  editorFontFamily: 'Open Sans',
  fontSize: 16,
  lineHeight: 1.6,
  codeFontSize: 14,
  codeFontFamily: 'DejaVu Sans Mono',
  editorLineWidth: '',

  autoPairBracket: true,
  autoPairMarkdownSyntax: true,
  autoPairQuote: true,
  endOfLine: 'default',
  textDirection: 'ltr',
  hideQuickInsertHint: false,
  imageInsertAction: 'folder',

  preferLooseListItem: true,
  bulletListMarker: '-',
  orderListDelimiter: '.',
  preferHeadingStyle: 'atx',
  tabSize: 4,
  listIndentation: 1,

  theme: 'light',

  // Default values that are overwritten with the entries below.
  sideBarVisibility: false,
  tabBarVisibility: false,
  sourceCodeModeEnabled: false,

  searchExclusions: [],
  searchMaxFileSize: '',
  searchIncludeHidden: false,
  searchNoIgnore: false,
  searchFollowSymlinks: true,

  watcherUsePolling: false,

  // --------------------------------------------------------------------------

  // Edit modes of the current window (not part of persistent settings)
  typewriter: false, // typewriter mode
  focus: false, // focus mode
  sourceCode: false, // source code mode

  // user configration
  imageFolderPath: '',
  webImages: [],
  cloudImages: [],
  currentUploader: 'none',
  githubToken: '',
  imageBed: {
    github: {
      owner: '',
      repo: '',
      branch: ''
    }
  }
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
    ipcRenderer.send('mt::ask-for-user-preference')
    ipcRenderer.send('mt::ask-for-user-data')

    ipcRenderer.on('AGANI::user-preference', (e, preferences) => {
      commit('SET_USER_PREFERENCE', preferences)
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

  SET_SINGLE_PREFERENCE ({ commit }, { type, value }) {
    // save to electron-store
    ipcRenderer.send('mt::set-user-preference', { [type]: value })
  },

  SET_USER_DATA ({ commit }, { type, value }) {
    ipcRenderer.send('mt::set-user-data', { [type]: value })
  },

  SET_IMAGE_FOLDER_PATH ({ commit }) {
    ipcRenderer.send('mt::ask-for-modify-image-folder-path')
  },

  SELECT_DEFAULT_DIRECTORY_TO_OPEN ({ commit }) {
    ipcRenderer.send('mt::select-default-directory-to-open')
  }
}

const preferences = { state, getters, mutations, actions }

export default preferences
