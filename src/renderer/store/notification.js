import { ipcRenderer } from 'electron'
import { error, message } from '../notice'

const state = {}

const getters = {}

const mutations = {
}

const actions = {
  LISTEN_FOR_NOTIFICATION ({ commit }) {
    ipcRenderer.on('AGANI::show-error-notification', (e, msg) => {
      error(msg)
    })
    ipcRenderer.on('AGANI::show-info-notification', (e, { msg, timeout }) => {
      message(msg, timeout)
    })
  }
}

export default { state, getters, mutations, actions }
