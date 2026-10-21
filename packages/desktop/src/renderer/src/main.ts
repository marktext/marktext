import { createApp, type App } from 'vue'
import { createRouter, createWebHashHistory } from 'vue-router'
import bootstrapRenderer from './bootstrap'
import axios from './axios'
import pinia from './store'
import './assets/symbolIcon'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import en from 'element-plus/es/locale/lang/en'

import i18nPlugin from './i18n'

import services from './services/index'
import routes from './router'
import Main from './Main.vue'

import './assets/styles/index.css'
import './assets/styles/printService.css'


window.marktext = {}
bootstrapRenderer()


const app: App<Element> = createApp(Main)

app.use(ElementPlus, {
  locale: en
})

const envType = window.marktext?.env?.type as string | undefined

const router = createRouter({
  history: createWebHashHistory(),
  // Use hash routing for Electron file URLs.
  routes: routes(envType)
})

app.use(router)
app.use(pinia)
app.use(i18nPlugin)

app.config.globalProperties.$http = axios

;(services as unknown as Array<Record<string, unknown> & { name: string }>).forEach((s) => {
  app.config.globalProperties['$' + s.name] = s[s.name]
})

app.mount('#app')
