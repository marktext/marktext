<template>
  <setting-row
    class="pref-range-item"
    :description="description"
    :notes="notes"
    :more="more"
    :disabled="disable"
  >
    <template #default="{ descriptionId }">
      <div class="range-control">
        <el-slider
          v-model="selectValue"
          :aria-label="description"
          :aria-describedby="descriptionId"
          :disabled="disable"
          :min="min"
          :max="max"
          :format-tooltip="(value: number) => value + (unit || '')"
          :step="step"
          @change="select"
        />
        <span class="value">{{ selectValue }} {{ unit }}</span>
      </div>
    </template>
  </setting-row>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import SettingRow from '../settingRow.vue'
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
  notes: '',
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

const select = (value: number | number[]) => {
  // el-slider may emit number[] in range mode; this control is single-value only.
  if (typeof value === 'number') {
    props.onChange(value)
  }
}
</script>

<style>
.pref-range-item .range-control {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pref-range-item .el-slider {
  min-width: 0;
  flex: 1;
}
.pref-range-item .value {
  min-width: 54px;
  text-align: right;
  white-space: nowrap;
}
.pref-range-item .el-slider__runway,
.pref-range-item .el-slider__bar {
  height: 4px;
}
.pref-range-item .el-slider__button {
  width: 12px;
  height: 12px;
}
</style>
