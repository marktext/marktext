import { ipcRenderer, shell } from 'electron'
import notice from '../services/notification'

const state = {}

const getters = {}

const mutations = {}

const actions = {
  LISTEN_FOR_NOTIFICATION ({ commit }) {
    const DEFAULT_OPTS = {
      title: 'Infomation',
      type: 'primary',
      time: 10000,
      message: 'You should never see this message'
    }

    ipcRenderer.on('mt::show-notification', (e, opts) => {
      const options = Object.assign(DEFAULT_OPTS, opts)

      notice.notify(options)
    })

    ipcRenderer.on('mt::pandoc-not-exists', async (e, opts) => {
      const options = Object.assign(DEFAULT_OPTS, opts)
      options.showConfirm = true
      await notice.notify(options)
      shell.openExternal('http://pandoc.org')
    })
  }
}

export default { state, getters, mutations, actions }
