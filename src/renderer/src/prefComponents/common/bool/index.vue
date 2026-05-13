<template>
  <section
    class="pref-switch-item"
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
      <el-tooltip
        v-else-if="detailedDescription"
        :content="detailedDescription"
        class="item"
        effect="dark"
        placement="top-start"
      >
        <InfoFilled
          width="16"
          height="16"
        />
      </el-tooltip>
      <span
        v-if="notes"
        class="notes"
      >
        {{ notes }}
      </span>
    </div>
    <el-switch
      v-model="status"
      @change="handleSwitchChange"
    />
  </section>
</template>

<script setup>
import { ref, watch } from 'vue'
import { InfoFilled } from '@element-plus/icons-vue'

const props = defineProps({
  description: String,
  notes: String,
  bool: Boolean,
  onChange: Function,
  more: String,
  detailedDescription: String,
  disable: {
    type: Boolean,
    default: false
  }
})

const status = ref(props.bool)

watch(
  () => props.bool,
  (value, oldValue) => {
    if (value !== oldValue) {
      status.value = value
    }
  }
)

const handleMoreClick = () => {
  if (typeof props.more === 'string') {
    window.electron.shell.openExternal(props.more)
  }
}

const handleSwitchChange = (value) => {
  props.onChange(value)
}
</script>

<style>
.pref-switch-item {
  font-size: 14px;
  user-select: none;
  margin: 20px 0;
  color: var(--editorColor);
  display: flex;
  align-items: center;
  justify-content: space-between;

  & .description {
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

  & .notes {
    font-style: italic;
    font-size: 12px;
  }
}

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
</style>
