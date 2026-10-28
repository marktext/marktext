import { afterEach, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App } from 'vue'
import { createI18n } from 'vue-i18n'
import ElementPlus from 'element-plus'
import TextBox from '../../../src/renderer/src/prefComponents/common/textBox/index.vue'

let app: App | undefined

afterEach(() => {
  app?.unmount()
  app = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
})

const mount = (props: Record<string, unknown>) => {
  const root = document.createElement('div')
  document.body.append(root)
  app = createApp(TextBox, { input: '', description: 'Value', ...props })
  app.use(ElementPlus)
  app.use(createI18n({ legacy: false, locale: 'en', messages: {} }))
  app.mount(root)
  const input = root.querySelector('input')
  if (!input) throw new Error('Missing settings input')
  const type = async(value: string) => {
    input.value = value
    input.dispatchEvent(new Event('input', { bubbles: true }))
    await nextTick()
  }
  return { root, input, type }
}

it('cancels a pending valid edit when later input is invalid', async() => {
  vi.useFakeTimers()
  const onChange = vi.fn()
  const { type, input } = mount({ onChange, regexValidator: /^valid$/ })
  await type('valid')
  await type('invalid')
  await vi.advanceTimersByTimeAsync(800)
  expect(onChange).not.toHaveBeenCalled()
  expect(input.getAttribute('aria-invalid')).toBe('true')
  await type('valid')
  await vi.advanceTimersByTimeAsync(800)
  expect(onChange).toHaveBeenCalledExactlyOnceWith('valid')
})

it('ignores an outdated async validation result', async() => {
  let finishFirst: ((valid: boolean) => void) | undefined
  const first = new Promise<boolean>(resolve => { finishFirst = resolve })
  const validate = vi.fn((value: string) => value === 'first' ? first : Promise.resolve(false))
  const onChange = vi.fn()
  const { type, input, root } = mount({ onChange, validate, emitTime: 0, errorMessage: 'Invalid path' })
  await type('first')
  await type('missing')
  await nextTick()
  finishFirst?.(true)
  await nextTick()
  expect(onChange).not.toHaveBeenCalled()
  expect(input.getAttribute('aria-invalid')).toBe('true')
  expect(root.querySelector('[role="alert"]')?.textContent).toBe('Invalid path')
})

it('flushes edits on change and when leaving without saving them twice', async() => {
  vi.useFakeTimers()
  const onChange = vi.fn()
  const { type, input } = mount({ onChange })
  await type('changed')
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await nextTick()
  await vi.advanceTimersByTimeAsync(800)
  expect(onChange).toHaveBeenCalledExactlyOnceWith('changed')
  await type('leaving')
  app?.unmount()
  app = undefined
  expect(onChange).toHaveBeenLastCalledWith('leaving')
  await vi.advanceTimersByTimeAsync(800)
  expect(onChange).toHaveBeenCalledTimes(2)
})
