<template>
  <section class="pref-switch-item">
    <div class="description">
      <span>{{description}}</span>
      <i class="el-icon-info" v-if="more"
        @click="handleMoreClick"
      ></i>
    </div>
    <el-switch
      style="display: block"
      v-model="status"
      :active-text="status ? 'On': 'Off'">
    </el-switch>
  </section>
</template>

<script>
import { shell } from 'electron'

export default {
  data () {
    return {
      status: this.bool
    }
  },
  props: {
    description: String,
    bool: Boolean,
    onChange: Function,
    more: String
  },
  methods: {
    handleMoreClick () {
      if (typeof this.more === 'string') {
        shell.openExternal(this.more)
      }
    }
  }
}
</script>

<style>
  .pref-switch-item {
    font-size: 14px;
    user-select: none;
    margin: 20px 0;
    color: var(--editorColor);
  }
  .pref-switch-item .description {
    margin-bottom: 10px;
    & i {
      cursor: pointer;
    }
    & i:hover {
      color: var(--themeColor);
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

