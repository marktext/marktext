import { afterEach, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import { createPinia, setActivePinia } from 'pinia'
import { createI18n } from 'vue-i18n'
vi.hoisted(() => {
  Object.assign(window, {
    electron: { ipcRenderer: { send: vi.fn(), on: vi.fn() } },
    path: { sep: '/', dirname: (p: string) => p }
  })
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
    unobserve() {}
  }
})
vi.mock('@/services/notification', () => ({ default: { notify: vi.fn() } }))
vi.mock('@/components/sideBar/toc.vue', () => ({ default: { template: '<div>Headings</div>' } }))
vi.mock('@/components/iconTooltip/index.vue', () => ({
  default: { template: '<span><slot /></span>' }
}))
import Outline from '@/components/editorWithTabs/outline.vue'
import { useLayoutStore } from '@/store/layout'
import { createDefaultLayout } from '../../../src/shared/applicationState/defaults'
let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})
it('mounts restored outline placement and applies collapse and keyboard resizing to window intent', async() => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const store = useLayoutStore()
  const layout = createDefaultLayout()
  layout.outline = { visible: true, position: 'right', preferredWidthPx: 390 }
  store.INITIALIZE_WINDOW_LAYOUT(layout)
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp(Outline)
  app
    .use(pinia)
    .use(createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false }))
  app.mount(root)
  await nextTick()
  const outline = root.querySelector<HTMLElement>('.document-outline')
  expect(outline?.classList.contains('is-right')).toBe(true)
  expect(outline?.style.getPropertyValue('--outline-width')).toBe('180px')
  expect(store.outlineWidth).toBe(390)
  root
    .querySelector('.outline-resizer')
    ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home' }))
  await nextTick()
  expect(store.outlineWidth).toBe(180)
  root.querySelector<HTMLButtonElement>('.outline-toggle')?.click()
  await nextTick()
  expect(store.showToc).toBe(false)
  expect(outline?.classList.contains('is-expanded')).toBe(false)
})
