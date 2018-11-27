import Vue from 'vue'
import axios from 'axios'
import { ipcRenderer } from 'electron'
import lang from 'element-ui/lib/locale/lang/en'
import locale from 'element-ui/lib/locale'
import App from './app'
import store from './store'
import './assets/symbolIcon'
import { Dialog, Form, FormItem, InputNumber, Button, Tooltip, Upload, Slider, ColorPicker, Col, Row } from 'element-ui'
import services from './services'

import './assets/styles/index.css'
import './assets/styles/printService.css'

window.addEventListener('error', event => {
  const { message, name, stack } = event.error
  const copy = {
    message,
    name,
    stack
  }
  // pass error to error handler
  ipcRenderer.send('AGANI::handle-renderer-error', copy)
})

// import notice from './services/notification'
// In the renderer process:
// var webFrame = require('electron').webFrame
// var SpellCheckProvider = require('electron-spell-check-provider')

// webFrame.setSpellCheckProvider('en-US', true, new SpellCheckProvider('en-US').on('misspelling', function (suggestions) {
//   console.log(suggestions)
// }))

locale.use(lang)

Vue.use(Dialog)
Vue.use(Form)
Vue.use(FormItem)
Vue.use(InputNumber)
Vue.use(Button)
Vue.use(Tooltip)
Vue.use(Upload)
Vue.use(Slider)
Vue.use(ColorPicker)
Vue.use(Col)
Vue.use(Row)

if (!process.env.IS_WEB) Vue.use(require('vue-electron'))
Vue.http = Vue.prototype.$http = axios
Vue.config.productionTip = false

services.forEach(s => {
  Vue.prototype['$' + s.name] = s[s.name]
})

/* eslint-disable no-new */
new Vue({
  components: { App },
  store,
  template: '<App/>'
}).$mount('#app')
