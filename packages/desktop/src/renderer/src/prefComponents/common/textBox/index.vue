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
        clearable
        @input="handleInput"
        @change="flushPending"
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
import { onBeforeUnmount, ref, watch } from 'vue'
import SettingRow from '../settingRow.vue'
import type { PrefControlBaseProps } from '../types'

interface TextBoxProps extends PrefControlBaseProps {
  input: string
  onChange: (value: string) => void
  defaultValue?: string
  emitTime?: number
  regexValidator?: RegExp
  validate?: (value: string) => boolean | Promise<boolean>
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
let revision = 0
let pending: { value: string; revision: number } | null = null
const inputText = ref(props.input)
const invalidInput = ref(false)

const clearTimer = (): void => {
  if (inputTimer) clearTimeout(inputTimer)
  inputTimer = null
}

watch(() => props.input, value => {
  revision++
  clearTimer()
  pending = null
  inputText.value = value
  invalidInput.value = false
})

const validateAndEmit = async(edit: { value: string; revision: number }): Promise<void> => {
  let valid = true
  if (props.validate) {
    try {
      valid = await props.validate(edit.value)
    } catch {
      valid = false
    }
  }
  if (edit.revision !== revision) return
  invalidInput.value = !valid
  if (valid) props.onChange(edit.value)
}

const flushPending = (): void => {
  clearTimer()
  const edit = pending
  pending = null
  if (edit) void validateAndEmit(edit)
}

const handleInput = (value: string): void => {
  revision++
  clearTimer()
  pending = null
  const valid = props.regexValidator.test(value)
  invalidInput.value = !valid
  if (!valid) return
  pending = { value, revision }
  if (props.emitTime === 0) {
    flushPending()
  } else {
    inputTimer = setTimeout(flushPending, props.emitTime)
  }
}

// Leaving a category must not drop an edit that is still waiting for its debounce.
onBeforeUnmount(flushPending)

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
