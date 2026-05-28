<template>
  <section
    class="pref-range-item"
    :class="{ 'ag-underdevelop': disable }"
  >
    <div
      class="description"
      style="display: flex; align-items: center; justify-content: space-between"
    >
      <span>{{ description }}:</span>
      <div style="display: flex; align-items: center">
        <span
          v-if="selectValue"
          class="value"
        >{{ selectValue }} <span v-if="unit">{{ unit }}</span></span>
        <LinkIcon
          v-if="more"
          :size="14"
          class="link-icon"
          style="margin-left: 4px"
          @click="handleMoreClick"
        />
      </div>
    </div>
    <el-slider
      v-model="selectValue"
      :min="min"
      :max="max"
      :format-tooltip="(value: number) => value + (unit ? unit : '')"
      :step="step"
      @change="select"
    />
  </section>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import LinkIcon from '@/components/icons/LinkIcon.vue'
import type { PrefControlBaseProps } from '../types'

interface RangeProps extends PrefControlBaseProps {
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
  unit?: string
  step?: number
}

const props = withDefaults(defineProps<RangeProps>(), {
  description: '',
  more: '',
  unit: '',
  disable: false
})

const selectValue = ref(props.value)

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

const select = (value: number | number[]) => {
  // el-slider may emit number[] in range mode; this control is single-value only.
  if (typeof value === 'number') {
    props.onChange(value)
  }
}
</script>

<style>
.pref-range-item {
  margin: 12px 0;
  font-size: 14px;
  color: var(--editorColor);
  width: 100%;
  & .value {
    text-align: right;
    font-style: italic;
    float: right;
  }
  & .el-slider {
    width: 100%;
  }
  & .el-slider__runway,
  & .el-slider__bar {
    height: 4px;
  }
  & .el-slider__button {
    width: 12px;
    height: 12px;
  }
  & .el-slider__button-wrapper {
    width: 20px;
    height: 20px;
    top: -9px;
  }
}
.pref-select-item .description {
  margin-bottom: 10px;

  & .value {
    color: var(--editorColor80);
  }
  & svg {
    cursor: pointer;
    opacity: 0.7;
    color: var(--iconColor);
  }
  & svg:hover {
    color: var(--themeColor);
  }
}
</style>
