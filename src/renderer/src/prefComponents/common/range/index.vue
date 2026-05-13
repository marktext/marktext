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
        <InfoFilled
          v-if="more"
          width="16"
          height="16"
          style="margin-left: 4px"
          @click="handleMoreClick"
        />
      </div>
    </div>
    <el-slider
      v-model="selectValue"
      :min="min"
      :max="max"
      :format-tooltip="(value) => value + (unit ? unit : '')"
      :step="step"
      @change="select"
    />
  </section>
</template>

<script setup>
import { ref, watch } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'

const props = defineProps({
  description: String,
  value: [String, Number],
  min: Number,
  max: Number,
  onChange: Function,
  unit: String,
  step: Number,
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
.pref-range-item {
  margin: 20px 0;
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
