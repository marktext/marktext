<template>
  <section
    class="pref-font-input-item"
    :class="{ 'ag-underdevelop': disable }"
  >
    <div class="description">
      <span>{{ description }}:</span>
      <InfoFilled
        v-if="more"
        style="margin-left: 4px"
        width="16"
        height="16"
        @click="handleMoreClick"
      />
    </div>
    <el-autocomplete
      v-model="selectValue"
      class="font-autocomplete"
      popper-class="font-autocomplete-popper"
      :fetch-suggestions="querySearch"
      :placeholder="t('preferences.selectFont')"
      @select="handleSelect"
    >
      <template #suffix>
        <ArrowDown
          width="16"
          height="16"
          class="el-input__icon"
        />
      </template>
      <template #default="{ item }">
        <div class="family">
          {{ item }}
        </div>
      </template>
    </el-autocomplete>
  </section>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import { InfoFilled, ArrowDown } from '@element-plus/icons-vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
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
})

let defaultValue = props.value
const fontFamilies = ref([])
const selectValue = ref(props.value)

watch(
  () => props.value,
  (value, oldValue) => {
    if (value !== oldValue) {
      defaultValue = value
      selectValue.value = value
    }
  }
)

const querySearch = (queryString, callback) => {
  const results =
    queryString && defaultValue !== queryString
      ? fontFamilies.value.filter((f) => f.toLowerCase().indexOf(queryString.toLowerCase()) === 0)
      : fontFamilies.value
  callback(results)
}

const handleSelect = (value) => {
  if (/^[^\s]+((-|\s)*[^\s])*$/.test(value)) {
    selectValue.value = value
    props.onChange(value)
  }
}

const handleMoreClick = () => {
  if (typeof props.more === 'string') {
    window.electron.shell.openExternal(props.more)
  }
}

onMounted(async () => {
  // Delay load native library because it's not needed for the editor and causes a delay.
  const { getFonts } = require('font-list')

  const fonts = await getFonts()
  fontFamilies.value = fonts.map((f) => f.replace(/"/g, '').trim())
})
</script>

<style>
.el-autocomplete-suggestion {
  border: 1px solid var(--floatBorderColor);
  background-color: var(--floatBgColor);
}
.el-popper[x-placement^='top'] .popper__arrow {
  border-top-color: var(--floatBorderColor);
}
.el-popper[x-placement^='bottom'] .popper__arrow {
  border-bottom-color: var(--floatBorderColor);
}
.el-popper[x-placement^='top'] .popper__arrow::after {
  border-top-color: var(--floatBgColor);
}
.el-popper[x-placement^='bottom'] .popper__arrow::after {
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
  & svg {
    cursor: pointer;
    opacity: 0.7;
    color: var(--iconColor);
  }
  & svg:hover {
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
