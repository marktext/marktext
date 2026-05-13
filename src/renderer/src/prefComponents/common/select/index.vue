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
      <InfoFilled
        v-if="more"
        width="16"
        height="16"
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

<script setup>
import { ref, watch } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'

const props = defineProps({
  description: String,
  notes: String,
  value: [String, Number],
  options: Array,
  onChange: Function,
  more: String,
  disable: {
    type: Boolean,
    default: false
  }
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

const select = (value) => {
  props.onChange(value)
}
</script>

<style>
.pref-select-item {
  margin: 20px 0;
  font-size: 14px;
  color: var(--editorColor);
  & .notes {
    margin-top: 10px;
    font-style: italic;
    font-size: 12px;
  }
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
div.el-select-dropdown {
  background: var(--floatBgColor);
  border-color: var(--floatBorderColor);
  & .popper__arrow {
    display: none;
  }
}
</style>
