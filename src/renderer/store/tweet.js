import { ipcRenderer } from 'electron'
import bus from '../bus'

const state = {}

const getters = {}

const mutations = {}

const actions = {
  LISTEN_FOR_TWEET () {
    ipcRenderer.on('mt::tweet', (e, type) => {
      if (type === 'twitter') {
        bus.$emit('tweetDialog')
      }
    })
  }
}

export default { state, getters, mutations, actions }
