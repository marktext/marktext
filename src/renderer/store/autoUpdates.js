import { ipcRenderer } from 'electron'
import { error, message, promote } from '../notice'

const state = {}

const getters = {}

const mutations = {}

// AGANI::UPDATE_DOWNLOADED
const actions = {
  LISTEN_FOR_UPDATE ({ commit }) {
    ipcRenderer.on('AGANI::UPDATE_ERROR', (e, msg) => {
      error(msg)
    })
    ipcRenderer.on('AGANI::UPDATE_NOT_AVAILABLE', (e, msg) => {
      message(msg)
    })
    ipcRenderer.on('AGANI::UPDATE_DOWNLOADED', (e, msg) => {
      message(msg)
    })
    ipcRenderer.on('AGANI::UPDATE_AVAILABLE', (e, msg) => {
      promote(msg)
        .then(() => {
          const needUpdate = true
          ipcRenderer.send('AGANI::NEED_UPDATE', { needUpdate })
        })
        .catch(() => {
          const needUpdate = false
          ipcRenderer.send('AGANI::NEED_UPDATE', { needUpdate })
        })
    })
  }
}

export default { state, getters, mutations, actions }
