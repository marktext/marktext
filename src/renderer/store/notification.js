import { ipcRenderer } from 'electron'
import notice from '../services/notification'

const state = {}

const getters = {}

const mutations = {
}

const actions = {
  LISTEN_FOR_NOTIFICATION ({ commit }) {
    ipcRenderer.on('AGANI::show-error-notification', (e, message) => {
      notice.notify({
        title: 'Error',
        type: 'error',
        message
      })
    })
    ipcRenderer.on('AGANI::show-info-notification', (e, { message, timeout }) => {
      notice.notify({
        title: 'Infomation',
        type: 'info',
        time: timeout,
        message
      })
    })
  }
}

export default { state, getters, mutations, actions }
