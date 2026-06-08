<template>
  <section
    class="pref-select-item"
    :class="{ 'ag-underdevelop': disable }"
  >
    <div
      v-if="description"
      class="description"
      style="display: flex; align-items: center"
    >
      <span>{{ description }}:</span>
      <LinkIcon
        v-if="more"
        :size="14"
        class="link-icon"
        @click="handleMoreClick"
      />
    </div>
    <el-select
      v-model="selectValue"
      :disabled="disable"
      @change="select"
    >
      <el-option
        v-for="item in options"
        :key="item.value"
        :label="item.label"
        :value="item.value"
      />
    </el-select>
    <div
      v-if="notes"
      class="notes"
    >
      {{ notes }}
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import type { PrefControlBaseProps, PrefSelectOption } from '../types'

type SelectValue = string | number | boolean

interface SelectProps extends PrefControlBaseProps {
  notes?: string
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

const selectValue = ref<SelectValue>(props.value)

watch(
  () => props.value,
  (value, oldValue) => {
    if (value !== oldValue) {
      selectValue.value = value
    }
  }
)

const handleMoreClick = () => {
  if (typeof props.more === 'string') {
    window.electron.shell.openExternal(props.more)
  }
}

const select = (value: SelectValue) => {
  props.onChange(value)
}
</script>

<style>
.pref-select-item {
  margin: 12px 0;
  font-size: 14px;
  color: var(--editorColor);
  & .el-select {
    width: 100%;
  }
  & div {
    background: transparent;
    color: var(--editorColor);
    border-color: var(--editorColor10);
  }
  & input.el-input__inner {
    height: 30px;
    background: transparent;
    color: var(--editorColor);
    border-color: var(--editorColor10);
  }
  & .el-input__icon,
  & .el-input__inner {
    line-height: 30px;
  }
}
.pref-select-item .description {
  margin-bottom: 10px;
  & svg {
    margin-left: 4px;
    cursor: pointer;
    opacity: 0.7;
    color: var(--iconColor);
  }
  & svg:hover {
    color: var(--themeColor);
  }
}
li.el-select-dropdown__item {
  color: var(--editorColor);
  height: 30px;
}
li.el-select-dropdown__item.hover,
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
  & .popper__arrow {
    display: none;
  }
}
.el-select__wrapper.is-focused {
  box-shadow: 0 0 0 1px var(--themeColor) inset;
}
</style>
