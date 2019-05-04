<template>
  <section class="pref-switch-item">
    <div class="description">{{description}}</div>
    <el-switch
      style="display: block"
      v-model="status"
      :active-text="status ? 'On': 'Off'">
    </el-switch>
  </section>
</template>

<script>
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
  }
}
</script>

<style>
  .pref-switch-item {
    font-size: 14px;
    user-select: none;
    margin: 20px 0;
  }
  .pref-switch-item .description {
    margin-bottom: 10px;
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
  .el-switch:not(.is-checked) .el-switch__core::after {
    background: var(--iconColor);
  }
</style>

