<template>
  <section
    class="pref-font-input-item"
    :class="{ 'ag-underdevelop': disable }"
  >
    <div class="description">
      <span>{{ description }}:</span>
      <icon-tooltip
        v-if="more"
        :content="t('preferences.learnMore', { name: description })"
      >
        <button
          type="button"
          class="plain-button link-icon"
          style="margin-left: 4px"
          :aria-label="t('preferences.learnMore', { name: description })"
          @click="handleMoreClick"
        >
          <LinkIcon :size="14" />
        </button>
      </icon-tooltip>
    </div>
    <el-autocomplete
      v-model="selectValue"
      :aria-label="description"
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
    <div
      v-if="notes"
      class="notes"
    >
      {{ notes }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { ArrowDown } from '@element-plus/icons-vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import IconTooltip from '@/components/iconTooltip/index.vue'
import { useI18n } from 'vue-i18n'
import type { PrefControlProps } from '../types'
import { withBundledFonts } from './bundledFonts'

const { t } = useI18n()

interface FontTextBoxProps extends PrefControlProps<string> {
  notes?: string
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

const handleMoreClick = () => {
  if (typeof props.more === 'string') {
    window.electron.shell.openExternal(props.more)
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
.el-autocomplete-suggestion {
  border: 1px solid var(--floatBorderColor);
  background-color: var(--floatBgColor);
}
.el-popper[x-placement^='top'] .popper__arrow {
  border-top-color: var(--floatBorderColor);
}
.el-popper[x-placement^='bottom'] .popper__arrow {
  border-bottom-color: var(--floatBorderColor);
}
.el-popper[x-placement^='top'] .popper__arrow::after {
  border-top-color: var(--floatBgColor);
}
.el-popper[x-placement^='bottom'] .popper__arrow::after {
  border-bottom-color: var(--floatBgColor);
}

.el-autocomplete-suggestion li {
  color: var(--editorColor);
}
.el-autocomplete-suggestion li.highlighted,
.el-autocomplete-suggestion li:hover {
  background: var(--floatHoverColor);
}

.pref-font-input-item {
  margin: 12px 0;
  font-size: 14px;
  color: var(--editorColor);
  & .font-autocomplete {
    width: 100%;
  }
  & input.el-input__inner {
    height: 30px;
    background: transparent;
    color: var(--editorColor);
    border-color: var(--editorColor10);
  }
  & .el-input.is-active .el-input__inner,
  & .el-input__inner:focus {
    border-color: var(--themeColor);
  }
  & .el-input__icon,
  & .el-input__inner {
    line-height: 30px;
  }
}
.pref-font-input-item .description {
  margin-bottom: 10px;
  & svg {
    cursor: pointer;
    opacity: 0.7;
    color: var(--iconColor);
  }
  & svg:hover {
    color: var(--themeColor);
  }
}
.pref-font-input-item .font-autocomplete-popper {
  li {
    line-height: normal;
    padding: 7px;
    .value {
      text-overflow: ellipsis;
      overflow: hidden;
    }
    .link {
      font-size: 12px;
      color: #b4b4b4;
    }
  }
}
</style>
