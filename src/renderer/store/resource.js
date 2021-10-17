import axios from '../axios'
import { serialize, merge, dataURItoBlob } from '../util'
import request from 'request'

var FormData = require('form-data')

const CONFIG = {
  SOGOU: {
    API: 'https://pic.sogou.com/pics/json.jsp',
    PARAMS: {
      query: '',
      st: 5,
      start: 0,
      xml_len: 100,
      reqFrom: 'wap_result'
    },
    HOT_SEARCH: 'https://pic.sogou.com/pic/emo/'
  }
}

const resource = {
  sogou ({ query, page, size }) {
    const api = CONFIG.SOGOU.API
    const defParams = CONFIG.SOGOU.PARAMS
    const params = merge(defParams, {
      query: `${query} 表情`,
      start: (page - 1) * size,
      xml_len: size
    })
    const queryURL = `${api}?${serialize(params)}`
    return axios.get(queryURL, { withCredentials: true }).then(({ data = {} }) => {
      return {
        data: (data.items || []).map(it => ({
          link: it.locImageLink,
          suffix: it.type
        })),
        total: data.totalNum || 0
      }
    })
  },
  fetchImgToBase64 (url) {
    return axios({
      method: 'get',
      url,
      responseType: 'blob'
    })
      .then(({ data }) => new Promise((resolve, reject) => {
        const reader = new window.FileReader()
        reader.onloadend = () => resolve(reader.result)
        reader.onerror = reject

        reader.readAsDataURL(data)
      }))
  },
  fetchImgToSM (url, smmsToken) {
    const api = 'https://sm.ms/api/v2/upload'
    const formData = new FormData()
    const formHeaders = formData.getHeaders()
    formData.append('smfile', request(url))
    return axios({
      url: api,
      method: 'POST',
      data: formData,
      headers: {
        ...formHeaders,
        Authorization: smmsToken,
        'Content-Type': `multipart/form-data; boundary=${formData._boundary}`
      }
    }).then(({ data }) => {
      console.log(data)
      const { data: res } = data
      return {
        url: res.url,
        err: '',
        server: 'sm'
      }
    }).catch((err) => {
      console.log('error：', err)
    })
  },
  sm (base64) {
    const api = 'https://sm.ms/api/upload'
    const data = new window.FormData()
    data.append('smfile', dataURItoBlob(base64, 'temp.png'))
    return axios.post(api, data).then(({ data }) => {
      const { data: res } = data
      return {
        url: res.url,
        err: '',
        server: 'sm'
      }
    })
  }
}

export default resource
