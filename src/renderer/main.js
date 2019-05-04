import Vue from 'vue'
import VueElectron from 'vue-electron'
import axios from 'axios'
import sourceMapSupport from 'source-map-support'
import lang from 'element-ui/lib/locale/lang/en'
import locale from 'element-ui/lib/locale'
import bootstrapRenderer from './bootstrap'
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

// -----------------------------------------------

// Decode source map in production - must be registered first
sourceMapSupport.install({
  environment: 'node',
  handleUncaughtExceptions: false,
  hookRequire: false
})

global.marktext = {}
bootstrapRenderer()

// -----------------------------------------------
// Be careful when changing code before this line!

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

Vue.use(VueElectron)
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
