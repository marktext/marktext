import GeneralIcon from '@/assets/icons/pref_general.svg'
import EditorIcon from '@/assets/icons/pref_editor.svg'
import MarkdownIcon from '@/assets/icons/pref_markdown.svg'
import ThemeIcon from '@/assets/icons/pref_theme.svg'
import ImageIcon from '@/assets/icons/pref_image.svg'
import SpellIcon from '@/assets/icons/pref_spellcheck.svg'
import KeyBindingIcon from '@/assets/icons/pref_key_binding.svg'

import preferences from '../../../main/preferences/schema'

const categoryLabels = ['general', 'editor', 'markdown', 'spelling', 'theme', 'image', 'keybindings']

export const category = (t) => [{
  name: t('pref.sidebar.general'),
  label: 'general',
  icon: GeneralIcon,
  path: '/preference/general'
}, {
  name: t('pref.sidebar.editor'),
  label: 'editor',
  icon: EditorIcon,
  path: '/preference/editor'
}, {
  name: t('pref.sidebar.markdown'),
  label: 'markdown',
  icon: MarkdownIcon,
  path: '/preference/markdown'
}, {
  name: t('pref.sidebar.spelling'),
  label: 'spelling',
  icon: SpellIcon,
  path: '/preference/spelling'
}, {
  name: t('pref.sidebar.theme'),
  label: 'theme',
  icon: ThemeIcon,
  path: '/preference/theme'
}, {
  name: t('pref.sidebar.image'),
  label: 'image',
  icon: ImageIcon,
  path: '/preference/image'
}, {
  name: t('pref.sidebar.keyBindings'),
  label: 'keybindings',
  icon: KeyBindingIcon,
  path: '/preference/keybindings'
}]

export const searchContent = Object.keys(preferences).map(k => {
  const { description, enum: emums } = preferences[k]
  let [cat, preference] = description.split('--')
  if (Array.isArray(emums)) {
    preference += ` optional values: ${emums.join(', ')}`
  }
  return {
    category: cat,
    preference
  }
})
  .filter(({ category: ca }) => categoryLabels.includes(ca.toLowerCase()))
