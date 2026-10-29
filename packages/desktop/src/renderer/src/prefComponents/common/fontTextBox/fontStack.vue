<template>
  <div class="font-stack">
    <el-input-tag
      v-select-only
      :model-value="families"
      draggable
      :save-on-blur="false"
      :disabled="disabled"
      :aria-label="description"
      :aria-describedby="descriptionId"
      :tabindex="-1"
      @update:model-value="updateFamilies"
    >
      <template
        v-if="!families.length"
        #prefix
      >
        <span class="font-stack-placeholder">{{ t('preferences.selectFont') }}</span>
      </template>
      <template #suffix>
        <el-popover
          v-model:visible="pickerVisible"
          trigger="click"
          placement="bottom-end"
          :width="280"
          :show-arrow="false"
          popper-class="pref-dropdown font-stack-picker"
          :disabled="disabled"
          @show="query = ''"
        >
          <template #reference>
            <el-button
              text
              :disabled="disabled"
              :aria-label="t('preferences.selectFont')"
              :icon="ArrowDown"
              @mousedown.prevent
            />
          </template>
          <el-input
            v-model="query"
            :placeholder="t('preferences.selectFont')"
            :aria-label="t('preferences.selectFont')"
            clearable
          />
          <el-scrollbar max-height="240px">
            <div class="font-stack-options">
              <button
                v-for="font in availableFonts"
                :key="font"
                type="button"
                class="font-stack-option"
                @click="addFont(font)"
              >
                {{ font }}
              </button>
              <p v-if="!availableFonts.length">
                {{ t('preferences.fontStack.noMatches') }}
              </p>
            </div>
          </el-scrollbar>
        </el-popover>
      </template>
    </el-input-tag>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowDown } from '@element-plus/icons-vue'
import { parseFontFamilies, serializeFontFamilies } from './fontFamilies'

const props = defineProps<{
  value: string
  fonts: string[]
  description: string
  descriptionId?: string
  disabled: boolean
  onChange: (value: string) => void
}>()

// InputTag's readonly prop also disables tag removal and dragging.
const vSelectOnly = {
  mounted(element: HTMLElement): void {
    const input = element.querySelector('input')
    if (input) input.readOnly = true
  }
}

const { t } = useI18n()
const pickerVisible = ref(false)
const query = ref('')
const families = computed(() => parseFontFamilies(props.value))
const availableFonts = computed(() => {
  const selected = new Set(families.value.map(font => font.toLowerCase()))
  const search = query.value.trim().toLowerCase()
  return props.fonts.filter(font => !selected.has(font.toLowerCase()) && font.toLowerCase().includes(search))
})

const updateFamilies = (value: string[] | undefined): void => {
  const seen = new Set<string>()
  const next = (value ?? []).map(font => font.trim()).filter(font => {
    const key = font.toLowerCase()
    if (!font || seen.has(key)) return false
    seen.add(key)
    return true
  })
  props.onChange(serializeFontFamilies(next))
}

const addFont = (font: string): void => {
  updateFamilies([...families.value, font])
  pickerVisible.value = false
}

</script>

<style scoped>
.font-stack :deep(.el-input-tag) {
  --el-fill-color-blank: transparent;
  --el-fill-color-light: var(--editorColor04);
  --el-border-color: var(--editorColor10);
  --el-border-color-hover: var(--editorColor30);
  --el-text-color-regular: var(--editorColor);
  --el-text-color-placeholder: var(--editorColor30);
  --el-color-primary: var(--themeColor);
}
.font-stack :deep(.el-tag) {
  --el-tag-bg-color: var(--editorColor04);
  --el-tag-text-color: var(--editorColor);
  --el-tag-border-color: var(--editorColor10);
}
.font-stack :deep(.el-input-tag__input-wrapper) {
  display: none;
}
.font-stack-placeholder {
  color: var(--editorColor30);
  font-size: 14px;
}
.font-stack :deep(.el-input-tag__suffix .el-button) {
  padding: 0 2px;
  height: 24px;
  color: var(--editorColor50);
}
.font-stack-options {
  padding-top: 6px;
}
.font-stack-option {
  display: block;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--editorColor);
  text-align: start;
  font: inherit;
  cursor: pointer;
}
.font-stack-option:hover,
.font-stack-option:focus-visible {
  background: var(--floatHoverColor);
}
.font-stack-options p {
  margin: 12px 8px;
  color: var(--editorColor50);
}
</style>

<style>
.font-stack-picker .el-input {
  --el-fill-color-blank: transparent;
  --el-input-bg-color: transparent;
  --el-border-color: var(--editorColor10);
  --el-border-color-hover: var(--editorColor30);
  --el-text-color-regular: var(--editorColor);
  --el-text-color-placeholder: var(--editorColor30);
  --el-color-primary: var(--themeColor);
}
.font-stack-picker input.el-input__inner {
  background: transparent;
  border: none;
  color: var(--editorColor);
}
</style>
