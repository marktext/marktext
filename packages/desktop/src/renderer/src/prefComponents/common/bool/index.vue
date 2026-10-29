<template>
  <setting-row
    class="pref-switch-item"
    :description="description"
    :notes="supportingNotes"
    :more="more"
    :disabled="disable"
    compact
  >
    <template #default="{ descriptionId }">
      <el-switch
        v-model="status"
        :aria-label="description"
        :aria-describedby="descriptionId"
        :disabled="disable"
      />
    </template>
  </setting-row>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import SettingRow from '../settingRow.vue'
import type { PrefControlBaseProps } from '../types'

interface BoolProps extends PrefControlBaseProps {
  bool: boolean
  onChange: (value: boolean) => void
  detailedDescription?: string
}

const props = withDefaults(defineProps<BoolProps>(), {
  description: '',
  notes: '',
  more: '',
  detailedDescription: '',
  disable: false
})

const supportingNotes = computed(() => [props.notes, props.detailedDescription].filter(Boolean).join(' '))

const status = computed({
  get: () => props.bool,
  set: (value: boolean | string | number) => props.onChange(Boolean(value))
})

</script>

<style>
span.el-switch__core::after {
  top: 3px;
  left: 7px;
  width: 10px;
  height: 10px;
}

.el-switch .el-switch__core {
  border: 2px solid var(--iconColor);
  background: transparent;
  box-sizing: border-box;
}

span.el-switch__label {
  color: var(--editorColor50);
}

.el-switch:not(.is-checked) .el-switch__core::after {
  background: var(--iconColor);
}

.el-switch.is-checked .el-switch__core {
  border-color: var(--themeColor);
  background-color: var(--themeColor);
}
</style>
