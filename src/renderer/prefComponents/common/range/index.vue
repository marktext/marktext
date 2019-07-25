<template>
  <section class="pref-range-item" :class="{'ag-underdevelop': disable}">
    <div class="description">
      <span>{{description}}: <span class="value">{{selectValue + (unit ? unit : '')}}</span></span>
      <i class="el-icon-info" v-if="more"
        @click="handleMoreClick"
      ></i>
    </div>
    <el-slider
      v-model="selectValue"
      @change="select"
      :min="min"
      :max="max"
      :format-tooltip="value => value + (unit ? unit : '')"
      :step="step">
    </el-slider>
  </section>
</template>

<script>
import { shell } from 'electron'

export default {
  data () {
    return {
      selectValue: this.value
    }
  },
  props: {
    description: String,
    value: String | Number,
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
  },
  watch: {
    value: function (value, oldValue) {
      if (value !== oldValue) {
        this.selectValue = value
      }
    }
  },
  methods: {
    handleMoreClick () {
      if (typeof this.more === 'string') {
        shell.openExternal(this.more)
      }
    },
    select (value) {
      this.onChange(value)
    }
  }
}
</script>

<style>
.pref-range-item {
  margin: 20px 0;
  font-size: 14px;
  color: var(--editorColor);
  & .el-slider {
    width: 300px;
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
  & i {
    cursor: pointer;
    opacity: .7;
    color: var(--iconColor);
  }
  & i:hover {
    color: var(--themeColor);
  }
}
</style>
