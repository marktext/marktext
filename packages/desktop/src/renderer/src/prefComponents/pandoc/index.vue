<template>
  <div class="pref-pandoc">
    <h4>{{ t('preferences.pandoc.title') }}</h4>
    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.pandoc.export.title') }}
        </h6>
      </template>
      <template #children>
        <bool
          :description="t('preferences.pandoc.export.enable')"
          :bool="pandocEnabled"
          :on-change="(value) => onSelectChange('pandocEnabled', value)"
          more="https://pandoc.org/"
        />
        <check-list
          :description="t('preferences.pandoc.export.formats')"
          :notes="t('preferences.pandoc.export.formatsNotes')"
          :value="pandocExportFormats"
          :options="formatOptions"
          :disable="!pandocEnabled"
          :on-change="(value) => onSelectChange('pandocExportFormats', value)"
        />
      </template>
    </compound>
    <compound :notes="t('preferences.pandoc.requirement.text')">
      <template #head>
        <h6 class="title">
          {{ t('preferences.pandoc.requirement.title') }}
        </h6>
      </template>
    </compound>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import Compound from '../common/compound/index.vue'
import Bool from '../common/bool/index.vue'
import CheckList from '../common/checkList/index.vue'
import { usePreferencesStore } from '@/store/preferences'
import type { PreferencesState } from '@/store/preferences'
import { PANDOC_EXPORT_FORMATS } from '@shared/pandoc'

const { t } = useI18n()

const preferenceStore = usePreferencesStore()

const { pandocEnabled, pandocExportFormats } = storeToRefs(preferenceStore)

// Same labels the menu shows, and deliberately untranslated for the same
// reason: they are format names, not prose.
const formatOptions = PANDOC_EXPORT_FORMATS.map((format) => ({
  label: format.label,
  value: format.id
}))

const onSelectChange = (type: keyof PreferencesState, value: unknown): void => {
  preferenceStore.SET_SINGLE_PREFERENCE({ type, value })
}
</script>

<script lang="ts">
export default {
  name: 'Pandoc'
}
</script>

<style scoped>
.pref-pandoc {
}
</style>
