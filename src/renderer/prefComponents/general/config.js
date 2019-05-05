import { isOsx } from '@/util'

const rawTitleBarStyleOptions = [{
  label: 'Custom',
  value: 'custom'
}, {
  label: 'Native',
  value: 'native'
}]

if (isOsx) {
  rawTitleBarStyleOptions.push({
    label: 'csd(macOS only)',
    value: 'csd'
  })
}

export const titleBarStyleOptions = rawTitleBarStyleOptions

export const fileSortByOptions = [{
  label: 'Create time',
  value: 'created'
}, {
  label: 'Modified time',
  value: 'modified'
}, {
  label: 'Title',
  value: 'title'
}]

export const languageOptions = [{
  label: 'English',
  value: 'en'
}]
