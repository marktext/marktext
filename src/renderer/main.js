import Vue from 'vue'
import axios from 'axios'

import App from './App'
import store from './store'

import './index.css'

import { Dialog, Form, FormItem, InputNumber, Button } from 'element-ui'
Vue.use(Dialog)
Vue.use(Form)
Vue.use(FormItem)
Vue.use(InputNumber)
Vue.use(Button)

if (!process.env.IS_WEB) Vue.use(require('vue-electron'))
Vue.http = Vue.prototype.$http = axios
Vue.config.productionTip = false

/* eslint-disable no-new */
new Vue({
  components: { App },
  store,
  template: '<App/>'
}).$mount('#app')
