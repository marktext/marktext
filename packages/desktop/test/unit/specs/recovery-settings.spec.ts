import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, reactive, h, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import ElementPlus from 'element-plus'
import en from '../../../static/locales/en.json'
import RecoverySettings from '../../../src/renderer/src/prefComponents/general/recoverySettings.vue'
import {
  RECOVERY_DEFAULTS,
  type RecoveryPreferences,
  type UserPreferences,
  type PreferenceUpdateResult
} from '../../../src/shared/types/preferences'

let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})
const mount = (
  update: (patch: Partial<RecoveryPreferences>) => Promise<PreferenceUpdateResult>,
  chooseDirectory = async(): Promise<string | null> => '/notes',
  initial: Partial<RecoveryPreferences> = {}
) => {
  const value = reactive({ ...RECOVERY_DEFAULTS, ...initial })
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp({
    render: () =>
      h(RecoverySettings, {
        value,
        update,
        chooseDirectory,
        onPersisted: (prefs: UserPreferences) => Object.assign(value, prefs)
      })
  })
  app.use(ElementPlus)
  app.use(createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en', messages: { en } }))
  app.mount(root)
  return { value, root }
}
const settle = async() => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}
const selectPolicy = async(root: HTMLElement, label: string): Promise<void> => {
  root.querySelector<HTMLElement>('.el-select__wrapper')?.click()
  await settle()
  const option = [...document.querySelectorAll<HTMLElement>('.el-select-dropdown__item')]
    .find(option => option.textContent?.trim() === label)
  if (!option) throw new Error(`Missing startup policy: ${label}`)
  option.click()
  await settle()
}

describe('startup recovery settings', () => {
  it('uses the existing settings controls for five policies and three restoration options', async() => {
    const update = vi.fn(async(patch) => ({
      status: 'persisted' as const,
      preferences: { ...RECOVERY_DEFAULTS, ...patch } as UserPreferences
    }))
    const { root, value } = mount(update)
    expect(root.querySelector('.pref-compound-item h6.title')?.textContent).toBe('Startup Options')
    expect(root.querySelectorAll('.el-switch')).toHaveLength(3)
    expect(root.querySelector('select')).toBeNull()
    expect(root.querySelector('.startup-directory')).toBeNull()
    await selectPolicy(root, 'Restore the last active window')
    expect(document.querySelectorAll('.el-select-dropdown__item')).toHaveLength(5)
    expect(value.startUpAction).toBe('restoreLastWindow')
    expect(update).toHaveBeenCalledExactlyOnceWith({ startUpAction: 'restoreLastWindow' })
    expect(root.querySelector('.startup-directory')).toBeNull()
    await selectPolicy(root, 'Open the selected folder')
    expect(root.querySelector('.startup-directory .el-button')).not.toBeNull()
    await selectPolicy(root, 'New blank document')
    expect(root.querySelector('.startup-directory')).toBeNull()
  })
  it('updates the selected directory and folder policy together', async() => {
    const update = vi.fn(async(patch) => ({
      status: 'persisted' as const,
      preferences: { ...RECOVERY_DEFAULTS, ...patch } as UserPreferences
    }))
    const { root } = mount(update, async() => '/notes', { startUpAction: 'folder' })
    root.querySelector<HTMLButtonElement>('.startup-directory .el-button')?.click()
    await settle()
    expect(update).toHaveBeenCalledExactlyOnceWith({
      startUpAction: 'folder',
      defaultDirectoryToOpen: '/notes'
    })
    expect(root.querySelector('.startup-directory')?.textContent).toContain('/notes')
  })
  it('restores a switch and reports the failure when persistence fails', async() => {
    const { root, value } = mount(async() => ({ status: 'failed', reason: 'storage-unavailable' }))
    root.querySelector<HTMLElement>('.el-switch')?.click()
    await settle()
    expect(value.restoreLayoutState).toBe(true)
    expect(root.querySelector<HTMLInputElement>('[role=switch]')?.checked).toBe(true)
    expect(root.querySelector('[role=alert]')?.textContent).toContain('could not be saved')
  })
  it('restores the selected policy when persistence fails', async() => {
    const { root, value } = mount(async() => ({ status: 'failed', reason: 'storage-unavailable' }))
    await selectPolicy(root, 'Restore the last active window')
    expect(value.startUpAction).toBe('restoreAll')
    expect(root.querySelector('.el-select__wrapper')?.textContent).toContain('Restore all windows')
    expect(root.querySelector('[role=alert]')?.textContent).toContain('could not be saved')
  })
  it('disables shared controls while a change is being persisted', async() => {
    let finish: (result: PreferenceUpdateResult) => void = () => {}
    const { root } = mount(() => new Promise(resolve => { finish = resolve }))
    root.querySelector<HTMLElement>('.el-switch')?.click()
    await settle()
    expect([...root.querySelectorAll<HTMLInputElement>('[role=switch]')].every(input => input.disabled)).toBe(true)
    expect(root.querySelector('.el-select__wrapper')?.classList.contains('is-disabled')).toBe(true)
    finish({ status: 'failed', reason: 'storage-unavailable' })
    await settle()
    expect([...root.querySelectorAll<HTMLInputElement>('[role=switch]')].every(input => !input.disabled)).toBe(true)
  })
  it('keeps the policy unchanged when directory selection is cancelled', async() => {
    const update = vi.fn()
    const { root, value } = mount(update, async() => null, {
      startUpAction: 'folder', defaultDirectoryToOpen: '/previous'
    })
    root.querySelector<HTMLButtonElement>('.startup-directory .el-button')?.click()
    await settle()
    expect(update).not.toHaveBeenCalled()
    expect(value.startUpAction).toBe('folder')
    expect(value.defaultDirectoryToOpen).toBe('/previous')
  })
})
