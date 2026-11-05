import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import { createPinia, setActivePinia } from 'pinia'
import ElementPlus from 'element-plus'
import en from '../../../static/locales/en.json'
import General from '../../../src/renderer/src/prefComponents/general/index.vue'
import { usePreferencesStore } from '../../../src/renderer/src/store/preferences'
import type { UserPreferences } from '../../../src/shared/types/preferences'

// The renderer store modules read `window.path` and `window.electron` when they load.
vi.hoisted(() => {
  const preloadWindow = globalThis as unknown as {
    path?: { sep: string; dirname: (pathname: string) => string }
    electron?: unknown
  }
  preloadWindow.path ??= { sep: '/', dirname: (pathname: string) => pathname }
  preloadWindow.electron ??= { ipcRenderer: { send: () => {}, on: () => () => {}, invoke: async() => undefined } }
})

type TitleBarStyle = UserPreferences['titleBarStyle']

let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})

const settle = async(): Promise<void> => {
  for (let turn = 0; turn < 4; turn++) await Promise.resolve()
  await nextTick()
}

// The main process answers with the style each open window had when it was created, which
// the Preferences window cannot see for itself.
const mountAppearancePage = async(savedStyle: TitleBarStyle, openWindowStyles: TitleBarStyle[]) => {
  const invoke = vi.fn(async(channel: string) =>
    channel === 'mt::get-open-window-title-bar-styles' ? openWindowStyles : undefined
  )
  window.electron = {
    ipcRenderer: { invoke, send: vi.fn(), on: vi.fn(() => () => {}) }
  } as unknown as typeof window.electron
  Element.prototype.scrollIntoView = vi.fn()
  // The Preferences window opened with the saved style, as it does after the user reopens it.
  window.marktext = { initialState: { titleBarStyle: savedStyle } } as unknown as typeof window.marktext

  const pinia = createPinia()
  setActivePinia(pinia)
  const preferencesStore = usePreferencesStore()
  preferencesStore.titleBarStyle = savedStyle

  const root = document.createElement('div')
  document.body.append(root)
  app = createApp({ render: () => h(General, { groups: ['windowAppearance'] }) })
  app.use(pinia)
  app.use(ElementPlus)
  app.use(createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } }))
  app.mount(root)
  await settle()
  return { root, preferencesStore }
}

const restartNotice = (root: HTMLElement): Element | null => root.querySelector('.title-bar-style-restart')

describe('title bar style restart notice', () => {
  it('stays after Preferences reopens with the new style while an editor window keeps the old one', async() => {
    const { root } = await mountAppearancePage('native', ['custom', 'native'])
    expect(restartNotice(root)).not.toBeNull()
  })

  it('stays hidden when every open window already has the saved style', async() => {
    const { root } = await mountAppearancePage('native', ['native', 'native'])
    expect(restartNotice(root)).toBeNull()
  })

  it('appears when the user changes the style and goes away when they change it back', async() => {
    const { root, preferencesStore } = await mountAppearancePage('custom', ['custom', 'custom'])
    expect(restartNotice(root)).toBeNull()

    preferencesStore.SET_SINGLE_PREFERENCE({ type: 'titleBarStyle', value: 'native' })
    await settle()
    expect(restartNotice(root)).not.toBeNull()

    preferencesStore.SET_SINGLE_PREFERENCE({ type: 'titleBarStyle', value: 'custom' })
    await settle()
    expect(restartNotice(root)).toBeNull()
  })
})
