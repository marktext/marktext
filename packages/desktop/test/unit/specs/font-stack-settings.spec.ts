import { afterEach, expect, it, vi } from 'vitest'
import { createApp, h, nextTick, ref, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import ElementPlus from 'element-plus'
import FontStack from '@/prefComponents/common/fontTextBox/fontStack.vue'
import { parseFontFamilies, serializeFontFamilies } from '@/prefComponents/common/fontTextBox/fontFamilies'

let app: App | undefined

afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
})

const mount = (initial = 'Open Sans') => {
  const value = ref(initial)
  const onChange = vi.fn((next: string) => { value.value = next })
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp({
    setup: () => () => h(FontStack, {
      value: value.value,
      fonts: ['Open Sans', 'Arial', 'PingFang SC'],
      description: 'Editor font',
      disabled: false,
      onChange
    })
  })
  app.use(ElementPlus)
  app.use(createI18n({ legacy: false, locale: 'en', messages: {} }))
  app.mount(root)
  const select = async(font: string) => {
    root.querySelector<HTMLButtonElement>('.el-input-tag__suffix button')?.click()
    await nextTick()
    const option = [...document.querySelectorAll<HTMLButtonElement>('.font-stack-picker .font-stack-option')]
      .find(button => button.textContent?.trim() === font)
    if (!option) throw new Error(`Missing font option: ${font}`)
    option.click()
    await nextTick()
  }
  return { root, value, onChange, select }
}

it('preserves family order, quoted commas, escapes and generic fallback semantics', () => {
  expect(parseFontFamilies('Open Sans, "Font, With Comma", \'PingFang SC\', sans-serif')).toEqual([
    'Open Sans', 'Font, With Comma', 'PingFang SC', 'sans-serif'
  ])
  const families = ['Font "A"', 'Font\\B', 'PingFang SC', 'sans-serif']
  const serialized = serializeFontFamilies(families)
  expect(parseFontFamilies(serialized)).toEqual(families)
  expect(serialized.endsWith(', sans-serif')).toBe(true)
})

it('selects a multiword font and persists the stack as CSS', async() => {
  const { select, value, root } = mount()
  await select('PingFang SC')
  expect(parseFontFamilies(value.value)).toEqual(['Open Sans', 'PingFang SC'])
  expect([...root.querySelectorAll('.el-tag__content')].map(tag => tag.textContent)).toEqual([
    'Open Sans', 'PingFang SC'
  ])
})

it('only filters options when typing in the picker and cannot add an unlisted font', async() => {
  const { root, value } = mount()
  root.querySelector<HTMLButtonElement>('.el-input-tag__suffix button')?.click()
  await nextTick()
  const input = document.querySelector<HTMLInputElement>('.font-stack-picker input')
  if (!input) throw new Error('Missing font search input')
  input.value = 'Custom Font'
  input.dispatchEvent(new Event('input', { bubbles: true }))
  await nextTick()
  expect(document.querySelector('.font-stack-picker .font-stack-option')).toBeNull()
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', isComposing: true, bubbles: true }))
  await nextTick()
  expect(value.value).toBe('Open Sans')
  input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', bubbles: true }))
  await nextTick()
  expect(value.value).toBe('Open Sans')
})

it('prevents direct input, excludes selected fonts and saves an empty stack when cleared', async() => {
  const { select, value, root, onChange } = mount('Arial')
  expect(root.querySelector('input')?.readOnly).toBe(true)
  root.querySelector<HTMLElement>('.el-tag__close')?.click()
  await nextTick()
  expect(root.querySelectorAll('.el-tag')).toHaveLength(0)
  expect(value.value).toBe('')
  expect(onChange).toHaveBeenCalledExactlyOnceWith('')
  await select('PingFang SC')
  expect(parseFontFamilies(value.value)).toEqual(['PingFang SC'])
})

it('persists the reordered stack when a tag is dragged ahead of the first font', async() => {
  const { root, value } = mount('Open Sans, Arial')
  const [first, second] = root.querySelectorAll<HTMLElement>('.el-tag')
  const transfer = { effectAllowed: '', dropEffect: '' }
  const drag = (type: string, target: HTMLElement) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 0 })
    Object.defineProperty(event, 'dataTransfer', { value: transfer })
    target.dispatchEvent(event)
  }
  drag('dragstart', second)
  drag('dragover', first)
  drag('dragend', second)
  await nextTick()
  expect(parseFontFamilies(value.value)).toEqual(['Arial', 'Open Sans'])
})
