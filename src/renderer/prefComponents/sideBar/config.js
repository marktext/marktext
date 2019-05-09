import GeneralIcon from '@/assets/icons/pref_general.svg'
import EditorIcon from '@/assets/icons/pref_editor.svg'
import MarkdownIcon from '@/assets/icons/pref_markdown.svg'
import ThemeIcon from '@/assets/icons/pref_theme.svg'

import preferences from '../../../main/preferences/schema'

export const category = [{
  name: 'General',
  icon: GeneralIcon,
  path: '/preference/general'
}, {
  name: 'Editor',
  icon: EditorIcon,
  path: '/preference/editor'
}, {
  name: 'Markdown',
  icon: MarkdownIcon,
  path: '/preference/markdown'
}, {
  name: 'Theme',
  icon: ThemeIcon,
  path: '/preference/theme'
}]

export const searchContent = Object.keys(preferences).map(k => {
  const { description, enum: emums } = preferences[k]
  let [category, preference] = description.split('--')
  if (Array.isArray(emums)) {
    preference += ` optional values: ${emums.join(', ')}`
  }
  return {
    category,
    preference
  }
})
