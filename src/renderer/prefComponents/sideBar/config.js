import GeneralIcon from '@/assets/icons/pref_general.svg'
import EditorIcon from '@/assets/icons/pref_editor.svg'
import MarkdownIcon from '@/assets/icons/pref_markdown.svg'
import ThemeIcon from '@/assets/icons/pref_theme.svg'
import ImageIcon from '@/assets/icons/pref_image.svg'
import ImageUploaderIcon from '@/assets/icons/pref_image_uploader.svg'
import SpellIcon from '@/assets/icons/pref_spellcheck.svg'

import preferences from '../../../main/preferences/schema'

import i18n from '../../i18n'

export const category = [{
  name: i18n.t('preferences.general._title'),
  label: 'general',
  icon: GeneralIcon,
  path: '/preference/general'
}, {
  name: i18n.t('preferences.editor._title'),
  label: 'editor',
  icon: EditorIcon,
  path: '/preference/editor'
}, {
  name: i18n.t('preferences.markdown._title'),
  label: 'markdown',
  icon: MarkdownIcon,
  path: '/preference/markdown'
}, {
  name: i18n.t('preferences.spelling._title'),
  label: 'spelling',
  icon: SpellIcon,
  path: '/preference/spelling'
}, {
  name: i18n.t('preferences.theme._title'),
  label: 'theme',
  icon: ThemeIcon,
  path: '/preference/theme'
}, {
  name: i18n.t('preferences.image._title'),
  label: 'image',
  icon: ImageIcon,
  path: '/preference/image'
}, {
  name: i18n.t('preferences.imageUploader._title'),
  label: 'imageUploader',
  icon: ImageUploaderIcon,
  path: '/preference/imageUploader'
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
  .filter(({ category: ca }) => category.some(c => c.label === ca.toLowerCase()))
