import Vue from 'vue'
import axios from 'axios'

import { ipcRenderer } from 'electron'

import App from './app'
import store from './store'

import './assets/symbolIcon'
import './index.css'

import { Dialog, Form, FormItem, InputNumber, Button, Tooltip, Upload, Slider, ColorPicker } from 'element-ui'
// In the renderer process:
// var webFrame = require('electron').webFrame
// var SpellCheckProvider = require('electron-spell-check-provider')

// webFrame.setSpellCheckProvider('en-US', true, new SpellCheckProvider('en-US').on('misspelling', function (suggestions) {
//   console.log(suggestions)
// }))

// prevent Chromium's default behavior and try to open the first file
window.addEventListener('dragover', function (e) {
  e.preventDefault()
  if (e.dataTransfer.types.indexOf('Files') >= 0) {
    e.dataTransfer.dropEffect = 'copy'
  } else {
    e.stopPropagation()
    e.dataTransfer.dropEffect = 'none'
  }
}, false)
window.addEventListener('drop', function (e) {
  e.preventDefault()
  if (e.dataTransfer.files) {
    const fileList = []
    for (const file of e.dataTransfer.files) {
      fileList.push(file.path)
    }
    ipcRenderer.send('AGANI::window::drop', fileList)
  }
}, false)

Vue.use(Dialog)
Vue.use(Form)
Vue.use(FormItem)
Vue.use(InputNumber)
Vue.use(Button)
Vue.use(Tooltip)
Vue.use(Upload)
Vue.use(Slider)
Vue.use(ColorPicker)

if (!process.env.IS_WEB) Vue.use(require('vue-electron'))
Vue.http = Vue.prototype.$http = axios
Vue.config.productionTip = false

/* eslint-disable no-new */
new Vue({
  components: { App },
  store,
  template: '<App/>'
}).$mount('#app')
