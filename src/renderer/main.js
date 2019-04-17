import Vue from 'vue'
import axios from 'axios'
import { crashReporter, ipcRenderer } from 'electron'
import lang from 'element-ui/lib/locale/lang/en'
import locale from 'element-ui/lib/locale'
import App from './app'
import store from './store'
import './assets/symbolIcon'
import {
  Dialog,
  Form,
  FormItem,
  InputNumber,
  Button,
  Tooltip,
  Upload,
  Slider,
  ColorPicker,
  Col,
  Row,
  Tree
} from 'element-ui'
import services from './services'

import './assets/styles/index.css'
import './assets/styles/printService.css'

// Decode source map in production - must be registered first
import sourceMapSupport from 'source-map-support'
sourceMapSupport.install({
  environment: 'node',
  handleUncaughtExceptions: false,
  hookRequire: false
})

// Start crash reporter to save core dumps for the renderer process
crashReporter.start({
  companyName: 'marktext',
  productName: 'marktext',
  submitURL: 'http://0.0.0.0/',
  uploadToServer: false
})

// Register renderer error handler
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

// Configure Vue
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
Vue.use(Tree)

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
