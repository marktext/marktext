import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, nextTick, type App, type PropType } from 'vue'
import { createI18n } from 'vue-i18n'
import ElementPlus from 'element-plus'
import ExportSettings from '@/components/exportSettings/index.vue'
import bus from '@/bus'
import * as persistence from '@/components/exportSettings/persistence'

vi.mock('@/i18n', () => ({ t: (key: string) => key }))

/* eslint-disable vue/one-component-per-file -- Preference-control mocks isolate the real dialog from popper geometry. */
vi.mock('@/prefComponents/common/select/index.vue', async() => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({
    props: {
      description: { type: String, default: '' },
      value: { type: [String, Number, Boolean], default: '' },
      options: { type: Array as PropType<readonly { label: string; value: string | number | boolean }[]>, required: true },
      onChange: { type: Function as PropType<(value: unknown) => void>, required: true }
    },
    setup: props => () => h('label', [props.description, h('select', {
      value: String(props.value),
      onChange: (event: Event) => {
        const option = props.options.find(item => String(item.value) === (event.target as HTMLSelectElement).value)
        if (option) props.onChange(option.value)
      }
    }, props.options.map(option => h('option', { value: String(option.value) }, option.label)))])
  }) }
})

vi.mock('@/prefComponents/common/bool/index.vue', async() => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({
    props: { description: { type: String, default: '' }, bool: Boolean, onChange: { type: Function as PropType<(value: boolean) => void>, required: true } },
    setup: props => () => h('label', [props.description, h('input', {
      type: 'checkbox', checked: props.bool,
      onChange: (event: Event) => props.onChange((event.target as HTMLInputElement).checked)
    })])
  }) }
})

vi.mock('@/prefComponents/common/range/index.vue', async() => {
  const { defineComponent, h } = await import('vue')
  return { default: defineComponent({
    props: { description: { type: String, default: '' }, value: { type: Number, default: 12 }, onChange: { type: Function as PropType<(value: number) => void>, required: true } },
    setup: props => () => h('label', [props.description, h('input', {
      type: 'range', value: props.value,
      onInput: (event: Event) => props.onChange(Number((event.target as HTMLInputElement).value))
    })])
  }) }
})

let app: App | undefined
const exported = vi.fn()

const settle = async() => { await nextTick(); await nextTick() }
const unmount = () => { app?.unmount(); app = undefined; document.body.innerHTML = '' }
const open = async() => { bus.emit('showExportDialog', 'pdf'); await settle() }
const mount = async() => {
  const host = document.createElement('div')
  document.body.append(host)
  app = createApp(ExportSettings)
  app.use(ElementPlus)
  app.use(createI18n({ legacy: false, locale: 'en', messages: {}, missingWarn: false, fallbackWarn: false }))
  app.mount(host)
  await open()
}
const selectWith = (values: string[]) => {
  const select = [...document.querySelectorAll<HTMLSelectElement>('select')]
    .find(item => values.every(value => [...item.options].some(option => option.value === value)))
  if (!select) throw new Error(`Missing export select with choices: ${values.join(', ')}`)
  return select
}
const separators = () => selectWith(['theme', 'show', 'hide'])
const changeSelect = async(select: HTMLSelectElement, value: string) => {
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
  await settle()
}
const headerPanel = () => {
  const panel = document.querySelector<HTMLElement>('[role="tabpanel"][id$="-header"]')
  if (!panel) throw new Error('Missing header/footer panel')
  return panel
}
const customizeFont = async(enabled: boolean) => {
  const input = headerPanel().querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (!input) throw new Error('Missing header/footer font customization')
  input.checked = enabled
  input.dispatchEvent(new Event('change', { bubbles: true }))
  await settle()
}
const exportNow = async() => {
  const button = document.querySelector<HTMLButtonElement>('.button-controlls button')
  if (!button) throw new Error('Missing export button')
  button.click()
  await settle()
  return exported.mock.lastCall?.[0] as Record<string, unknown>
}

beforeEach(() => { localStorage.clear(); exported.mockClear(); bus.on('export', exported) })
afterEach(() => { unmount(); bus.off('export', exported) })

