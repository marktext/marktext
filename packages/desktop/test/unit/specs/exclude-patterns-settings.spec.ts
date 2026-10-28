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

const enter = async(input: HTMLInputElement): Promise<void> => {
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true, cancelable: true }))
  await settle()
}

it('adds and removes tags without splitting glob commas or trimming filename whitespace', async() => {
  const update = vi.fn(async(patch) => ({
    status: 'persisted' as const,
    preferences: patch as UserPreferences
  }))
  const { root, value } = mount(['*.tmp', '**/{drafts,archive}/**'], update)
  const input = root.querySelector<HTMLInputElement>('input')!
  await fill(input, ' leading space.md ')
  await enter(input)
  expect(value.value).toEqual(['*.tmp', '**/{drafts,archive}/**', ' leading space.md '])
  expect(input.value).toBe('')
  await fill(input, '**/{cache,backup}/**')
  await enter(input)
  expect(value.value.at(-1)).toBe('**/{cache,backup}/**')
  for (let index = 0; index < 4; index++) {
    root.querySelector<HTMLButtonElement>('.el-tag__close')!.click()
    await settle()
  }
  expect(value.value).toEqual([])
})

it('keeps confirmed rules and shows an error when saving a tag fails', async() => {
  const update = vi.fn(async(): Promise<PreferenceUpdateResult> => ({
    status: 'failed', reason: 'storage-unavailable'
  }))
  const { root, value } = mount(['original'], update)
  const input = root.querySelector<HTMLInputElement>('input')!
  await fill(input, '**/{cache,backup}/**')
  await enter(input)
  expect(value.value).toEqual(['original'])
  expect(root.querySelector('.el-tag__content')?.textContent).toBe('original')
  expect(root.querySelector('[role="alert"]')?.textContent).toContain('Could not save')
  root.querySelector<HTMLButtonElement>('.el-tag__close')!.click()
  await settle()
  expect(value.value).toEqual(['original'])
  expect(root.querySelector('.el-tag__content')?.textContent).toBe('original')
})
