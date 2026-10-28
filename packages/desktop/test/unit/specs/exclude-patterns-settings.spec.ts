import { afterEach, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import ElementPlus from 'element-plus'
import en from '../../../static/locales/en.json'
import ExcludePatterns from '../../../src/renderer/src/prefComponents/general/excludePatterns.vue'
import type { PreferenceUpdateResult, UserPreferences } from '../../../src/shared/types/preferences'

let app: App | undefined
afterEach(() => {
  app?.unmount()
  document.body.innerHTML = ''
})
const settle = async(): Promise<void> => {
  await new Promise(resolve => setTimeout(resolve, 0))
  await nextTick()
}
const mount = (
  initial: string[],
  update: (patch: Pick<UserPreferences, 'treePathExcludePatterns'>) => Promise<PreferenceUpdateResult>
) => {
  const value = ref(initial)
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp({
    render: () => h(ExcludePatterns, {
      value: value.value,
      update,
      onPersisted: (preferences: UserPreferences) => {
        value.value = preferences.treePathExcludePatterns
      }
    })
  })
  app.use(ElementPlus)
  app.use(createI18n({ legacy: false, locale: 'en', messages: { en } }))
  app.mount(root)
  return { root, value }
}
const fill = async(input: HTMLInputElement, text: string): Promise<void> => {
  input.value = text
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await settle()
}

it('edits, adds and removes individual rules without splitting glob commas', async() => {
  const update = vi.fn(async(patch) => ({
    status: 'persisted' as const,
    preferences: patch as UserPreferences
  }))
  const { root, value } = mount(['*.tmp', '**/{drafts,archive}/**'], update)
  const existing = root.querySelector<HTMLInputElement>('input')!
  await fill(existing, '**/{cache,backup}/**')
  existing.dispatchEvent(new Event('change', { bubbles: true }))
  await settle()
  expect(value.value).toEqual(['**/{cache,backup}/**', '**/{drafts,archive}/**'])
  const input = root.querySelector<HTMLInputElement>('form input')!
  await fill(input, ' leading space.md')
  root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle()
  expect(value.value).toEqual(['**/{cache,backup}/**', '**/{drafts,archive}/**', ' leading space.md'])
  expect(input.value).toBe('')
  root.querySelector<HTMLButtonElement>('.pattern-row button')!.click()
  await settle()
  expect(value.value).toEqual(['**/{drafts,archive}/**', ' leading space.md'])
  root.querySelector<HTMLButtonElement>('.pattern-row button')!.click()
  await settle()
  root.querySelector<HTMLButtonElement>('.pattern-row button')!.click()
  await settle()
  expect(value.value).toEqual([])
})

it('keeps confirmed rules and an unsaved new rule when persistence fails', async() => {
  const update = vi.fn(async(): Promise<PreferenceUpdateResult> => ({
    status: 'failed', reason: 'storage-unavailable'
  }))
  const { root, value } = mount(['original'], update)
  const input = root.querySelector<HTMLInputElement>('input')!
  await fill(input, 'changed')
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await settle()
  expect(value.value).toEqual(['original'])
  expect(input.value).toBe('original')
  expect(root.querySelector('[role="alert"]')?.textContent).toContain('Could not save')
  await fill(root.querySelector<HTMLInputElement>('form input')!, '*.tmp')
  root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  await settle()
  expect(root.querySelector<HTMLInputElement>('form input')!.value).toBe('*.tmp')
  expect(value.value).toEqual(['original'])
})
