import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import schema from '../../../src/main/preferences/schema.json'
import defaultPreferences from '../../../static/preference.json'
import { usePreferencesStore } from '@/store/preferences'

const here = dirname(fileURLToPath(import.meta.url))
const markdownPreferencePath = resolve(here, '../../../src/renderer/src/prefComponents/markdown/index.vue')
const editorPath = resolve(here, '../../../src/renderer/src/components/editorWithTabs/editor.vue')

describe('frontmatter default collapse preference', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('defaults to collapsed in every preference source', () => {
    const preferenceSchema = schema as Record<string, { default?: unknown }>
    const defaults = defaultPreferences as Record<string, unknown>
    const store = usePreferencesStore() as unknown as Record<string, unknown>

    expect(preferenceSchema.frontmatterDefaultCollapsed?.default).toBe(true)
    expect(defaults.frontmatterDefaultCollapsed).toBe(true)
    expect(store.frontmatterDefaultCollapsed).toBe(true)
  })

  it('exposes the preference in Settings and passes it to Muya', () => {
    const preferenceSource = readFileSync(markdownPreferencePath, 'utf8')
    const editorSource = readFileSync(editorPath, 'utf8')

    expect(preferenceSource).toContain("onSelectChange('frontmatterDefaultCollapsed'")
    expect(editorSource).toContain('frontmatterDefaultCollapsed: frontmatterDefaultCollapsed.value')
    expect(editorSource).toContain('watch(frontmatterDefaultCollapsed')
  })
})
