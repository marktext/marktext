<template>
  <section
    class="pref-text-box-item"
    :class="{ 'ag-underdevelop': disable }"
  >
    <div
      class="description"
      style="display: flex; align-items: center"
    >
      <span>{{ description }}:</span>
      <InfoFilled
        v-if="more"
        width="16"
        height="16"
        @click="handleMoreClick"
      />
    </div>
    <el-input
      v-model="inputText"
      class="input"
      :class="{ error: invalidInput }"
      :placeholder="defaultValue"
      size="small"
      clearable
      @input="handleInput"
    />
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
import { InfoFilled } from '@element-plus/icons-vue'
import type { PrefControlBaseProps } from '../types'

interface TextBoxProps extends PrefControlBaseProps {
  notes?: string
  input: string
  onChange: (value: string) => void
  defaultValue?: string
  emitTime?: number
  regexValidator?: RegExp
}

const props = withDefaults(defineProps<TextBoxProps>(), {
  description: '',
  notes: '',
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

const handleMoreClick = () => {
  if (typeof props.more === 'string') {
    window.electron.shell.openExternal(props.more)
  }
}

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
.pref-text-box-item {
  font-size: 14px;
  user-select: none;
  margin: 20px 0;
  color: var(--editorColor);
  width: 100%;
  & div {
    background: transparent;
    color: var(--editorColor);
    border-color: var(--editorColor10);
  }
  & input.el-input__inner {
    height: 30px;
    background: transparent;
    border: none;
    padding-right: 15px;
    &::placeholder {
      color: var(--editorColor30);
    }
  }
  & .input {
    width: 100%;
  }
  & .el-input.is-active .el-input__inner,
  & .el-input__inner:focus {
    border-color: var(--themeColor);
  }
  & .el-input__icon,
  & .el-input__inner {
    line-height: 30px;
  }
  & .description {
    margin-bottom: 10px;
  }
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
.pref-text-box-item .el-input.error input {
  color: #f56c6c;
}
</style>
