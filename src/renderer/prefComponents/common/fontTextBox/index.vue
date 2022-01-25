<template>
  <section class="pref-font-input-item" :class="{'ag-underdevelop': disable}">
    <div class="description">
      <span>{{description}}:</span>
      <i class="el-icon-info" v-if="more" @click="handleMoreClick"></i>
    </div>
    <el-autocomplete
      class="font-autocomplete"
      popper-class="font-autocomplete-popper"
      v-model="selectValue"
      :fetch-suggestions="querySearch"
      placeholder="Select font..."
      @select="handleSelect"
    >
      <i class="el-icon-arrow-down el-input__icon" slot="suffix"></i>
      <template slot-scope="{ item }">
        <div class="family">{{ item }}</div>
      </template>
    </el-autocomplete>
  </section>
</template>

<script>
import { shell } from 'electron'

// Example of fontmanager-redux objects:
// {
//     path: '/Library/Fonts/Arial.ttf',
//     postscriptName: 'ArialMT',
//     family: 'Arial',
//     style: 'Regular',
//     weight: 400,
//     width: 5,
//     italic: false,
//     monospace: false
// }
// {
//     path: '/Library/Fonts/Arial Bold.ttf',
//     postscriptName: 'Arial-BoldMT',
//     family: 'Arial',
//     style: 'Bold',
//     weight: 700,
//     width: 5,
//     italic: false,
//     monospace: false
// }

export default {
  data () {
    this.defaultValue = this.value
    return {
      fontFamilies: [],
      selectValue: this.value
    }
  },
  props: {
    description: String,
    value: String,
    onChange: Function,
    more: String,
    disable: {
      type: Boolean,
      default: false
    },
    onlyMonospace: {
      type: Boolean,
      default: false
    }
  },

  watch: {
    value: function (value, oldValue) {
      if (value !== oldValue) {
        this.defaultValue = value
        this.selectValue = value
      }
    }
  },

  methods: {
    querySearch (queryString, callback) {
      const fontFamilies = this.fontFamilies
      const results = queryString && this.defaultValue !== queryString
        ? fontFamilies.filter(f => f.toLowerCase().indexOf(queryString.toLowerCase()) === 0)
        : fontFamilies
      callback(results)
    },

    handleSelect (value) {
      if (/^[^\s]+((-|\s)*[^\s])*$/.test(value)) {
        this.selectValue = value
        this.onChange(value)
      }
    },

    handleMoreClick () {
      if (typeof this.more === 'string') {
        shell.openExternal(this.more)
      }
    }
  },
  mounted () {
    // Delay load native library because it's not needed for the editor and causes a delay.
    const fontManager = require('fontmanager-redux')
    const { onlyMonospace } = this
    const buf = fontManager.getAvailableFontsSync()
      .filter(f => f.family && (!onlyMonospace || (onlyMonospace && f.monospace)))
      .map(f => f.family)
    this.fontFamilies = [...new Set(buf)].sort((a, b) => a.localeCompare(b))
  }
}
</script>

<style>
.el-autocomplete-suggestion {
  border: 1px solid var(--floatBorderColor);
  background-color: var(--floatBgColor);
}
.el-popper[x-placement^=top] .popper__arrow {
  border-top-color: var(--floatBorderColor);
}
.el-popper[x-placement^=bottom] .popper__arrow {
  border-bottom-color: var(--floatBorderColor);
}
.el-popper[x-placement^=top] .popper__arrow::after {
  border-top-color: var(--floatBgColor);
}
.el-popper[x-placement^=bottom] .popper__arrow::after {
  border-bottom-color: var(--floatBgColor);
}

.el-autocomplete-suggestion li {
  color: var(--editorColor);
}
.el-autocomplete-suggestion li.highlighted,
.el-autocomplete-suggestion li:hover {
  background: var(--floatHoverColor);
}

.pref-font-input-item {
  margin: 20px 0;
  font-size: 14px;
  color: var(--editorColor);
  & .font-autocomplete {
    width: 100%;
  }
  & input.el-input__inner {
    height: 30px;
    background: transparent;
    color: var(--editorColor);
    border-color: var(--editorColor10);
  }
  & .el-input.is-active .el-input__inner,
  & .el-input__inner:focus {
    border-color: var(--themeColor);
  }
  & .el-input__icon,
  & .el-input__inner {
    line-height: 30px;
  }
}
.pref-font-input-item .description {
  margin-bottom: 10px;
  & i {
    cursor: pointer;
    opacity: 0.7;
    color: var(--iconColor);
  }
  & i:hover {
    color: var(--themeColor);
  }
}
.pref-font-input-item .font-autocomplete-popper {
  li {
    line-height: normal;
    padding: 7px;
    .value {
      text-overflow: ellipsis;
      overflow: hidden;
    }
    .link {
      font-size: 12px;
      color: #b4b4b4;
    }
  }
}
</style>
