<template>
  <setting-row :description="description">
    <button
      type="button"
      class="selected-theme"
      :aria-label="t('preferences.theme.chooseFor', { name: description })"
      @click="$emit('choose')"
    >
      <theme-preview :name="value" />
      <span class="selected-theme-label">
        {{ themeLabel(value) }} · {{ t('preferences.theme.chooseTheme') }}
      </span>
    </button>
  </setting-row>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import SettingRow from '../common/settingRow.vue'
import ThemePreview from './preview.vue'
import { themeLabel } from './config'
defineProps<{ description: string; value: string }>()
defineEmits<{ choose: [] }>()
const { t } = useI18n()
</script>

<style scoped>
.selected-theme {
  width: 100%;
  padding: 0;
  border: 1px solid var(--editorColor10);
  border-radius: 5px;
  background: transparent;
  color: var(--editorColor);
  cursor: pointer;
  font: inherit;
}
.selected-theme:focus-visible,
.selected-theme:hover {
  outline: 2px solid var(--themeColor);
  outline-offset: 2px;
}
.selected-theme-label {
  display: block;
  padding: 8px;
}
</style>
