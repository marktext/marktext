import { remote } from 'electron'

const state = {
  appVersion: remote.app.getVersion()
}

const mutations = {
}

const actions = {
}

export default { state, mutations, actions }
