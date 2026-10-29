import {
  Setting as GeneralIcon,
  Edit as EditorIcon,
  Document as MarkdownIcon,
  Brush as ThemeIcon,
  Picture as ImageIcon,
  Reading as SpellIcon,
  Operation as KeyBindingIcon
} from '@element-plus/icons-vue'

import schema from '@shared/preferences/schema.json'
import type { PreferenceSchemaEntry } from '@shared/types/preferences'
import { t } from '@/i18n'
import { englishText, isPreferenceAvailable, preferenceDefinitions, preferenceLabel, preferenceNotes } from '../registry'

interface PrefCategory {
  name: string
  label: string
  icon: unknown
  path: string
}

export interface SearchEntry {
  key: string
  category: string
  categoryEn: string
  preference: string
  preferenceEn: string
  routeCategory: string
  description: string
  enum: unknown[] | undefined
  keywords: string[]
  kind: 'setting' | 'keybinding'
  accelerator?: string
}

export const getCategory = (): PrefCategory[] => [
  {
    name: t('preferences.categories.general'),
    label: 'general',
    icon: GeneralIcon,
    path: '/preference/general'
  },
  {
    name: t('preferences.categories.editor'),
    label: 'editor',
    icon: EditorIcon,
    path: '/preference/editor'
  },
  {
    name: t('preferences.categories.markdown'),
    label: 'markdown',
    icon: MarkdownIcon,
    path: '/preference/markdown'
  },
  {
    name: t('preferences.categories.spelling'),
    label: 'spelling',
    icon: SpellIcon,
    path: '/preference/spelling'
  },
  {
    name: t('preferences.categories.theme'),
    label: 'theme',
    icon: ThemeIcon,
    path: '/preference/theme'
  },
  {
    name: t('preferences.categories.image'),
    label: 'image',
    icon: ImageIcon,
    path: '/preference/image'
  },
  {
    name: t('preferences.categories.keybindings'),
    label: 'keybindings',
    icon: KeyBindingIcon,
    path: '/preference/keybindings'
  }
]


const preferencesSchema: Record<string, PreferenceSchemaEntry> = schema

export const getTranslatedSearchContent = (): SearchEntry[] =>
  Object.entries(preferenceDefinitions)
    .filter(([, definition]) => isPreferenceAvailable(definition))
    .map(([key, definition]) => {
      const category = definition.category
      const entry = preferencesSchema[key]
      const categoryEn = category.charAt(0).toUpperCase() + category.slice(1)
      const preferenceEn = englishText(definition.label)
      return {
        key,
        category: t(`preferences.categories.${category}`),
        categoryEn,
        preference: preferenceLabel(key),
        preferenceEn,
        routeCategory: category,
        description: entry?.description ?? `${categoryEn}--${preferenceEn}`,
        enum: entry?.enum,
        keywords: [key, preferenceNotes(key), entry?.description ?? '', definition.notes ? englishText(definition.notes) : ''],
        kind: 'setting' as const
      }
    })

export const matchesSearch = (entry: SearchEntry, query: string): boolean => {
  const content = [entry.preference, entry.category, entry.preferenceEn, entry.categoryEn, ...entry.keywords]
    .join(' ').toLocaleLowerCase()
  return query.trim().toLocaleLowerCase().split(/\s+/).every(word => content.includes(word))
}