describe('independent export separator settings', () => {
  it('keeps separator choices available while font customization is off and omits theme overrides', async() => {
    await mount()
    expect(separators().value).toBe('theme')
    expect(headerPanel().querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false)
    expect(headerPanel().querySelector('input[type="range"]')).toBeNull()
    const options = await exportNow()
    expect(options).not.toHaveProperty('headerFooterStyled')
    expect(options).not.toHaveProperty('headerFooterFontSize')
  })

  it.each([['show', true], ['hide', false]] as const)('exports %s without enabling font customization', async(style, expected) => {
    await mount()
    await changeSelect(separators(), style)
    expect(await exportNow()).toMatchObject({ headerFooterStyled: expected })
    expect(exported.mock.lastCall?.[0]).not.toHaveProperty('headerFooterFontSize')
    expect(persistence.loadExportSettings()).toMatchObject({ headerFooterSeparatorStyle: style })
    await open()
    expect(separators().value).toBe(style)
    await changeSelect(selectWith(['academic', 'default', 'liber']), 'academic')
    expect(separators().value).toBe(style)
    expect(await exportNow()).toMatchObject({ theme: 'academic', headerFooterStyled: expected })
  })

  it('persists the chosen separator across an actual component remount', async() => {
    await mount()
    await changeSelect(separators(), 'hide')
    await exportNow()
    unmount()
    await mount()
    expect(separators().value).toBe('hide')
    expect(await exportNow()).toMatchObject({ headerFooterStyled: false })
  })

  it('toggles font size independently without resetting the separator choice', async() => {
    await mount()
    await changeSelect(separators(), 'hide')
    await customizeFont(true)
    const size = headerPanel().querySelector<HTMLInputElement>('input[type="range"]')
    if (!size) throw new Error('Missing header/footer font size')
    size.value = '18'
    size.dispatchEvent(new Event('input', { bubbles: true }))
    await settle()
    expect(await exportNow()).toMatchObject({ headerFooterStyled: false, headerFooterFontSize: 18 })
    await open()
    await customizeFont(false)
    const options = await exportNow()
    expect(options).toMatchObject({ headerFooterStyled: false })
    expect(options).not.toHaveProperty('headerFooterFontSize')
  })

  it('keeps the theme separator unset even when customizing font size', async() => {
    persistence.saveExportSettings({ headerFooterSeparatorStyle: 'theme', headerFooterCustomize: true, headerFooterStyled: false, headerFooterFontSize: 17 })
    await mount()
    const options = await exportNow()
    expect(options).not.toHaveProperty('headerFooterStyled')
    expect(options).toHaveProperty('headerFooterFontSize', 17)
  })

  it.each<[string, Record<string, unknown>, string, boolean | undefined, number | undefined, string]>([
    ['legacy hidden lines', { headerFooterCustomize: true, headerFooterStyled: false, pageSize: 'A5', headerFooterFontSize: 17 }, 'hide', false, 17, 'A5'],
    ['legacy theme lines', { headerFooterCustomize: false, headerFooterStyled: true }, 'theme', undefined, undefined, 'A4'],
    ['invalid choice with a legacy override', { headerFooterSeparatorStyle: 'invalid', headerFooterCustomize: true, headerFooterStyled: false }, 'hide', false, 12, 'A4'],
    ['invalid choice without a legacy override', { headerFooterSeparatorStyle: 'invalid' }, 'theme', undefined, undefined, 'A4']
  ])('restores %s in the mounted dialog', async(_name, saved, style, styled, fontSize, pageSize) => {
    persistence.saveExportSettings(saved)
    await mount()
    expect(separators().value).toBe(style)
    const options = await exportNow()
    expect(options.pageSize).toBe(pageSize)
    if (styled === undefined) expect(options).not.toHaveProperty('headerFooterStyled')
    else expect(options.headerFooterStyled).toBe(styled)
    if (fontSize === undefined) expect(options).not.toHaveProperty('headerFooterFontSize')
    else expect(options.headerFooterFontSize).toBe(fontSize)
    await open()
    await changeSelect(separators(), 'show')
    await changeSelect(separators(), style)
    expect(persistence.loadExportSettings()).toMatchObject({ headerFooterSeparatorStyle: style, pageSize })
    if (fontSize !== undefined) expect(persistence.loadExportSettings()).toHaveProperty('headerFooterFontSize', fontSize)
  })

  it('restores legacy separator choices through the actual persisted settings', () => {
    const cases: [Record<string, unknown>, string][] = [
      [{}, 'theme'],
      [{ headerFooterCustomize: false, headerFooterStyled: false }, 'theme'],
      [{ headerFooterStyled: false }, 'theme'],
      [{ headerFooterCustomize: true, headerFooterStyled: false }, 'hide'],
      [{ headerFooterCustomize: true, headerFooterStyled: true }, 'show'],
      [{ headerFooterCustomize: true }, 'show'],
      [{ headerFooterSeparatorStyle: 'theme', headerFooterCustomize: true, headerFooterStyled: false }, 'theme'],
      [{ headerFooterSeparatorStyle: 'show', headerFooterCustomize: false }, 'show'],
      [{ headerFooterSeparatorStyle: 'hide', headerFooterCustomize: true, headerFooterStyled: true }, 'hide'],
      [{ headerFooterSeparatorStyle: 'invalid', headerFooterCustomize: true, headerFooterStyled: false }, 'hide'],
      [{ headerFooterSeparatorStyle: null, headerFooterCustomize: true }, 'show'],
      [{ headerFooterSeparatorStyle: false, headerFooterCustomize: false }, 'theme']
    ]
    for (const [settings, expected] of cases) {
      persistence.saveExportSettings(settings)
      expect(persistence.resolveHeaderFooterSeparatorStyle(persistence.loadExportSettings())).toBe(expected)
    }
    expect(persistence.resolveHeaderFooterSeparatorStyle(
      Object.assign(Object.create({ headerFooterSeparatorStyle: 'hide', headerFooterStyled: false }), { headerFooterCustomize: true })
    )).toBe('show')
  })
})
