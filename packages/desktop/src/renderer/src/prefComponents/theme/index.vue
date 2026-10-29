<template>
  <div class="pref-theme">
    <h4 v-if="!embedded">
      {{ t('preferences.theme.title') }}
    </h4>
    <compound>
      <template #head>
        <h6 class="title">
          {{ t('preferences.theme.title') }}
        </h6>
      </template>
      <template #children>
        <bool
          id="setting-followSystemTheme"
          :description="preferenceLabel('followSystemTheme')"
          :notes="followSystemTheme ? t('preferences.theme.followSystemNote') : ''"
          :bool="followSystemTheme"
          :on-change="value => onSelectChange('followSystemTheme', value)"
        />
        <section id="setting-theme">
          <theme-choice
            v-if="!followSystemTheme"
            :description="preferenceLabel('theme')"
            :value="theme"
            @choose="openPicker('theme')"
          />
          <div
            v-else
            class="theme-mode-choices"
          >
            <theme-choice
              v-for="key in modeThemeKeys"
              :id="`setting-${key}`"
              :key="key"
              :description="preferenceLabel(key)"
              :value="key === 'lightModeTheme' ? lightModeTheme : darkModeTheme"
              @choose="openPicker(key)"
            />
          </div>
        </section>
      </template>
    </compound>
    <details
      id="setting-customCss"
      class="custom-css"
    >
      <summary>{{ preferenceLabel('customCss') }}</summary>
      <textarea
        class="custom-css-input"
        rows="10"
        :aria-label="preferenceLabel('customCss')"
        :value="customCss"
        @change="event => onSelectChange('customCss', (event.target as HTMLTextAreaElement).value)"
      />
    </details>
    <el-dialog
      v-model="pickerOpen"
      class="theme-picker"
      :title="t('preferences.theme.chooseFor', { name: preferenceLabel(pickerTarget) })"
      width="min(800px, 90vw)"
      destroy-on-close
    >
      <div class="theme-picker-tools">
        <el-input
          v-model="query"
          :aria-label="t('preferences.theme.searchThemes')"
          :placeholder="t('preferences.theme.searchThemes')"
          clearable
        />
        <el-select
          v-if="pickerTarget === 'theme'"
          v-model="filter"
          :show-arrow="false"
          popper-class="pref-dropdown"
          :aria-label="t('preferences.theme.filterLabel')"
        >
          <el-option
            v-for="option in filterOptions"
            :key="option"
            :value="option"
            :label="t(`preferences.theme.filter.${option}`)"
          />
        </el-select>
      </div>
      <p
        v-if="visibleThemes.length === 0"
        role="status"
      >
        {{ t('preferences.theme.noResults') }}
      </p>
      <div class="theme-picker-grid">
        <button
          v-for="item in visibleThemes"
          :key="item.name"
          type="button"
          class="theme-option"
          :class="{ active: selectedTheme === item.name }"
          :aria-label="themeLabel(item.name)"
          :aria-pressed="selectedTheme === item.name"
          @click="selectTheme(item.name)"
        >
          <theme-preview :name="item.name" />
          <span>{{ themeLabel(item.name) }}</span>
        </button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { storeToRefs } from 'pinia'
import { useI18n } from 'vue-i18n'
import { isDarkThemeId } from 'common/theme'
import { usePreferencesStore, type PreferencesState } from '@/store/preferences'
import { preferenceLabel } from '../registry'
import Bool from '../common/bool/index.vue'
import Compound from '../common/compound/index.vue'
import ThemeChoice from './choice.vue'
import ThemePreview from './preview.vue'
import { themes, themeLabel } from './config'

defineProps<{ embedded?: boolean }>()
const { t } = useI18n()
const store = usePreferencesStore()
const { theme, followSystemTheme, lightModeTheme, darkModeTheme, customCss } = storeToRefs(store)
const modeThemeKeys = ['lightModeTheme', 'darkModeTheme'] as const
const filterOptions = ['all', 'light', 'dark'] as const
type ThemeTarget = 'theme' | (typeof modeThemeKeys)[number]
const pickerTarget = ref<ThemeTarget>('theme')
const pickerOpen = ref(false)
const query = ref('')
const filter = ref<(typeof filterOptions)[number]>('all')
const selectedTheme = computed(() => store[pickerTarget.value])
const visibleThemes = computed(() => themes.filter(item => {
  const mode = pickerTarget.value === 'theme' ? filter.value : pickerTarget.value === 'lightModeTheme' ? 'light' : 'dark'
  const matchesMode = mode === 'all' || isDarkThemeId(item.name) === (mode === 'dark')
  return matchesMode && themeLabel(item.name).toLocaleLowerCase().includes(query.value.trim().toLocaleLowerCase())
}))
const openPicker = (target: ThemeTarget): void => {
  pickerTarget.value = target
  query.value = ''
  filter.value = 'all'
  pickerOpen.value = true
}
const selectTheme = (name: string): void => {
  onSelectChange(pickerTarget.value, name)
  pickerOpen.value = false
}
const onSelectChange = (type: keyof PreferencesState, value: unknown): void => {
  store.SET_SINGLE_PREFERENCE({ type, value })
}
</script>

<style>
.custom-css {
  margin: 24px 0;
  color: var(--editorColor);
  font-size: 14px;
}
.custom-css summary { cursor: pointer; }
.custom-css-input {
  width: 100%;
  box-sizing: border-box;
  margin-top: 12px;
  padding: 10px;
  border: 1px solid var(--editorColor10);
  border-radius: 4px;
  background: transparent;
  color: var(--editorColor);
  resize: vertical;
  font-family: monospace;
}
.theme-picker {
  background: var(--floatBgColor);
  color: var(--editorColor);
  --el-text-color-primary: var(--editorColor);
  --el-text-color-regular: var(--editorColor);
  --el-bg-color: var(--floatBgColor);
  --el-fill-color-blank: var(--floatBgColor);
  --el-border-color: var(--floatBorderColor);
}
.theme-mode-choices {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
  margin: 16px 0;
}
.theme-mode-choices > .pref-setting-row {
  grid-template-columns: minmax(0, 1fr);
  gap: 6px;
  margin: 0;
}
@container (max-width: 480px) {
  .theme-mode-choices { grid-template-columns: minmax(0, 1fr); }
}
.theme-picker .el-input__inner {
  background: transparent;
  border: none;
  color: var(--editorColor);
}
.theme-picker-tools {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.theme-picker-tools .el-select { max-width: 180px; }
.theme-picker-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
  max-height: 55vh;
  overflow-y: auto;
  padding: 4px;
}
.theme-option {
  border: 1px solid var(--editorColor10);
  border-radius: 5px;
  background: transparent;
  color: var(--editorColor);
  font: inherit;
  text-align: left;
  padding: 0;
  cursor: pointer;
}
.theme-option > span:last-child { display: block; padding: 8px; }
.theme-option.active,
.theme-option:focus-visible,
.theme-option:hover {
  outline: 2px solid var(--themeColor);
  outline-offset: 1px;
}
</style>
