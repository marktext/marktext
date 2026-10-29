<template>
  <setting-row
    class="pref-select-item"
    :description="description"
    :notes="notes"
    :more="more"
    :disabled="disable"
    :wide="wide"
  >
    <template #default="{ descriptionId }">
      <el-select
        v-model="selectValue"
        :show-arrow="false"
        popper-class="pref-dropdown"
        :aria-label="description || ariaLabel"
        :aria-describedby="descriptionId"
        :disabled="disable"
      >
        <el-option
          v-for="item in options"
          :key="item.value"
          :label="item.label"
          :value="item.value"
        />
      </el-select>
    </template>
  </setting-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SettingRow from '../settingRow.vue'
import type { PrefControlBaseProps, PrefSelectOption } from '../types'

type SelectValue = string | number | boolean

interface SelectProps extends PrefControlBaseProps {
  /** Names the select for assistive tech when there is no visible description. */
  ariaLabel?: string
  value: SelectValue
  options: ReadonlyArray<PrefSelectOption<SelectValue>>
  onChange: (value: SelectValue) => void
}

const props = withDefaults(defineProps<SelectProps>(), {
  description: '',
  notes: '',
  more: '',
  disable: false
})

const selectValue = computed({
  get: () => props.value,
  set: (value: SelectValue) => props.onChange(value)
})

</script>

<style>
li.el-select-dropdown__item {
  color: var(--editorColor);
  height: 30px;
}
li.el-select-dropdown__item.is-hovering,
li.el-select-dropdown__item:hover {
  background: var(--floatHoverColor);
}
li.el-select-dropdown__item.selected,
li.el-select-dropdown__item.is-selected {
  color: var(--themeColor);
  background: var(--themeColor10);
}
div.el-select-dropdown {
  background: var(--floatBgColor);
  border-color: var(--floatBorderColor);
}
.el-select__wrapper.is-focused {
  box-shadow: 0 0 0 1px var(--themeColor) inset;
}
</style>
