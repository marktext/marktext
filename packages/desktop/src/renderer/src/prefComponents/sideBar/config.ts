import { preferenceCategories } from '../categories'
import { isEqualAccelerator } from 'common/keybinding'
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

export const getCategory = (): PrefCategory[] => preferenceCategories.map(category => ({
  name: t(`preferences.categories.${category.id}`),
  label: category.id,
  icon: category.icon,
  path: `/preference/${category.id}`
}))

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
        keywords: [key, ...(definition.aliases ?? []), preferenceNotes(key), entry?.description ?? '', definition.notes ? englishText(definition.notes) : ''],
        kind: 'setting' as const
      }
    })

export const matchesSearch = (entry: SearchEntry, query: string): boolean => {
  const acceleratorQuery = query.trim().replace(/⌘/g, 'Command+').replace(/⌃/g, 'Ctrl+').replace(/⇧/g, 'Shift+').replace(/⌥/g, 'Alt+')
  if (entry.accelerator && isEqualAccelerator(entry.accelerator, acceleratorQuery)) return true
  const content = [entry.preference, entry.category, entry.preferenceEn, entry.categoryEn, ...entry.keywords]
    .join(' ').toLocaleLowerCase()
  return query.trim().toLocaleLowerCase().split(/\s+/).every(word => content.includes(word))
}
