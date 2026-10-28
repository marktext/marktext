<template>
  <setting-row
    class="pref-text-box-item"
    :description="description"
    :notes="notes"
    :more="more"
    :disabled="disable"
    :wide="wide"
  >
    <template #default="{ descriptionId }">
      <el-input
        v-model="inputText"
        :aria-label="description"
        :aria-describedby="descriptionId"
        :aria-invalid="invalidInput"
        :disabled="disable"
        class="input"
        :class="{ error: invalidInput }"
        :placeholder="defaultValue"
        size="small"
        clearable
        @input="handleInput"
      />
      <div
        v-if="invalidInput && errorMessage"
        class="error-message"
        role="alert"
      >
        {{ errorMessage }}
      </div>
    </template>
  </setting-row>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import SettingRow from '../settingRow.vue'
import type { PrefControlBaseProps } from '../types'

interface TextBoxProps extends PrefControlBaseProps {
  input: string
  onChange: (value: string) => void
  defaultValue?: string
  emitTime?: number
  regexValidator?: RegExp
  errorMessage?: string
}

const props = withDefaults(defineProps<TextBoxProps>(), {
  description: '',
  notes: '',
  errorMessage: '',
  more: '',
  disable: false,
  defaultValue: '',
  emitTime: 800,
  regexValidator: () => /(.*?)/
})

let inputTimer: ReturnType<typeof setTimeout> | null = null
const inputText = ref(props.input)
const invalidInput = ref(false)

watch(
  () => props.input,
  (value, oldValue) => {
    if (value !== oldValue) {
      inputText.value = value
    }
  }
)

const handleInput = (value: string) => {
  const result = props.regexValidator.test(value)
  invalidInput.value = !result

  if (result) {
    if (inputTimer) {
      clearTimeout(inputTimer)
    }

    if (props.emitTime === 0) {
      props.onChange(value)
      return
    }

    inputTimer = setTimeout(() => {
      inputTimer = null
      props.onChange(value)
    }, props.emitTime)
  }
}
</script>

<style>
.pref-text-box-item .error-message {
  color: var(--deleteColor);
  margin-top: 6px;
}
.pref-text-box-item .el-input.error {
  --el-input-border-color: var(--deleteColor);
}
</style>
