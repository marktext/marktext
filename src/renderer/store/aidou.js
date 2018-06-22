import resource from './resource'

const state = {
  aiLoading: false,
  aiList: []
}

const getters = {}

const mutations = {
  SET_AI_LIST (state, { data, type }) {
    if (type === 'search' || type === 'collect') {
      state.aiList = data
    } else {
      state.aiList = [...state.aiList, ...data]
    }
  },
  SET_AI_STATUS (state, bool) {
    state.aiLoading = bool
  }
}

const actions = {
  AI_LIST ({ commit }, data) {
    commit('SET_AI_LIST', data)
  },
  AI_SEARCH ({ commit }, { params, type }) {
    commit('SET_AI_STATUS', true)
    return resource.sogou(params)
      .then(({ data, total }) => {
        commit('SET_AI_LIST', { data, type })
        commit('SET_AI_STATUS', false)
        return { data, total }
      })
      .catch(() => {
        commit('SET_AI_STATUS', false)
      })
  }
}

export default { state, getters, mutations, actions }
