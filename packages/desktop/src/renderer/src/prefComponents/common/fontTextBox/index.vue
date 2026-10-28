<template>
  <setting-row
    class="pref-font-input-item"
    :description="description"
    :notes="notes"
    :more="more"
    :disabled="disable"
  >
    <template #default="{ descriptionId }">
      <el-autocomplete
        v-model="selectValue"
        :aria-label="description"
        :aria-describedby="descriptionId"
        :disabled="disable"
        class="font-autocomplete"
        popper-class="font-autocomplete-popper"
        :fetch-suggestions="querySearch"
        :placeholder="t('preferences.selectFont')"
        @select="handleSelect"
      >
        <template #suffix>
          <ArrowDown
            width="16"
            height="16"
            class="el-input__icon"
          />
        </template>
        <template #default="{ item }">
          <div class="family">
            {{ item }}
          </div>
        </template>
      </el-autocomplete>
    </template>
  </setting-row>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'
import SettingRow from '../settingRow.vue'
import type { PrefControlProps } from '../types'
import { withBundledFonts } from './bundledFonts'

const { t } = useI18n()

interface FontTextBoxProps extends PrefControlProps<string> {
  onlyMonospace?: boolean
}

const props = withDefaults(defineProps<FontTextBoxProps>(), {
  description: '',
  notes: '',
  more: '',
  disable: false,
  onlyMonospace: false
})

let defaultValue = props.value
const fontFamilies = ref<string[]>([])
const selectValue = ref(props.value)

watch(
  () => props.value,
  (value, oldValue) => {
    if (value !== oldValue) {
      defaultValue = value
      selectValue.value = value
    }
  }
)

const querySearch = (queryString: string, callback: (items: string[]) => void) => {
  const results =
    queryString && defaultValue !== queryString
      ? fontFamilies.value.filter((f) => f.toLowerCase().indexOf(queryString.toLowerCase()) === 0)
      : fontFamilies.value
  callback(results)
}

const handleSelect = (selection: { value?: string } | string) => {
  const value = typeof selection === 'string' ? selection : (selection?.value ?? '')
  if (/^[^\s]+((-|\s)*[^\s])*$/.test(value)) {
    selectValue.value = value
    props.onChange(value)
  }
}

onMounted(async () => {
  // font-list is a native module; it runs in the main process and is reached via IPC.
  const fonts = await window.fonts.list()
  const systemFonts = (fonts || []).map((f) => f.replace(/"/g, '').trim())
  // System fonts don't include the bundled defaults (Open Sans / DejaVu Sans
  // Mono), so surface them in the picker too (#3021).
  fontFamilies.value = withBundledFonts(systemFonts, props.onlyMonospace)
})
</script>

<style>
.font-autocomplete-popper {
  background: var(--floatBgColor);
  border-color: var(--floatBorderColor);
  color: var(--editorColor);
}
</style>
