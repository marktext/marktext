import { afterEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, reactive, h, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import RecoverySettings from '../../../src/renderer/src/prefComponents/general/recoverySettings.vue'
import {
  RECOVERY_DEFAULTS,
  type RecoveryPreferences,
  type UserPreferences,
  type PreferenceUpdateResult
} from '../../../src/shared/types/applicationState'

let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})
const mount = (
  update: (patch: Partial<RecoveryPreferences>) => Promise<PreferenceUpdateResult>,
  chooseDirectory = async(): Promise<string | null> => '/notes'
) => {
  const value = reactive({ ...RECOVERY_DEFAULTS })
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
  app.use(createI18n({ legacy: false, locale: 'en', fallbackLocale: 'en' }))
  app.mount(root)
  return { value, root }
}
const settle = async() => {
  await Promise.resolve()
  await Promise.resolve()
  await nextTick()
}

describe('startup recovery settings', () => {
  it('offers five startup policies and three independent restoration options', async() => {
    const update = vi.fn(async(patch) => ({
      status: 'persisted' as const,
      preferences: { ...RECOVERY_DEFAULTS, ...patch } as UserPreferences
    }))
    const { root, value } = mount(update)
    const select = root.querySelector('select')
    if (!select) throw new Error('Missing startup selector')
    expect([...select.options].map((option) => option.value)).toEqual([
      'restoreAll',
      'restoreLastWindow',
      'openLastFolder',
      'folder',
      'blank'
    ])
    expect(root.querySelectorAll('input[type=checkbox]')).toHaveLength(3)
    select.value = 'restoreLastWindow'
    select.dispatchEvent(new Event('change'))
    await settle()
    expect(value.startUpAction).toBe('restoreLastWindow')
  })
  it('updates the selected directory and folder policy together, and leaves cancellation unchanged', async() => {
    const update = vi.fn(async(patch) => ({
      status: 'persisted' as const,
      preferences: { ...RECOVERY_DEFAULTS, ...patch } as UserPreferences
    }))
    const { root } = mount(update)
    root.querySelector('button')?.click()
    await settle()
    expect(update).toHaveBeenCalledWith({
      startUpAction: 'folder',
      defaultDirectoryToOpen: '/notes'
    })
  })
  it('does not show a failed change as saved and reports the failure', async() => {
    const { root, value } = mount(async() => ({ status: 'failed', reason: 'storage-unavailable' }))
    const checkbox = root.querySelector<HTMLInputElement>('input[type=checkbox]')
    if (!checkbox) throw new Error('Missing layout checkbox')
    checkbox.checked = false
    checkbox.dispatchEvent(new Event('change'))
    await settle()
    expect(value.restoreLayoutState).toBe(true)
    expect(checkbox.checked).toBe(true)
    expect(root.querySelector('[role=alert]')?.textContent).toContain('could not be saved')
  })
  it('keeps the policy unchanged when directory selection is cancelled', async() => {
    const update = vi.fn()
    const { root, value } = mount(update, async() => null)
    root.querySelector('button')?.click()
    await settle()
    expect(update).not.toHaveBeenCalled()
    expect(value.startUpAction).toBe('restoreAll')
  })
})
